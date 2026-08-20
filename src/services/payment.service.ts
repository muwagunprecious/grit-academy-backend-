import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || 'sk_test_fed535e8c2a8cac2ddfa2959181df64c87517f44';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export const initializePaystackPayment = async (userId: string, testId: string, email: string) => {
  const test = await prisma.test.findUnique({
    where: { id: testId },
  });

  if (!test) {
    throw new NotFoundError('Test package not found');
  }

  // Check if already successfully purchased
  const existingPurchase = await prisma.purchase.findUnique({
    where: {
      userId_testId: { userId, testId },
    },
  });

  if (existingPurchase && existingPurchase.paymentStatus === 'SUCCESS') {
    return {
      authorization_url: `${FRONTEND_URL}/dashboard/tests/${testId}?status=success`,
      reference: existingPurchase.paymentRef,
      isFree: false,
      alreadyPurchased: true,
    };
  }

  // Mandatory ₦500.00 platform access fee = 50,000 kobo
  const amountInKobo = 50000;
  const paymentRef = `grit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Call Paystack API to initialize ₦500 payment
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: amountInKobo,
      reference: paymentRef,
      callback_url: `${FRONTEND_URL}/dashboard`,
      metadata: {
        userId,
        testId,
      },
    }),
  });

  const data = await response.json();
  if (!data.status) {
    throw new Error(`Paystack error: ${data.message}`);
  }

  // Create pending purchase record
  await prisma.purchase.upsert({
    where: { userId_testId: { userId, testId } },
    create: {
      userId,
      testId,
      amount: test.price,
      paymentRef,
      paymentProvider: 'paystack',
      paymentStatus: 'PENDING',
    },
    update: {
      paymentStatus: 'PENDING',
      paymentRef,
      amount: test.price,
    },
  });

  return {
    authorization_url: data.data.authorization_url,
    reference: paymentRef,
    isFree: false,
  };
};

export const verifyPaystackPayment = async (reference: string) => {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
    },
  });

  const data = await response.json();

  if (!data.status) {
    throw new BadRequestError(`Paystack verification failed: ${data.message}`);
  }

  const { status, metadata, customer, amount } = data.data;

  if (status === 'success') {
    let targetUserId = metadata?.userId;
    let targetTestId = metadata?.testId;

    // 1. Try finding purchase by paymentRef first
    let purchase = await prisma.purchase.findFirst({
      where: { paymentRef: reference },
    });

    // 2. If purchase not found by reference, try finding user by metadata or customer email
    if (!purchase && !targetUserId && customer?.email) {
      const user = await prisma.gritUser.findUnique({
        where: { email: customer.email },
      });
      if (user) {
        targetUserId = user.id;
      }
    }

    if (!targetTestId) {
      const firstTest = await prisma.test.findFirst();
      targetTestId = firstTest?.id;
    }

    if (purchase) {
      purchase = await prisma.purchase.update({
        where: { id: purchase.id },
        data: { paymentStatus: 'SUCCESS' },
      });
      targetUserId = purchase.userId;
      targetTestId = purchase.testId;
    } else if (targetUserId && targetTestId) {
      purchase = await prisma.purchase.upsert({
        where: {
          userId_testId: {
            userId: targetUserId,
            testId: targetTestId,
          },
        },
        update: {
          paymentStatus: 'SUCCESS',
          paymentRef: reference,
        },
        create: {
          userId: targetUserId,
          testId: targetTestId,
          amount: amount ? amount / 100 : 500,
          paymentStatus: 'SUCCESS',
          paymentRef: reference,
          paymentProvider: 'paystack',
        },
      });
    } else {
      throw new NotFoundError('Purchase or associated user account not found');
    }

    // Safely increment purchase count on test if test exists
    if (targetTestId) {
      try {
        await prisma.test.update({
          where: { id: targetTestId },
          data: { totalPurchases: { increment: 1 } },
        });
      } catch (err) {
        console.warn('Could not increment test totalPurchases:', err);
      }
    }

    // Create notification for student
    if (targetUserId) {
      try {
        await prisma.notification.create({
          data: {
            userId: targetUserId,
            title: 'Payment Successful',
            message: 'Your platform access fee has been verified. Permanent access unlocked!',
            type: 'PAYMENT',
            link: targetTestId ? `/dashboard/tests/${targetTestId}` : '/dashboard',
          },
        });
      } catch (err) {
        console.warn('Could not create payment notification:', err);
      }
    }

    return purchase;
  } else {
    try {
      await prisma.purchase.updateMany({
        where: { paymentRef: reference },
        data: { paymentStatus: 'FAILED' },
      });
    } catch (e) {}
    throw new BadRequestError('Payment was not successful');
  }
};

export const handlePaystackWebhook = async (payload: any, signature?: string) => {
  if (signature) {
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(JSON.stringify(payload)).digest('hex');
    if (hash !== signature) {
      throw new BadRequestError('Invalid Paystack signature');
    }
  }

  const { event, data } = payload;
  if (event === 'charge.success') {
    const reference = data?.reference;
    if (reference) {
      await verifyPaystackPayment(reference);
    }
  }
  return { status: 'success' };
};

export const syncPendingPurchases = async () => {
  const pendingPurchases = await prisma.purchase.findMany({
    where: { paymentStatus: 'PENDING' },
  });

  let syncedCount = 0;
  for (const purchase of pendingPurchases) {
    try {
      await verifyPaystackPayment(purchase.paymentRef);
      syncedCount++;
    } catch (e) {
      // If verification fails or is incomplete, skip to next
    }
  }

  return { syncedCount, totalPending: pendingPurchases.length };
};
