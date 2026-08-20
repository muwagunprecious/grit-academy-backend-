import { Request, Response, NextFunction } from 'express';
import * as paymentService from '../services/payment.service.js';
import prisma from '../lib/prisma.js';
import { BadRequestError } from '../utils/errors.js';

export const initializePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { testId } = req.body;
    const userId = req.user!.id;
    const email = req.user!.email;

    if (!testId) {
      throw new BadRequestError('testId is required');
    }

    const result = await paymentService.initializePaystackPayment(userId, testId, email);

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      throw new BadRequestError('Payment reference is required');
    }

    const purchase = await paymentService.verifyPaystackPayment(reference);

    res.status(200).json({
      status: 'success',
      data: { purchase },
    });
  } catch (error) {
    next(error);
  }
};

export const applyCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, testId } = req.body;
    const userId = req.user!.id;

    if (!code || typeof code !== 'string') {
      throw new BadRequestError('Coupon code is required');
    }

    const cleanCode = code.trim().toLowerCase();

    if (cleanCode !== 'solar') {
      throw new BadRequestError('Invalid coupon code. Please check and try again.');
    }

    // Find a test to associate purchase with if not provided
    let targetTestId = testId;
    if (!targetTestId) {
      const firstTest = await prisma.test.findFirst();
      targetTestId = firstTest?.id;
    }

    if (targetTestId) {
      await prisma.purchase.upsert({
        where: {
          userId_testId: {
            userId,
            testId: targetTestId,
          },
        },
        update: {
          paymentStatus: 'SUCCESS',
          amount: 0,
          paymentRef: `COUPON_SOLAR_${Date.now()}_${userId.slice(-4)}`,
          paymentProvider: 'PROMO_COUPON',
        },
        create: {
          userId,
          testId: targetTestId,
          amount: 0,
          paymentStatus: 'SUCCESS',
          paymentRef: `COUPON_SOLAR_${Date.now()}_${userId.slice(-4)}`,
          paymentProvider: 'PROMO_COUPON',
        },
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Coupon "solar" applied successfully! ₦500 platform fee waived.',
      data: { hasPaidAccessFee: true },
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const purchases = await prisma.purchase.findMany({
      where: { userId },
      include: {
        test: {
          select: {
            title: true,
            coverImage: true,
            price: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: { purchases },
    });
  } catch (error) {
    next(error);
  }
};

// Admin only: get all payments
export const getAllPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payments = await prisma.purchase.findMany({
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        test: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: payments.length,
      data: { payments },
    });
  } catch (error) {
    next(error);
  }
};

// Paystack Webhook Handler
export const handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
    await paymentService.handlePaystackWebhook(req.body, signature);
    res.status(200).json({ status: 'success' });
  } catch (error) {
    // Paystack webhooks require 200 response to acknowledge receipt
    res.status(200).json({ status: 'failed', error: String(error) });
  }
};

export const syncPendingPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.syncPendingPurchases();
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const manualUnlock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, email } = req.body;

    let user = null;
    if (userId) {
      user = await prisma.gritUser.findUnique({ where: { id: userId } });
    } else if (email) {
      user = await prisma.gritUser.findUnique({ where: { email } });
    }

    if (!user) {
      throw new BadRequestError('User not found');
    }

    const firstTest = await prisma.test.findFirst();
    const testId = firstTest?.id || 'cmrus90cf004nc1h0ezrn027p';

    const purchase = await prisma.purchase.upsert({
      where: {
        userId_testId: {
          userId: user.id,
          testId,
        },
      },
      update: {
        paymentStatus: 'SUCCESS',
      },
      create: {
        userId: user.id,
        testId,
        amount: 500,
        paymentStatus: 'SUCCESS',
        paymentRef: `ADMIN_UNLOCKED_${Date.now()}`,
        paymentProvider: 'ADMIN_MANUAL',
      },
    });

    res.status(200).json({
      status: 'success',
      message: `Account access for ${user.firstName} ${user.lastName} (${user.email}) has been manually unlocked by Admin!`,
      data: { purchase },
    });
  } catch (error) {
    next(error);
  }
};
