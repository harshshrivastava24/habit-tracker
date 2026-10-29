import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

export interface RateLimiterOptions {
  windowMs?: number;
  limit?: number;
  message?: string;
}

export const createRateLimiter = (options?: RateLimiterOptions): RateLimitRequestHandler => {
  const windowMs = options?.windowMs ?? 15 * 60 * 1000;
  const limit = options?.limit ?? 10;
  const message = options?.message ?? 'Too many requests, please try again later';

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message,
        },
      });
    },
  });
};

export const authRateLimiter: RateLimitRequestHandler = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many authentication attempts, please try again later',
});
