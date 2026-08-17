import fs from 'fs';
import path from 'path';
// @ts-ignore
import pdfParse from 'pdf-parse';
import prisma from '../lib/prisma.js';

async function main() {
  console.log('🚀 Starting PDF question extraction script...');

  const uploadedDir = 'C:/Users/TINGO-AI-010/.gemini/antigravity/brain/47e5f6e9-3e95-4903-976f-aff07d1f719a/.user_uploaded';
  const files = fs.readdirSync(uploadedDir).filter(f => f.endsWith('.pdf'));

  console.log(`Found ${files.length} PDF files in upload directory.`);

  let rawText = '';
  for (const f of files) {
    const filePath = path.join(uploadedDir, f);
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const numPages = (pdfData as any).numpages || (pdfData as any).numrender || 0;
    console.log(`📄 Read ${f}: ${numPages} pages, ${pdfData.text.length} chars`);
    rawText += '\n\n' + pdfData.text;
  }

  // Get all existing subjects from DB
  const dbSubjects = await prisma.subject.findMany();
  const subjectMap = new Map<string, string>();
  for (const sub of dbSubjects) {
    subjectMap.set(sub.name.toLowerCase(), sub.id);
  }

  console.log('Mapped subjects in DB:', Array.from(subjectMap.keys()));

  // Split text by subject headings
  const subjectSections: { subject: string; text: string }[] = [];
  const subjectHeaderRegex = /(BIOLOGY|CHEMISTRY|PHYSICS|ENGLISH OBJECTIVE|ENGLISH PASSAGE|ENGLISH|MATHEMATICS|GOVERNMENT|ECONOMICS|COMMERCE|LITERATURE|CURRENT AFFAIRS|RELIGIOUS STUDIES|CRK|IRK|GEOLOGY)/gi;

  const matches: { subject: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = subjectHeaderRegex.exec(rawText)) !== null) {
    matches.push({ subject: m[1].toUpperCase(), index: m.index });
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : rawText.length;
    const sectionContent = rawText.slice(current.index, nextIndex);
    subjectSections.push({ subject: current.subject, text: sectionContent });
  }

  console.log(`Split text into ${subjectSections.length} subject sections.`);

  let totalSaved = 0;

  for (const sec of subjectSections) {
    let normSubject = sec.subject;
    if (normSubject.includes('ENGLISH')) normSubject = 'English';
    else if (normSubject.includes('BIOLOGY')) normSubject = 'Biology';
    else if (normSubject.includes('CHEMISTRY')) normSubject = 'Chemistry';
    else if (normSubject.includes('PHYSICS')) normSubject = 'Physics';
    else if (normSubject.includes('MATHEMATICS')) normSubject = 'Mathematics';
    else if (normSubject.includes('GOVERNMENT')) normSubject = 'Government';
    else if (normSubject.includes('ECONOMICS')) normSubject = 'Economics';
    else if (normSubject.includes('COMMERCE')) normSubject = 'Commerce';
    else if (normSubject.includes('LITERATURE')) normSubject = 'Literature';
    else if (normSubject.includes('CRK') || normSubject.includes('IRK') || normSubject.includes('RELIGIOUS')) normSubject = 'CRS';
    else continue;

    const subjectId = subjectMap.get(normSubject.toLowerCase());
    if (!subjectId) continue;

    // Parse questions and passages out of section text
    // Passages/Stories are prefaced by "Read the following...", "Read each...", "A wolf...", "ENGLISH PASSAGE", "Use the poem...", "Use the extract..."
    const questionBlocks = sec.text.split(/(?=\b\d{1,3}\.\s+[A-Za-z\w'“"'\`])/);

    let activePassage: string | null = null;

    for (const block of questionBlocks) {
      // Check if block contains a story or reading passage before the question number
      const storyMatch = block.match(/([\s\S]+?)(?=\b\d{1,3}\.\s+)/i);
      if (storyMatch) {
        const potentialStory = storyMatch[1].trim();
        // Remove question numbers and clean text
        const cleanedStory = potentialStory
          .replace(/^[\s\S]*?(?=Read (?:the|each) passage|ENGLISH PASSAGE|A wolf,|In insects,|Lepidoptera|Farming is|It is customary|It may be argued|You would think|Whenever I have|It was part of|Those who are|When literature|Use the poem|Use the extract)/i, '')
          .trim();

        if (cleanedStory.length > 80 && !/^(?:\d{1,3}\.|\(A\)|[A-E]\.|\(A\))/i.test(cleanedStory)) {
          activePassage = cleanedStory;
        }
      }

      const qMatch = block.match(/^\s*(\d{1,3})\.\s+([\s\S]+?)(?=(?:\(A\)|A\.\s+|\b[A-E]\)\s+))/i);
      if (!qMatch) continue;

      let qText = qMatch[2].trim().replace(/\s+/g, ' ');

      // Clean off passage prefix if included in qText
      if (/Read (?:the|each) passage/i.test(qText)) {
        const parts = qText.split(/Read (?:the|each) passage[\s\S]*?\n/i);
        qText = (parts[parts.length - 1] || qText).trim();
      }

      if (qText.length < 10 || qText.length > 600) continue;

      // Extract options A, B, C, D (and E)
      const optionRegex = /(?:[\(\[]?([A-E])[\.\)\]])\s*([\s\S]+?)(?=(?:[\(\[]?[A-E][\.\)\]]|\b\d{1,3}\.|$))/gi;
      
      let optMatch: RegExpExecArray | null;
      const optionsFound = new Map<string, string>();
      while ((optMatch = optionRegex.exec(block)) !== null) {
        const key = optMatch[1].toUpperCase();
        const val = optMatch[2].trim().replace(/\s+/g, ' ');
        if (val && !optionsFound.has(key) && val.length < 250) {
          optionsFound.set(key, val);
        }
      }

      if (optionsFound.size < 2) continue;

      const options: { id: string; text: string; isCorrect: boolean }[] = [];
      const keys = Array.from(optionsFound.keys()).sort();

      keys.forEach((k, idx) => {
        options.push({
          id: k,
          text: optionsFound.get(k)!,
          isCorrect: idx === 0,
        });
      });

      // Is this a passage/story question?
      const isPassageQuestion = /story|passage|paragraph|author|writer|according to the text|poem|extract|moral/i.test(qText) || (normSubject === 'English' && activePassage !== null);
      const currentPassageToSave = isPassageQuestion ? activePassage : null;

      // Avoid duplicates or update existing questions with passage
      const existing = await prisma.question.findFirst({
        where: {
          subjectId,
          text: qText,
        },
      });

      if (!existing) {
        await prisma.question.create({
          data: {
            subjectId,
            text: qText,
            passage: currentPassageToSave,
            type: 'SINGLE_CHOICE',
            options: options as any,
            difficulty: 'MEDIUM',
            topic: currentPassageToSave ? 'Reading Passage & Story' : `${normSubject} Past Questions`,
            explanation: `Past examination question for ${normSubject}.`,
            status: 'APPROVED',
          },
        });
        totalSaved++;
      } else if (!existing.passage && currentPassageToSave) {
        await prisma.question.update({
          where: { id: existing.id },
          data: { passage: currentPassageToSave, topic: 'Reading Passage & Story' },
        });
      }
    }
  }

  console.log(`\n🎉 Extraction complete! Saved ${totalSaved} new questions into PostgreSQL database.`);

  const finalSubjects = await prisma.subject.findMany({
    include: { _count: { select: { questions: true } } },
  });

  console.log('\n--- Final Questions Per Subject ---');
  for (const s of finalSubjects) {
    console.log(`- ${s.name}: ${s._count.questions} questions`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
