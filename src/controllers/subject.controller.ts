import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export const getSubjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: {
        _count: {
          select: { questions: true, pdfs: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      results: subjects.length,
      data: { subjects },
    });
  } catch (error) {
    next(error);
  }
};

export const createSubject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, combinationId } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new BadRequestError('Subject name is required');
    }

    const trimmedName = name.trim();

    const existing = await prisma.subject.findFirst({
      where: { name: { equals: trimmedName, mode: 'insensitive' } },
    });

    if (existing) {
      throw new BadRequestError(`Subject '${trimmedName}' already exists`);
    }

    let targetCombId = combinationId;

    if (!targetCombId) {
      let defaultComb = await prisma.subjectCombination.findFirst({
        where: { name: 'General' },
      });

      if (!defaultComb) {
        defaultComb = await prisma.subjectCombination.create({
          data: {
            name: 'General',
            description: 'General Subject Repository',
            icon: 'BookOpen',
          },
        });
      }
      targetCombId = defaultComb.id;
    }

    const subject = await prisma.subject.create({
      data: {
        name: trimmedName,
        combinationId: targetCombId,
      },
      include: {
        _count: {
          select: { questions: true, pdfs: true },
        },
      },
    });

    res.status(201).json({
      status: 'success',
      data: { subject },
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const { name } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new BadRequestError('Subject name is required');
    }

    const subject = await prisma.subject.findUnique({
      where: { id },
    });

    if (!subject) {
      throw new NotFoundError('Subject not found');
    }

    const updated = await prisma.subject.update({
      where: { id },
      data: { name: name.trim() },
      include: {
        _count: {
          select: { questions: true, pdfs: true },
        },
      },
    });

    res.status(200).json({
      status: 'success',
      data: { subject: updated },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSubject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };

    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        _count: {
          select: { questions: true, pdfs: true },
        },
      },
    });

    if (!subject) {
      throw new NotFoundError('Subject not found');
    }

    if (subject._count.questions > 0 || subject._count.pdfs > 0) {
      throw new BadRequestError('Cannot delete subject with associated questions or PDF files');
    }

    await prisma.subject.delete({
      where: { id },
    });

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
