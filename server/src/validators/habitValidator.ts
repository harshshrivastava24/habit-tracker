import { body, query } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { isValidDateString } from '../utils/dateUtils.js';

export const validateCreateHabit = validate([
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('description')
    .optional({ nullable: true })
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('startDate')
    .trim()
    .notEmpty()
    .withMessage('Start date is required')
    .custom((val) => {
      if (!isValidDateString(val)) {
        throw new Error('Start date must be a valid calendar date in YYYY-MM-DD format');
      }
      return true;
    }),
  body('frequency')
    .notEmpty()
    .withMessage('Frequency is required')
    .isIn(['DAILY'])
    .withMessage("Frequency must be 'DAILY'"),
  body('category')
    .optional({ nullable: true })
    .isLength({ max: 30 })
    .withMessage('Category cannot exceed 30 characters'),
  body('reminderTime')
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null || val === undefined || val === '') return true;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(val)) {
        throw new Error('Reminder time must be in HH:mm format');
      }
      return true;
    }),
]);

export const validateUpdateHabit = validate([
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('description')
    .optional({ nullable: true })
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('startDate')
    .optional()
    .trim()
    .custom((val) => {
      if (!isValidDateString(val)) {
        throw new Error('Start date must be a valid calendar date in YYYY-MM-DD format');
      }
      return true;
    }),
  body('frequency')
    .optional()
    .isIn(['DAILY'])
    .withMessage("Frequency must be 'DAILY'"),
  body('category')
    .optional({ nullable: true })
    .isLength({ max: 30 })
    .withMessage('Category cannot exceed 30 characters'),
  body('reminderTime')
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null || val === undefined || val === '') return true;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(val)) {
        throw new Error('Reminder time must be in HH:mm format');
      }
      return true;
    }),
]);

export const validateListHabits = validate([
  query('status')
    .optional()
    .isIn(['active', 'archived'])
    .withMessage("Status must be either 'active' or 'archived'"),
]);
