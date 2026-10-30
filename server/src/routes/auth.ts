import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { validateSignup, validateLogin } from '../validators/authValidator.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post(
  '/signup',
  authRateLimiter,
  validateSignup,
  asyncHandler(authController.signup)
);

router.post(
  '/login',
  authRateLimiter,
  validateLogin,
  asyncHandler(authController.login)
);

router.post(
  '/refresh',
  authRateLimiter,
  asyncHandler(authController.refresh)
);

router.post(
  '/logout',
  asyncHandler(authController.logout)
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(authController.getMe)
);

export default router;
