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
