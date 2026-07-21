import prisma from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || 'sk_test_placeholder';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export const initializePaystackPayment = async (userId: string, testId: string, email: string) => {
  const test = await prisma.test.findUnique({
    where: { id: testId },
  });

  if (!test) {
    throw new NotFoundError('Test package not found');
  }

  // Check if already purchased
  const existingPurchase = await prisma.purchase.findUnique({
    where: {
      userId_testId: { userId, testId },
    },
  });

  if (existingPurchase && existingPurchase.paymentStatus === 'SUCCESS') {
    throw new BadRequestError('You have already purchased this test package');
  }

  const amountInKobo = Math.round(test.price * 100);
  const paymentRef = `grit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // If amount is 0, we can grant access for free immediately!
  if (amountInKobo === 0) {
    const purchase = await prisma.purchase.upsert({
      where: { userId_testId: { userId, testId } },
      create: {
        userId,
        testId,
        amount: 0,
        paymentRef,
        paymentProvider: 'free',
        paymentStatus: 'SUCCESS',
      },
      update: {
        paymentStatus: 'SUCCESS',
        paymentRef,
      },
    });

    return {
      authorization_url: `${FRONTEND_URL}/dashboard/tests/${testId}?status=success`,
      reference: paymentRef,
      isFree: true,
    };
  }

  // Call Paystack API
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
      callback_url: `${FRONTEND_URL}/dashboard/tests/${testId}`,
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

  const { status, metadata, amount } = data.data;

  if (status === 'success') {
    const userId = metadata.userId;
    const testId = metadata.testId;

    // Update purchase in DB
    const purchase = await prisma.purchase.update({
      where: {
        paymentRef: reference,
      },
      data: {
        paymentStatus: 'SUCCESS',
      },
    });

    // Increment purchase count on Test
    await prisma.test.update({
      where: { id: testId },
      data: {
        totalPurchases: { increment: 1 },
      },
    });

    // Create notification for student
    await prisma.notification.create({
      data: {
        userId,
        title: 'Payment Successful',
        message: 'Your test package has been unlocked permanent access.',
        type: 'PAYMENT',
        link: `/dashboard/tests/${testId}`,
      },
    });

    return purchase;
  } else {
    await prisma.purchase.update({
      where: { paymentRef: reference },
      data: { paymentStatus: 'FAILED' },
    });
    throw new BadRequestError('Payment was not successful');
  }
};
