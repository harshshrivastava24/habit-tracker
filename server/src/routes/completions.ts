import { Router } from 'express';
import * as completionController from '../controllers/completionController.js';
import {
  validateGetCompletions,
  validateCompletionDate,
} from '../validators/completionValidator.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router({ mergeParams: true });

router.get(
  '/',
  validateGetCompletions,
  asyncHandler(completionController.getCompletions)
);

router.put(
  '/:date',
  validateCompletionDate,
  asyncHandler(completionController.upsertCompletion)
);

router.delete(
  '/:date',
  validateCompletionDate,
  asyncHandler(completionController.deleteCompletion)
);

export default router;

