import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors.js';
import prisma from '../lib/prisma.js';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token = '';

    // Check authorization header
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } 
    // Check cookies
    else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new UnauthorizedError('Please log in to access this resource');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    // Check if user still exists and is active
    const user = await prisma.gritUser.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('The user belonging to this token no longer exists');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User account is deactivated');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token. Please log in again.'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Your session has expired. Please log in again.'));
    } else {
      next(error);
    }
  }
};

// Optional auth — doesn't fail if token is missing/invalid, but decodes if present
export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token = '';

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      const user = await prisma.gritUser.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      });

      if (user && user.isActive) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    // Just move next without user in req
    next();
  }
};
