import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { BadRequestError, UnauthorizedError } from '../utils/errors.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key';
const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

interface UserPayload {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

export const generateTokens = (user: UserPayload) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY } as any
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY } as any
  );

  return { accessToken, refreshToken };
};

export const registerUser = async (data: any) => {
  const { email, password, firstName, lastName, phone, school, class: userClass, state, referralCode } = data;

  if (!email || !password || !firstName || !lastName) {
    throw new BadRequestError('Email, password, first name and last name are required');
  }

  // Referral code validation: Accepted codes are "hydrogen" and "ethyl"
  const VALID_REFERRAL_CODES = ['hydrogen', 'ethyl'];
  let validReferralCode: string | null = null;
  if (referralCode && typeof referralCode === 'string' && referralCode.trim() !== '') {
    const cleanRef = referralCode.trim().toLowerCase();
    if (!VALID_REFERRAL_CODES.includes(cleanRef)) {
      throw new BadRequestError('Invalid referral code. Please check and try again.');
    }
    validReferralCode = cleanRef;
  }

  const existingUser = await prisma.gritUser.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new BadRequestError('User with this email already exists');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Make admin@gritacademy.com a SUPER_ADMIN automatically
  let role: 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN' = 'STUDENT';
  if (email.toLowerCase() === 'admin@gritacademy.com') role = 'SUPER_ADMIN';

  const user = await prisma.gritUser.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      school,
      class: userClass,
      state,
      referralCode: validReferralCode,
      role,
    },
  });

  // Track referral in AuditLog for detailed reporting
  if (validReferralCode) {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_REFERRED',
        entity: 'GritUser',
        entityId: user.id,
        details: { referralCode: validReferralCode },
      },
    });
  }

  const tokens = generateTokens(user);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt,
    },
  });

  const successfulPurchasesCount = await prisma.purchase.count({
    where: { userId: user.id, paymentStatus: 'SUCCESS' },
  });
  const hasPaidAccessFee = user.role !== 'STUDENT' || successfulPurchasesCount > 0;

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      hasPaidAccessFee,
    },
    ...tokens,
  };
};

export const loginUser = async (data: any) => {
  const { email, password } = data;

  if (!email || !password) {
    throw new BadRequestError('Email and password are required');
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPassword = String(password).trim();

  const user = await prisma.gritUser.findFirst({
    where: {
      email: {
        equals: cleanEmail,
        mode: 'insensitive',
      },
    },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Your account has been deactivated. Contact support.');
  }

  let isMatch = await bcrypt.compare(cleanPassword, user.password);
  if (!isMatch && password !== cleanPassword) {
    isMatch = await bcrypt.compare(password, user.password);
  }

  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const tokens = generateTokens(user);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt,
    },
  });

  const successfulPurchasesCount = await prisma.purchase.count({
    where: { userId: user.id, paymentStatus: 'SUCCESS' },
  });
  const hasPaidAccessFee = user.role !== 'STUDENT' || successfulPurchasesCount > 0;

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      photo: user.photo,
      hasPaidAccessFee,
    },
    ...tokens,
  };
};

export const refreshAccessToken = async (token: string) => {
  if (!token) {
    throw new UnauthorizedError('Refresh token is required');
  }

  const dbToken = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!dbToken || dbToken.expiresAt < new Date()) {
    if (dbToken) {
      await prisma.refreshToken.delete({ where: { token } });
    }
    throw new UnauthorizedError('Refresh token is invalid or expired');
  }

  const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as { id: string };
  if (decoded.id !== dbToken.userId) {
    throw new UnauthorizedError('Invalid token verification');
  }

  const user = dbToken.user;
  if (!user.isActive) {
    throw new UnauthorizedError('User account is deactivated');
  }

  const tokens = generateTokens(user);

  // Rotate refresh token
  await prisma.refreshToken.delete({ where: { token } });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt,
    },
  });

  const refreshPurchasesCount = await prisma.purchase.count({
    where: { userId: user.id, paymentStatus: 'SUCCESS' },
  });
  const refreshHasPaid = user.role !== 'STUDENT' || refreshPurchasesCount > 0;

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      hasPaidAccessFee: refreshHasPaid,
    },
    ...tokens,
  };
};

export const logoutUser = async (token: string) => {
  if (token) {
    await prisma.refreshToken.deleteMany({
      where: { token },
    });
  }
};
