import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { validateDashboardStats } from '../validators/dashboardValidator.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// PRD Section 7: Dashboard endpoints require requireAuth
router.use(requireAuth);

router.get(
  '/stats',
  validateDashboardStats,
  asyncHandler(dashboardController.getStats)
);

export default router;

