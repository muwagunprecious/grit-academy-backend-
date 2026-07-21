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
