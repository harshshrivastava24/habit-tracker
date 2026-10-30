import { ErrorRequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Handle syntax error from malformed JSON bodies
  if ('type' in err && err.type === 'entity.parse.failed') {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid JSON payload in request body',
      },
    });
    return;
  }

  // Unexpected errors: log full stack trace on server (suppressed in test environment), never leak stack traces to client
  if (process.env.NODE_ENV !== 'test') {
    if (err instanceof Error) {
      console.error('Unhandled internal error:', err.stack || err.message);
    } else {
      console.error('Unhandled internal error:', err);
    }
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
};
