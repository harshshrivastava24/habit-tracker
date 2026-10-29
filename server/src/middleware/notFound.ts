import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';

export const notFound = (_req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(404, 'NOT_FOUND', 'Route not found'));
};

