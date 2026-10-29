import { Request, Response, NextFunction, RequestHandler } from 'express';
import { validationResult, ContextRunner } from 'express-validator';
import { AppError } from '../utils/AppError.js';

export const validate = (validations?: ContextRunner[]): RequestHandler => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (validations && validations.length > 0) {
      for (const validation of validations) {
        await validation.run(req);
      }
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const details: Record<string, string> = {};
    for (const error of errors.array()) {
      if (error.type === 'field' && !details[error.path]) {
        details[error.path] = error.msg;
      }
    }

    const firstMsg = errors.array()[0]?.msg || 'Validation failed';
    return next(new AppError(400, 'VALIDATION_ERROR', firstMsg, details));
  };
};

export const handleValidationErrors = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const details: Record<string, string> = {};
  for (const error of errors.array()) {
    if (error.type === 'field' && !details[error.path]) {
      details[error.path] = error.msg;
    }
  }

  const firstMsg = errors.array()[0]?.msg || 'Validation failed';
  return next(new AppError(400, 'VALIDATION_ERROR', firstMsg, details));
};
