import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export const startAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { testId } = req.body;
    const userId = req.user!.id;

    if (!testId) {
      throw new BadRequestError('testId is required');
    }

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        purchases: {
          where: { userId, paymentStatus: 'SUCCESS' },
        },
        questions: {
          include: {
            question: {
              select: {
                id: true,
                text: true,
                type: true,
                options: true,
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
    });

    if (!test) {
      throw new NotFoundError('Test package not found');
    }

    // Check if test is purchased (unless user is ADMIN)
    const isPurchased = test.purchases.length > 0;
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';

    if (!isPurchased && !isAdmin) {
      throw new BadRequestError('You must purchase this test package to start the exam');
    }

    // Check maximum attempts limit
    if (test.maxAttempts) {
      const pastAttemptsCount = await prisma.testAttempt.count({
        where: { userId, testId, status: 'COMPLETED' },
      });
      if (pastAttemptsCount >= test.maxAttempts) {
        throw new BadRequestError(`You have reached the maximum allowed attempts (${test.maxAttempts}) for this test.`);
      }
    }

    // Create new attempt
    const attempt = await prisma.testAttempt.create({
      data: {
        userId,
        testId,
        answers: [],
        totalTime: test.duration * 60, // store in seconds
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    // Format questions (strip correct answers for security)
    const formattedQuestions = test.questions.map((q: any) => {
      // Options are stored as Json: [ {id, text, isCorrect} ]
      // Strip isCorrect field so students cannot inspect payload to find answers
      const rawOptions = q.question.options as any[];
      const safeOptions = rawOptions.map(o => ({ id: o.id, text: o.text }));

      return {
        id: q.question.id,
        order: q.order,
        text: q.question.text,
        type: q.question.type,
        options: safeOptions,
        subjectId: q.question.subjectId,
        topic: q.question.topic,
        difficulty: q.question.difficulty,
        imageUrl: q.question.imageUrl,
      };
    });

    res.status(201).json({
      status: 'success',
      data: {
        attemptId: attempt.id,
        duration: test.duration, // minutes
        questions: formattedQuestions,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const startCustomAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subjectIds, duration = 30, questionsPerSubject = 10 } = req.body;
    const userId = req.user!.id;

    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
      throw new BadRequestError('At least one subject must be selected');
    }

    if (subjectIds.length > 5) {
      throw new BadRequestError('You can select a maximum of 5 subjects for a test');
    }

    // Enforce 30-minute maximum limit
    const actualDuration = Math.min(30, Math.max(5, Number(duration) || 30));

    // Fetch subjects details
    const subjects = await prisma.subject.findMany({
      where: { id: { in: subjectIds } },
    });

    if (subjects.length === 0) {
      throw new BadRequestError('Selected subjects were not found');
    }

    // Fetch questions for each subject
    let allQuestions: any[] = [];
    let orderIndex = 1;

    for (const sub of subjects) {
      const questions = await prisma.question.findMany({
        where: {
          subjectId: sub.id,
          status: 'APPROVED',
        },
        take: Number(questionsPerSubject) || 10,
        orderBy: { createdAt: 'desc' },
      });

      // If no approved questions, fall back to any available questions
      let finalSubjectQuestions = questions;
      if (finalSubjectQuestions.length === 0) {
        finalSubjectQuestions = await prisma.question.findMany({
          where: { subjectId: sub.id },
          take: Number(questionsPerSubject) || 10,
          orderBy: { createdAt: 'desc' },
        });
      }

      for (const q of finalSubjectQuestions) {
        allQuestions.push({
          order: orderIndex++,
          question: q,
          subjectName: sub.name,
        });
      }
    }

    if (allQuestions.length === 0) {
      throw new BadRequestError('No questions found for the selected subjects. Please ensure questions are uploaded.');
    }

    // Check or create default combination for custom test
    let customComb = await prisma.subjectCombination.findFirst({
      where: { name: 'Custom Practice' },
    });

    if (!customComb) {
      customComb = await prisma.subjectCombination.create({
        data: {
          name: 'Custom Practice',
          description: 'Dynamic student multi-subject exam',
        },
      });
    }

    // Create dynamic test container
    const testTitle = `${subjects.map((s: any) => s.name).join(', ')} Practice Exam`;
    const test = await prisma.test.create({
      data: {
        title: testTitle,
        description: `Custom CBT exam with ${subjects.length} subjects`,
        combinationId: customComb.id,
        price: 0,
        duration: actualDuration,
        totalQuestions: allQuestions.length,
        isPublished: true,
      },
    });

    // Link test questions
    await prisma.testQuestion.createMany({
      data: allQuestions.map(q => ({
        testId: test.id,
        questionId: q.question.id,
        order: q.order,
      })),
    });

    // Create attempt
    const attempt = await prisma.testAttempt.create({
      data: {
        userId,
        testId: test.id,
        answers: [],
        totalTime: actualDuration * 60,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    // Format safe questions (strip answer keys)
    const formattedQuestions = allQuestions.map(item => {
      const q = item.question;
      const rawOptions = (q.options as any[]) || [];
      const safeOptions = rawOptions.map(o => ({ id: o.id, text: o.text }));

      return {
        id: q.id,
        order: item.order,
        text: q.text,
        type: q.type,
        options: safeOptions,
        subjectId: q.subjectId,
        subjectName: item.subjectName,
        topic: q.topic,
        difficulty: q.difficulty,
        imageUrl: q.imageUrl,
      };
    });

    res.status(201).json({
      status: 'success',
      data: {
        attemptId: attempt.id,
        duration: actualDuration,
        subjects: subjects.map((s: any) => ({ id: s.id, name: s.name })),
        questions: formattedQuestions,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const saveAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const { answers, timeUsed } = req.body;

    const attempt = await prisma.testAttempt.findUnique({
      where: { id },
    });

    if (!attempt) {
      throw new NotFoundError('Attempt not found');
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestError('This attempt has already been submitted or closed');
    }

    const updated = await prisma.testAttempt.update({
      where: { id },
      data: {
        answers, // JSON array: [{questionId, selectedOptionId, timeTaken}]
        timeUsed: timeUsed ? Number(timeUsed) : attempt.timeUsed,
      },
    });

    res.status(200).json({
      status: 'success',
      message: 'Answers auto-saved successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const submitAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const { answers, timeUsed } = req.body;

    const attempt = await prisma.testAttempt.findUnique({
      where: { id },
      include: {
        test: {
          include: {
            questions: {
              include: {
                question: {
                  include: {
                    subject: true,
                  },
                },
              },
            },
          },
        },
      },
    }) as any;

    if (!attempt) {
      throw new NotFoundError('Attempt not found');
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestError('This attempt has already been submitted');
    }

    const finalAnswers = answers || attempt.answers || [];
    const finalTimeUsed = timeUsed !== undefined ? Number(timeUsed) : attempt.timeUsed;

    const testQuestions = attempt.test.questions;
    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;

    // We'll track subject-specific breakdown
    const subjectMetrics: Record<string, { name: string; correct: number; total: number; marks: number; totalMarks: number }> = {};

    // Analyze each answer
    const analyzedAnswers = testQuestions.map((tq: any) => {
      const q = tq.question;
      const studentAns = (finalAnswers as any[]).find(a => a.questionId === q.id);
      
      const rawOptions = q.options as any[];
      const correctOption = rawOptions.find(o => o.isCorrect);
      
      const selectedOptionId = studentAns?.selectedOptionId || null;
      const isCorrect = selectedOptionId ? selectedOptionId === correctOption?.id : false;

      // Subject metrics initialization
      if (!subjectMetrics[q.subjectId]) {
        subjectMetrics[q.subjectId] = {
          name: q.subject.name,
          correct: 0,
          total: 0,
          marks: 0,
          totalMarks: 0,
        };
      }

      subjectMetrics[q.subjectId].total += 1;
      subjectMetrics[q.subjectId].totalMarks += q.marks;

      let marksEarned = 0;

      if (!selectedOptionId) {
        skippedCount += 1;
      } else if (isCorrect) {
        correctCount += 1;
        marksEarned = q.marks;
        score += q.marks;
        subjectMetrics[q.subjectId].correct += 1;
        subjectMetrics[q.subjectId].marks += q.marks;
      } else {
        wrongCount += 1;
        // Negative marking
        if (attempt.test.negativeMarking) {
          marksEarned = -attempt.test.negativeScore;
          score -= attempt.test.negativeScore;
          subjectMetrics[q.subjectId].marks -= attempt.test.negativeScore;
        }
      }

      return {
        questionId: q.id,
        selectedOptionId,
        correctOptionId: correctOption?.id,
        isCorrect,
        timeTaken: studentAns?.timeTaken || 0,
        marksEarned,
        subjectId: q.subjectId,
        topic: q.topic,
      };
    });

    // Format subject breakdown JSON
    const subjectScores = Object.entries(subjectMetrics).map(([subjectId, metrics]) => ({
      subjectId,
      subjectName: metrics.name,
      correctCount: metrics.correct,
      totalCount: metrics.total,
      score: metrics.marks,
      totalMarks: metrics.totalMarks,
      percentage: metrics.totalMarks > 0 ? (metrics.marks / metrics.totalMarks) * 100 : 0,
    }));

    // Calculate overall percentage
    const maxPossibleScore = testQuestions.reduce((acc: number, curr: any) => acc + curr.question.marks, 0);
    // Score cannot be less than 0
    const finalScore = Math.max(0, score);
    const percentage = maxPossibleScore > 0 ? (finalScore / maxPossibleScore) * 100 : 0;
    const isPassed = percentage >= attempt.test.passingScore;

    // Update attempt record
    const updatedAttempt = await prisma.testAttempt.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        answers: analyzedAnswers, // store complete analysis
        score: finalScore,
        percentage,
        correctCount,
        wrongCount,
        skippedCount,
        timeUsed: finalTimeUsed,
        isPassed,
        subjectScores,
        completedAt: new Date(),
      },
    });

    // Check for achievements
    // Simple mock unlock: unlock first exam completed achievement
    const completedCount = await prisma.testAttempt.count({
      where: { userId: attempt.userId, status: 'COMPLETED' },
    });

    if (completedCount === 1) {
      const achievement = await prisma.achievement.findFirst({
        where: { name: 'First Steps' },
      });
      if (achievement) {
        await prisma.userAchievement.upsert({
          where: {
            userId_achievementId: {
              userId: attempt.userId,
              achievementId: achievement.id,
            },
          },
          create: {
            userId: attempt.userId,
            achievementId: achievement.id,
          },
          update: {},
        });
      }
    }

    res.status(200).json({
      status: 'success',
      data: { attempt: updatedAttempt },
    });
  } catch (error) {
    next(error);
  }
};

export const getAttemptById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user!.id;
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';

    const attempt = await prisma.testAttempt.findUnique({
      where: { id },
      include: {
        test: {
          select: {
            title: true,
            coverImage: true,
            passingScore: true,
            negativeMarking: true,
            negativeScore: true,
            questions: {
              include: {
                question: true,
              },
            },
          },
        },
      },
    }) as any;

    if (!attempt) {
      throw new NotFoundError('Attempt not found');
    }

    if (attempt.userId !== userId && !isAdmin) {
      throw new BadRequestError('Access denied to this test result');
    }

    // Attach full details. For corrections: we need questions with explanations.
    const questionsWithAnswers = attempt.test.questions.map((tq: any) => {
      const q = tq.question;
      const studentAns = (attempt.answers as any[]).find(a => a.questionId === q.id);

      return {
        id: q.id,
        text: q.text,
        type: q.type,
        options: q.options, // Contains correct answer details
        explanation: q.explanation,
        selectedOptionId: studentAns?.selectedOptionId || null,
        isCorrect: studentAns?.isCorrect || false,
        timeTaken: studentAns?.timeTaken || 0,
        subjectId: q.subjectId,
        topic: q.topic,
        difficulty: q.difficulty,
        imageUrl: q.imageUrl,
      };
    });

    const responseData = {
      ...attempt,
      testTitle: attempt.test.title,
      coverImage: attempt.test.coverImage,
      passingScore: attempt.test.passingScore,
      questions: questionsWithAnswers,
    };

    res.status(200).json({
      status: 'success',
      data: { result: responseData },
    });
  } catch (error) {
    next(error);
  }
};

export const getAttemptsForTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { testId } = req.params as { testId: string };
    const userId = req.user!.id;

    const attempts = await prisma.testAttempt.findMany({
      where: {
        userId,
        testId,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: attempts.length,
      data: { attempts },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUserAttempts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const attempts = await prisma.testAttempt.findMany({
      where: {
        userId,
        status: 'COMPLETED',
      },
      include: {
        test: {
          select: {
            title: true,
            passingScore: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: attempts.length,
      data: { attempts },
    });
  } catch (error) {
    next(error);
  }
};
