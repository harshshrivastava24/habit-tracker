import { Router } from 'express';
import * as habitController from '../controllers/habitController.js';
import {
  validateCreateHabit,
  validateUpdateHabit,
  validateListHabits,
} from '../validators/habitValidator.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// PRD Section 7: All habit endpoints require requireAuth
router.use(requireAuth);

router.get('/', validateListHabits, asyncHandler(habitController.getHabits));
router.post('/', validateCreateHabit, asyncHandler(habitController.createHabit));
router.get('/:id', asyncHandler(habitController.getHabitById));
router.patch('/:id', validateUpdateHabit, asyncHandler(habitController.updateHabit));
router.delete('/:id', asyncHandler(habitController.deleteHabit));
router.post('/:id/archive', asyncHandler(habitController.archiveHabit));
router.post('/:id/unarchive', asyncHandler(habitController.unarchiveHabit));

export default router;

