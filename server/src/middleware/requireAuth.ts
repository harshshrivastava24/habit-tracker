import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: AuthenticatedUser;
    }
  }
}

interface JwtPayload {
  sub: string;
  email: string;
}

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    if (!decoded || !decoded.sub) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Invalid access token'));
    }

    req.userId = decoded.sub;
    req.user = {
      id: decoded.sub,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Access token expired'));
    }
    return next(new AppError(401, 'UNAUTHENTICATED', 'Invalid access token'));
  }
};

