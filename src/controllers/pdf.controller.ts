import { Request, Response, NextFunction } from 'express';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import supabase from '../lib/supabase.js';
import prisma from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import * as aiService from '../services/ai.service.js';

export const uploadPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    const { subjectId } = req.body;

    if (!file) {
      throw new BadRequestError('No document file uploaded');
    }

    if (!subjectId) {
      throw new BadRequestError('subjectId is required');
    }

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      throw new NotFoundError('Subject not found');
    }

    // Upload to Supabase Storage (safely try/catch)
    const fileName = `${Date.now()}-${file.originalname}`;
    let fileUrl = '';
    try {
      if (supabase && supabase.from) {
        await supabase.from('pdfs').upload(fileName, file.buffer, {
          contentType: file.mimetype,
        });
        const urlRes = await supabase.from('pdfs').getPublicUrl(fileName);
        fileUrl = urlRes?.publicUrl || '';
      }
    } catch (supErr: any) {
      console.warn('Supabase upload warning (continuing with text extraction):', supErr?.message || supErr);
    }

    // Parse Document text according to file extension
    let extractedText = '';
    let totalPages = 1;
    const lowerName = file.originalname.toLowerCase();

    if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
      try {
        const docResult = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = (docResult.value || '').trim();
        console.log(`Word document text extraction success: ${extractedText.length} chars`);
      } catch (docErr: any) {
        console.warn('Word document parsing failed:', docErr.message);
      }
    } else if (lowerName.endsWith('.txt')) {
      extractedText = file.buffer.toString('utf-8').trim();
    } else {
      // PDF Parsing
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const pdfData = await pdfParse(file.buffer);
          extractedText = pdfData.text || '';
          totalPages = pdfData.numpages || 1;

          extractedText = extractedText
            .replace(/\r\n/g, '\n')
            .replace(/\t/g, ' ')
            .replace(/ {3,}/g, '  ')
            .trim();

          if (extractedText.length > 0) {
            console.log(`PDF text extraction success on attempt ${attempt + 1}: ${extractedText.length} chars, ${totalPages} pages`);
            break;
          }
        } catch (parseErr: any) {
          console.warn(`PDF parsing attempt ${attempt + 1} failed:`, parseErr.message);
        }
      }
    }

    // If extraction produced very little text, log a warning but still save
    if (extractedText.length < 50) {
      console.warn(`PDF "${file.originalname}" has very little extractable text (${extractedText.length} chars). Question generation may fail if the PDF is image-based.`);
    }

    // Determine uploader name safely
    const uploaderName = req.user
      ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'Admin User'
      : 'Admin User';

    // Create record in database
    const pdfDoc = await prisma.pdfDocument.create({
      data: {
        fileName: file.originalname,
        fileUrl: fileUrl || '',
        fileSize: file.size,
        subjectId,
        extractedText: extractedText || 'No text could be extracted from this PDF.',
        totalPages: totalPages || 0,
        status: 'UPLOADED',
        uploadedBy: uploaderName,
      },
    });

    res.status(201).json({
      status: 'success',
      data: { pdf: pdfDoc },
      warning: extractedText.length < 50
        ? 'This PDF may be image-based. Text extraction produced limited results. Question generation may not work well.'
        : undefined,
    });
  } catch (error) {
    console.error('PDF upload error:', error);
    next(error);
  }
};

export const getPdfs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pdfs = await prisma.pdfDocument.findMany({
      include: {
        subject: {
          select: { name: true, combination: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: pdfs.length,
      data: { pdfs },
    });
  } catch (error) {
    next(error);
  }
};

export const deletePdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };

    const pdf = await prisma.pdfDocument.findUnique({
      where: { id },
    });

    if (!pdf) {
      throw new NotFoundError('PDF document not found');
    }

    // Extract path name from URL
    const fileUrlParts = pdf.fileUrl.split('/');
    const fileName = fileUrlParts[fileUrlParts.length - 1];

    // Delete from Supabase Storage (ignore errors — file may not exist)
    if (fileName && fileName !== '') {
      try {
        if (supabase && supabase.from) {
          await supabase.from('pdfs').remove([fileName]);
        }
      } catch (supErr) {
        console.warn('Supabase delete warning (proceeding with DB deletion):', supErr);
      }
    }

    // Delete related questions first
    await prisma.question.deleteMany({ where: { sourcePdfId: id } });

    // Delete from database
    await prisma.pdfDocument.delete({
      where: { id },
    });

    res.status(200).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

export const processPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const { numQuestions = 10, difficulty = 'MEDIUM', isMultiSubject = false, extractSubjectIds = [] } = req.body;

    const pdf = await prisma.pdfDocument.findUnique({
      where: { id },
    });

    if (!pdf) {
      throw new NotFoundError('PDF document not found');
    }

    // If extracted text is too short, try re-extracting from Supabase storage
    let textToUse = pdf.extractedText || '';
    if (textToUse.length < 50) {
      console.log(`PDF ${id} has insufficient text (${textToUse.length} chars). Attempting re-extraction...`);

      // Try to re-download and parse the PDF
      if (pdf.fileUrl) {
        try {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('pdfs')
            .download(pdf.fileUrl.split('/').pop() || '');

          if (!downloadError && fileData) {
            const buffer = Buffer.from(await fileData.arrayBuffer());
            const pdfData = await pdfParse(buffer);
            textToUse = (pdfData.text || '').replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim();

            // Save the re-extracted text
            await prisma.pdfDocument.update({
              where: { id },
              data: { extractedText: textToUse },
            });

            console.log(`Re-extraction produced ${textToUse.length} chars`);
          }
        } catch (reErr: any) {
          console.warn('Re-extraction failed:', reErr.message);
        }
      }
    }

    if (textToUse.length < 50) {
      throw new BadRequestError(
        'This PDF does not contain enough extractable text to generate questions. ' +
        'The PDF may be image-based (scanned). Please upload a text-based PDF or try a different file.'
      );
    }

    // Update status to processing
    await prisma.pdfDocument.update({
      where: { id },
      data: { status: 'PROCESSING' },
    });

    try {
      const questions = await aiService.generateQuestionsFromText(
        textToUse,
        pdf.subjectId,
        pdf.id,
        numQuestions,
        difficulty,
        isMultiSubject,
        extractSubjectIds
      );

      // Update status to processed
      await prisma.pdfDocument.update({
        where: { id },
        data: {
          status: 'PROCESSED',
          questionsCount: {
            increment: questions.length,
          },
        },
      });

      res.status(200).json({
        status: 'success',
        message: `Successfully generated ${questions.length} questions from PDF`,
        results: questions.length,
        data: { questions },
      });
    } catch (aiError: any) {
      console.error('AI generation failed for PDF:', id, aiError.message);
      await prisma.pdfDocument.update({
        where: { id },
        data: { status: 'FAILED' },
      });
      throw aiError;
    }
  } catch (error) {
    next(error);
  }
};
