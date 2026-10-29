import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import app from '../src/app.js';
import { AppError } from '../src/utils/AppError.js';
import { asyncHandler } from '../src/utils/asyncHandler.js';
import { validate } from '../src/middleware/validate.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { createRateLimiter } from '../src/middleware/rateLimit.js';
import { env } from '../src/config/env.js';

describe('Phase S1 Core Infrastructure', () => {
  describe('Gate requirement: Unknown route returns standard error shape', () => {
    it('GET /some-unknown-route returns 404 with NOT_FOUND standard error shape', async () => {
      const res = await request(app).get('/some-unknown-route');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found',
        },
      });
      expect(res.body.stack).toBeUndefined();
    });

    it('POST /api/does-not-exist returns 404 with NOT_FOUND standard error shape', async () => {
      const res = await request(app).post('/api/does-not-exist').send({ foo: 'bar' });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found',
        },
      });
    });
  });

  describe('AppError & errorHandler middleware', () => {
    it('handles custom AppError with status code, code, and details', async () => {
      const testApp = express();
      testApp.get(
        '/custom-error',
        (_req: Request, _res: Response, next) => {
          next(
            new AppError(400, 'VALIDATION_ERROR', 'Name is required', {
              name: 'This field is required',
            })
          );
        }
      );
      testApp.use(errorHandler);

      const res = await request(testApp).get('/custom-error');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name is required',
          details: {
            name: 'This field is required',
          },
        },
      });
    });

    it('masks unexpected errors with 500 INTERNAL_ERROR and never leaks stack traces', async () => {
      const testApp = express();
      testApp.get('/crash', () => {
        throw new Error('Database connection secret password leaked');
      });
      testApp.use(errorHandler);

      const res = await request(testApp).get('/crash');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
      expect(res.body.error.details).toBeUndefined();
      expect(res.body.stack).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('secret password');
    });
  });

  describe('asyncHandler utility', () => {
    it('catches async promise rejections and passes to errorHandler', async () => {
      const testApp = express();
      testApp.get(
        '/async-fail',
        asyncHandler(async () => {
          await Promise.resolve();
          throw new AppError(401, 'UNAUTHENTICATED', 'Invalid token');
        })
      );
      testApp.use(errorHandler);

      const res = await request(testApp).get('/async-fail');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Invalid token',
        },
      });
    });
  });

  describe('validate middleware (express-validator)', () => {
    it('formats field validation errors into standard error shape', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post(
        '/test-validate',
        validate([
          body('email').isEmail().withMessage('Invalid email format'),
          body('name').trim().notEmpty().withMessage('Name is required'),
        ]),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );
      testApp.use(errorHandler);

      const res = await request(testApp).post('/test-validate').send({
        email: 'invalid-email',
        name: '',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual({
        email: 'Invalid email format',
        name: 'Name is required',
      });
    });

    it('proceeds to route handler when validation passes', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post(
        '/test-validate',
        validate([
          body('email').isEmail().withMessage('Invalid email format'),
          body('name').trim().notEmpty().withMessage('Name is required'),
        ]),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );
      testApp.use(errorHandler);

      const res = await request(testApp).post('/test-validate').send({
        email: 'test@example.com',
        name: 'Valid Name',
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });
  });

  describe('rateLimit middleware', () => {
    it('returns 429 and RATE_LIMITED error when limit is exceeded', async () => {
      const testApp = express();
      const limiter = createRateLimiter({
        windowMs: 60 * 1000,
        limit: 2,
        message: 'Rate limit exceeded',
      });

      testApp.get('/limited', limiter, (_req: Request, res: Response) => {
        res.json({ ok: true });
      });

      const res1 = await request(testApp).get('/limited');
      expect(res1.status).toBe(200);

      const res2 = await request(testApp).get('/limited');
      expect(res2.status).toBe(200);

      const res3 = await request(testApp).get('/limited');
      expect(res3.status).toBe(429);
      expect(res3.body).toEqual({
        error: {
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded',
        },
      });
    });
  });

  describe('config/env', () => {
    it('provides loaded and validated environment configuration', () => {
      expect(env.PORT).toBeDefined();
      expect(typeof env.PORT).toBe('number');
      expect(env.NODE_ENV).toBeDefined();
      expect(env.MONGODB_URI).toBeDefined();
      expect(env.JWT_ACCESS_SECRET).toBeDefined();
      expect(env.JWT_REFRESH_SECRET).toBeDefined();
      expect(env.ACCESS_TOKEN_TTL).toBe('15m');
      expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(7);
      expect(env.BCRYPT_COST).toBe(10);
    });
  });
});
