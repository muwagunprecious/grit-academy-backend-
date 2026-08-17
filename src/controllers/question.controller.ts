import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export const getQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subjectId, difficulty, status, search, topic, page = 1, limit = 100 } = req.query;

    const isAll = limit === 'all' || Number(limit) >= 5000;
    const pageNum = Math.max(1, Number(page));
    const limitNum = isAll ? 10000 : Math.max(1, Number(limit));
    const skip = isAll ? undefined : (pageNum - 1) * limitNum;
    const take = isAll ? undefined : limitNum;

    const where: any = {};
    if (subjectId) where.subjectId = subjectId as string;
    if (difficulty) where.difficulty = difficulty as any;
    if (status) where.status = status as any;
    if (topic) where.topic = topic as string;
    if (search) {
      where.text = { contains: search as string, mode: 'insensitive' };
    }

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        include: {
          subject: {
            select: { name: true, combination: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.question.count({ where }),
    ]);

    res.status(200).json({
      status: 'success',
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
      data: { questions },
    });
  } catch (error) {
    next(error);
  }
};

export const createQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, type, options, explanation, subjectId, topic, difficulty, marks, estimatedTime, bloomTaxonomy, tags, imageUrl } = req.body;

    const question = await prisma.question.create({
      data: {
        text,
        type,
        options, // Json field
        explanation,
        subjectId,
        topic,
        difficulty,
        marks: marks ? Number(marks) : 1,
        estimatedTime: estimatedTime ? Number(estimatedTime) : undefined,
        bloomTaxonomy,
        tags: tags || [],
        imageUrl,
        isApproved: true,
        status: 'APPROVED',
      },
    });

    res.status(201).json({
      status: 'success',
      data: { question },
    });
  } catch (error) {
    next(error);
  }
};

export const updateQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const { text, type, options, explanation, subjectId, topic, difficulty, marks, estimatedTime, bloomTaxonomy, tags, imageUrl, status } = req.body;

    const question = await prisma.question.findUnique({
      where: { id },
    });

    if (!question) {
      throw new NotFoundError('Question not found');
    }

    const updated = await prisma.question.update({
      where: { id },
      data: {
        text,
        type,
        options,
        explanation,
        subjectId,
        topic,
        difficulty,
        marks: marks ? Number(marks) : undefined,
        estimatedTime: estimatedTime ? Number(estimatedTime) : undefined,
        bloomTaxonomy,
        tags,
        imageUrl,
        status,
        isApproved: status === 'APPROVED' ? true : status === 'REJECTED' ? false : undefined,
      },
    });

    res.status(200).json({
      status: 'success',
      data: { question: updated },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };

    const question = await prisma.question.findUnique({
      where: { id },
    });

    if (!question) {
      throw new NotFoundError('Question not found');
    }

    await prisma.question.delete({
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

export const approveQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };

    const question = await prisma.question.update({
      where: { id },
      data: {
        status: 'APPROVED',
        isApproved: true,
      },
    });

    res.status(200).json({
      status: 'success',
      data: { question },
    });
  } catch (error) {
    next(error);
  }
};

export const rejectQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };

    const question = await prisma.question.update({
      where: { id },
      data: {
        status: 'REJECTED',
        isApproved: false,
      },
    });

    res.status(200).json({
      status: 'success',
      data: { question },
    });
  } catch (error) {
    next(error);
  }
};

export const toggleBookmark = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user!.id;

    const question = await prisma.question.findUnique({
      where: { id },
    });

    if (!question) {
      throw new NotFoundError('Question not found');
    }

    const existingBookmark = await prisma.bookmark.findUnique({
      where: {
        userId_questionId: { userId, questionId: id },
      },
    });

    let bookmarked = false;

    if (existingBookmark) {
      await prisma.bookmark.delete({
        where: {
          userId_questionId: { userId, questionId: id },
        },
      });
    } else {
      await prisma.bookmark.create({
        data: {
          userId,
          questionId: id,
        },
      });
      bookmarked = true;
    }

    res.status(200).json({
      status: 'success',
      data: { bookmarked },
    });
  } catch (error) {
    next(error);
  }
};

export const getBookmarks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const bookmarks = await prisma.bookmark.findMany({
      where: { userId },
      include: {
        question: {
          include: {
            subject: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: { bookmarks },
    });
  } catch (error) {
    next(error);
  }
};
