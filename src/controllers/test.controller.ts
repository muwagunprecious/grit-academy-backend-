import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export const getTests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { combinationId, difficulty, search } = req.query;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';

    const where: any = {};
    if (!isAdmin) {
      where.isPublished = true;
    }
    if (combinationId) {
      where.combinationId = combinationId as string;
    }
    if (difficulty) {
      where.difficulty = difficulty as any;
    }
    if (search) {
      where.title = { contains: search as string, mode: 'insensitive' };
    }

    const tests = await prisma.test.findMany({
      where,
      include: {
        combination: {
          select: {
            name: true,
            subjects: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: { questions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // If student is logged in, attach purchase status
    let purchasedTestIds: string[] = [];
    if (userId && !isAdmin) {
      const purchases = await prisma.purchase.findMany({
        where: {
          userId,
          paymentStatus: 'SUCCESS',
        },
        select: { testId: true },
      });
      purchasedTestIds = purchases.map((p: any) => p.testId);
    }

    const formattedTests = tests.map((test: any) => ({
      ...test,
      isPurchased: test.price === 0 || purchasedTestIds.includes(test.id),
    }));

    res.status(200).json({
      status: 'success',
      results: formattedTests.length,
      data: { tests: formattedTests },
    });
  } catch (error) {
    next(error);
  }
};

export const getTestById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';

    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        combination: {
          select: {
            name: true,
            subjects: {
              select: { id: true, name: true },
            },
          },
        },
        questions: {
          include: {
            question: {
              select: {
                id: true,
                text: true,
                type: true,
                options: true,
                explanation: true,
                subjectId: true,
                topic: true,
                difficulty: true,
                imageUrl: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    }) as any;

    if (!test) {
      throw new NotFoundError('Test package not found');
    }

    if (!test.isPublished && !isAdmin) {
      throw new NotFoundError('Test package not found');
    }

    // Check if purchased
    let isPurchased = false;
    let attemptsCount = 0;

    if (userId && !isAdmin) {
      const purchase = await prisma.purchase.findUnique({
        where: {
          userId_testId: { userId, testId: id },
        },
      });
      isPurchased = purchase?.paymentStatus === 'SUCCESS';

      attemptsCount = await prisma.testAttempt.count({
        where: { userId, testId: id, status: 'COMPLETED' },
      });
    }

    // Prepare response. If not purchased and not admin, hide full question details (options, correct answer, explanation, text)
    // and only show metadata and question counts.
    let responseData: any = { ...test, isPurchased, attemptsCount };

    if (!isPurchased && !isAdmin) {
      // Return metadata only
      responseData.questions = test.questions.map((q: any, idx: number) => ({
        id: q.question.id,
        order: q.order,
        subjectId: q.question.subjectId,
        difficulty: q.question.difficulty,
        type: q.question.type,
        // do not send text, options, explanation
      }));
    } else {
      // Purchased or Admin: return questions with options
      responseData.questions = test.questions.map((q: any) => ({
        id: q.question.id,
        order: q.order,
        text: q.question.text,
        type: q.question.type,
        options: q.question.options,
        explanation: isAdmin ? q.question.explanation : undefined, // Hide explanation during exam
        subjectId: q.question.subjectId,
        topic: q.question.topic,
        difficulty: q.question.difficulty,
        imageUrl: q.question.imageUrl,
      }));
    }

    res.status(200).json({
      status: 'success',
      data: { test: responseData },
    });
  } catch (error) {
    next(error);
  }
};

export const createTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, combinationId, price, duration, passingScore, difficulty, instructions, negativeMarking, negativeScore, maxAttempts, coverImage, startTime, endTime } = req.body;

    const test = await prisma.test.create({
      data: {
        title,
        description,
        combinationId,
        price: Number(price),
        duration: Number(duration),
        passingScore: passingScore ? Number(passingScore) : 50,
        difficulty,
        instructions,
        negativeMarking: !!negativeMarking,
        negativeScore: negativeScore ? Number(negativeScore) : 0,
        maxAttempts: maxAttempts ? Number(maxAttempts) : null,
        coverImage,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
      },
    });

    res.status(201).json({
      status: 'success',
      data: { test },
    });
  } catch (error) {
    next(error);
  }
};

export const updateTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const { title, description, combinationId, price, duration, passingScore, difficulty, instructions, negativeMarking, negativeScore, maxAttempts, coverImage, isPublished, startTime, endTime } = req.body;

    const test = await prisma.test.findUnique({
      where: { id },
    });

    if (!test) {
      throw new NotFoundError('Test not found');
    }

    const updated = await prisma.test.update({
      where: { id },
      data: {
        title,
        description,
        combinationId,
        price: price !== undefined ? Number(price) : undefined,
        duration: duration !== undefined ? Number(duration) : undefined,
        passingScore: passingScore !== undefined ? Number(passingScore) : undefined,
        difficulty,
        instructions,
        negativeMarking,
        negativeScore: negativeScore !== undefined ? Number(negativeScore) : undefined,
        maxAttempts: maxAttempts !== undefined ? Number(maxAttempts) : undefined,
        coverImage,
        isPublished,
        publishDate: isPublished && !test.isPublished ? new Date() : undefined,
        startTime: startTime !== undefined ? (startTime ? new Date(startTime) : null) : undefined,
        endTime: endTime !== undefined ? (endTime ? new Date(endTime) : null) : undefined,
      },
    });

    res.status(200).json({
      status: 'success',
      data: { test: updated },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };

    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    }) as any;

    if (!test) {
      throw new NotFoundError('Test not found');
    }

    if (test._count.purchases > 0) {
      throw new BadRequestError('Cannot delete test because it has already been purchased by students');
    }

    await prisma.test.delete({
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

export const setTestQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const { questionIds } = req.body; // Array of question IDs in order

    const test = await prisma.test.findUnique({
      where: { id },
    });

    if (!test) {
      throw new NotFoundError('Test not found');
    }

    if (!Array.isArray(questionIds)) {
      throw new BadRequestError('questionIds must be an array of strings');
    }

    await prisma.testQuestion.deleteMany({
      where: { testId: id },
    });

    if (questionIds.length > 0) {
      await prisma.testQuestion.createMany({
        data: questionIds.map((qId: string, index: number) => ({
          testId: id,
          questionId: qId,
          order: index + 1,
        })),
      });
    }

    await prisma.test.update({
      where: { id },
      data: {
        totalQuestions: questionIds.length,
      },
    });

    res.status(200).json({
      status: 'success',
      message: 'Questions updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const publishTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };

    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        questions: true,
      },
    }) as any;

    if (!test) {
      throw new NotFoundError('Test not found');
    }

    if (test.questions.length === 0) {
      throw new BadRequestError('Cannot publish a test with zero questions');
    }

    const updated = await prisma.test.update({
      where: { id },
      data: {
        isPublished: true,
        publishDate: new Date(),
      },
    });

    res.status(200).json({
      status: 'success',
      data: { test: updated },
    });
  } catch (error) {
    next(error);
  }
};
