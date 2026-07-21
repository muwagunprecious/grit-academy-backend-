import { Request, Response, NextFunction } from 'express';
import * as aiService from '../services/ai.service.js';
import prisma from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export const explainQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { questionId, studentAnswerId } = req.body;

    if (!questionId || !studentAnswerId) {
      throw new BadRequestError('questionId and studentAnswerId are required');
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundError('Question not found');
    }

    const explanation = await aiService.getAiExplanation(question, studentAnswerId);

    res.status(200).json({
      status: 'success',
      data: { explanation },
    });
  } catch (error) {
    next(error);
  }
};

export const generateQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, subjectId, pdfId, numQuestions, difficulty } = req.body;

    if (!text || !subjectId) {
      throw new BadRequestError('text and subjectId are required');
    }

    const questions = await aiService.generateQuestionsFromText(
      text,
      subjectId,
      pdfId,
      numQuestions ? Number(numQuestions) : 10,
      difficulty
    );

    res.status(200).json({
      status: 'success',
      results: questions.length,
      data: { questions },
    });
  } catch (error) {
    next(error);
  }
};

export const getStudyPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const plan = await aiService.generatePersonalizedStudyPlan(userId);

    res.status(200).json({
      status: 'success',
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};
