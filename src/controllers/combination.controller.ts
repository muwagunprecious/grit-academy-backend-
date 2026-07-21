import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export const getCombinations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    const where = isAdmin ? {} : { isActive: true };

    const combinations = await prisma.subjectCombination.findMany({
      where,
      include: {
        subjects: true,
        _count: {
          select: { tests: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      data: { combinations },
    });
  } catch (error) {
    next(error);
  }
};

export const createCombination = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, icon, subjects } = req.body;

    const existing = await prisma.subjectCombination.findUnique({
      where: { name },
    });

    if (existing) {
      throw new BadRequestError(`Combination with name '${name}' already exists`);
    }

    const combination = await prisma.subjectCombination.create({
      data: {
        name,
        description,
        icon,
        subjects: {
          create: subjects?.map((subName: string) => ({ name: subName })) || [],
        },
      },
      include: {
        subjects: true,
      },
    });

    res.status(201).json({
      status: 'success',
      data: { combination },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCombination = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const { name, description, icon, isActive, subjects } = req.body;

    const combination = await prisma.subjectCombination.findUnique({
      where: { id },
    });

    if (!combination) {
      throw new NotFoundError('Subject combination not found');
    }

    // Process subject updates. For simplicity: delete existing subjects, recreate them.
    // If they have dependencies (like questions/pdfs), we should keep them if name matches, delete others.
    // Let's do a smart sync or delete and recreate. Since this is an admin feature:
    if (subjects) {
      await prisma.$transaction([
        // Delete subjects that are not in the new list and have no questions
        prisma.subject.deleteMany({
          where: {
            combinationId: id,
            name: { notIn: subjects },
            questions: { none: {} },
            pdfs: { none: {} },
          },
        }),
        // Add new subjects
        ...subjects.map((subName: string) =>
          prisma.subject.upsert({
            where: { name_combinationId: { name: subName, combinationId: id } },
            create: { name: subName, combinationId: id },
            update: {},
          })
        ),
      ]);
    }

    const updated = await prisma.subjectCombination.update({
      where: { id },
      data: {
        name,
        description,
        icon,
        isActive,
      },
      include: {
        subjects: true,
      },
    });

    res.status(200).json({
      status: 'success',
      data: { combination: updated },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCombination = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };

    const combination = await prisma.subjectCombination.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tests: true },
        },
      },
    }) as any;

    if (!combination) {
      throw new NotFoundError('Subject combination not found');
    }

    if (combination._count.tests > 0) {
      throw new BadRequestError('Cannot delete combination because it has associated tests');
    }

    await prisma.subjectCombination.delete({
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
