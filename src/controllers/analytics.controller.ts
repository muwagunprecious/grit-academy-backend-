import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';

export const getStudentAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // Total attempts
    const attemptsCount = await prisma.testAttempt.count({
      where: { userId, status: 'COMPLETED' },
    });

    // Average & Highest Score
    const aggregate = await prisma.testAttempt.aggregate({
      where: { userId, status: 'COMPLETED' },
      _avg: { percentage: true },
      _max: { percentage: true },
    });

    const averageScore = aggregate._avg.percentage || 0;
    const highestScore = aggregate._max.percentage || 0;

    // Time spent
    const sumTime = await prisma.testAttempt.aggregate({
      where: { userId, status: 'COMPLETED' },
      _sum: { timeUsed: true },
    });
    const totalTimeSpent = sumTime._sum.timeUsed || 0; // seconds

    // Calculate completions rate
    const totalStarted = await prisma.testAttempt.count({
      where: { userId },
    });
    const completionRate = totalStarted > 0 ? (attemptsCount / totalStarted) * 100 : 0;

    // Analyze weak vs strong topics
    // Fetch attempts
    const attempts = await prisma.testAttempt.findMany({
      where: { userId, status: 'COMPLETED' },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    const topicScores: Record<string, { correct: number; total: number }> = {};
    const subjectScoresMap: Record<string, { name: string; score: number; total: number }> = {};

    attempts.forEach(attempt => {
      const answers = attempt.answers as any[];
      if (!Array.isArray(answers)) return;

      answers.forEach(ans => {
        const topic = ans.topic || 'General';
        if (!topicScores[topic]) {
          topicScores[topic] = { correct: 0, total: 0 };
        }
        topicScores[topic].total += 1;
        if (ans.isCorrect) {
          topicScores[topic].correct += 1;
        }

        // Subject aggregation
        const subId = ans.subjectId;
        // In attempt answers, we saved subjectId
        if (subId) {
          if (!subjectScoresMap[subId]) {
            subjectScoresMap[subId] = { name: ans.subjectName || 'Subject', score: 0, total: 0 };
          }
          subjectScoresMap[subId].total += 1;
          if (ans.isCorrect) {
            subjectScoresMap[subId].score += 1;
          }
        }
      });
    });

    const topicsAnalysis = Object.entries(topicScores).map(([topic, stats]) => ({
      topic,
      percentage: (stats.correct / stats.total) * 100,
    }));

    const weakTopics = topicsAnalysis.filter(t => t.percentage < 60).map(t => t.topic);
    const strongTopics = topicsAnalysis.filter(t => t.percentage >= 75).map(t => t.topic);

    const subjectBreakdown = Object.entries(subjectScoresMap).map(([id, stats]) => ({
      subjectId: id,
      subjectName: stats.name,
      percentage: stats.total > 0 ? (stats.score / stats.total) * 100 : 0,
    }));

    // Progress graph - last 10 scores
    const progress = attempts.map(a => ({
      attemptId: a.id,
      score: a.percentage,
      date: a.completedAt || a.createdAt,
    })).reverse();

    res.status(200).json({
      status: 'success',
      data: {
        stats: {
          attemptsCount,
          averageScore,
          highestScore,
          totalTimeSpent,
          completionRate,
        },
        weakTopics,
        strongTopics,
        subjectBreakdown,
        progress,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Total numbers
    const totalStudents = await prisma.gritUser.count({
      where: { role: 'STUDENT' },
    });

    const totalPurchases = await prisma.purchase.count({
      where: { paymentStatus: 'SUCCESS' },
    });

    const sumRev = await prisma.purchase.aggregate({
      where: { paymentStatus: 'SUCCESS' },
      _sum: { amount: true },
    });
    const totalRevenue = sumRev._sum.amount || 0;

    const questionsGenerated = await prisma.question.count();
    const totalTests = await prisma.test.count();
    const pdfsUploaded = await prisma.pdfDocument.count();

    // Chart: Revenue by month
    // Using GroupBy or fetch all successful transactions and aggregate programmatically
    const purchases = await prisma.purchase.findMany({
      where: { paymentStatus: 'SUCCESS' },
      select: { amount: true, createdAt: true },
    });

    const monthlyRevenue: Record<string, number> = {};
    purchases.forEach(p => {
      const month = p.createdAt.toLocaleString('default', { month: 'short', year: '2-digit' });
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + p.amount;
    });

    const revenueChart = Object.entries(monthlyRevenue).map(([month, amount]) => ({
      name: month,
      revenue: amount,
    }));

    // Top Selling Tests
    const topTests = await prisma.test.findMany({
      select: {
        id: true,
        title: true,
        totalPurchases: true,
        price: true,
      },
      orderBy: { totalPurchases: 'desc' },
      take: 5,
    });

    // Recent signups
    const recentStudents = await prisma.gritUser.findMany({
      where: { role: 'STUDENT' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    res.status(200).json({
      status: 'success',
      data: {
        stats: {
          totalStudents,
          totalPurchases,
          totalRevenue,
          questionsGenerated,
          totalTests,
          pdfsUploaded,
        },
        revenueChart,
        topTests,
        recentStudents,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getTestPurchaseAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { testId } = req.params as { testId: string };

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        _count: {
          select: { purchases: true, attempts: true },
        },
      },
    }) as any;

    if (!test) {
      throw new Error('Test package not found');
    }

    // Purchases for this test
    const purchases = await prisma.purchase.findMany({
      where: { testId, paymentStatus: 'SUCCESS' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Attempts metrics for this test
    const attemptsAggregate = await prisma.testAttempt.aggregate({
      where: { testId, status: 'COMPLETED' },
      _avg: { percentage: true },
      _max: { percentage: true },
      _min: { percentage: true },
    });

    const averageScore = attemptsAggregate._avg.percentage || 0;
    const highestScore = attemptsAggregate._max.percentage || 0;
    const lowestScore = attemptsAggregate._min.percentage || 0;

    // Programmatically calculate pass rates
    const totalAttempts = await prisma.testAttempt.count({
      where: { testId, status: 'COMPLETED' },
    });

    const passCount = await prisma.testAttempt.count({
      where: { testId, status: 'COMPLETED', isPassed: true },
    });

    const passRate = totalAttempts > 0 ? (passCount / totalAttempts) * 100 : 0;

    // Detailed purchaser statistics
    const purchaserList = await Promise.all(
      purchases.map(async p => {
        // User's attempts details
        const userAttempts = await prisma.testAttempt.findMany({
          where: { userId: p.userId, testId, status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
        });

        const attemptsCount = userAttempts.length;
        const highestUserScore = userAttempts.reduce((max, att) => Math.max(max, att.percentage), 0);
        const averageUserScore = attemptsCount > 0 
          ? userAttempts.reduce((sum, att) => sum + att.percentage, 0) / attemptsCount 
          : 0;

        return {
          purchaseId: p.id,
          studentName: `${p.user.firstName} ${p.user.lastName}`,
          email: p.user.email,
          phone: p.user.phone || 'N/A',
          amountPaid: p.amount,
          purchaseDate: p.createdAt,
          paymentRef: p.paymentRef,
          attemptsCount,
          highestScore: highestUserScore,
          averageScore: averageUserScore,
          latestScore: userAttempts[0]?.percentage || null,
          hasPassed: userAttempts.some(a => a.isPassed),
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: {
        testMetadata: {
          id: test.id,
          title: test.title,
          price: test.price,
          totalPurchased: test._count.purchases,
          totalAttempts: test._count.attempts,
          averageScore,
          highestScore,
          lowestScore,
          passRate,
        },
        purchasers: purchaserList,
      },
    });
  } catch (error) {
    next(error);
  }
};
