import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { NotFoundError } from '../utils/errors.js';

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.gritUser.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        photo: true,
        school: true,
        class: true,
        state: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const purchasesCount = await prisma.purchase.count({
      where: { userId: user.id, paymentStatus: 'SUCCESS' },
    });
    const hasPaidAccessFee = user.role !== 'STUDENT' || purchasesCount > 0;

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          ...user,
          hasPaidAccessFee,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, phone, school, class: userClass, state, photo } = req.body;

    const user = await prisma.gritUser.update({
      where: { id: req.user!.id },
      data: {
        firstName,
        lastName,
        phone,
        school,
        class: userClass,
        state,
        photo,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        photo: true,
        school: true,
        class: true,
        state: true,
        role: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.query.role as string;
    const search = req.query.search as string;

    const where: any = {};
    if (role) {
      where.role = role;
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.gritUser.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: users.length,
      data: { users },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const user = await prisma.gritUser.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        photo: true,
        school: true,
        class: true,
        state: true,
        role: true,
        isActive: true,
        createdAt: true,
        attempts: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        purchases: {
          include: {
            test: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.status(200).json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};
