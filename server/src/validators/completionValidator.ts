import { query, param } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { isValidDateString, getDaysDifference } from '../utils/dateUtils.js';

export const validateGetCompletions = validate([
  query('from')
    .optional()
    .trim()
    .custom((val) => {
      if (!isValidDateString(val)) {
        throw new Error("'from' must be a valid calendar date in YYYY-MM-DD format");
      }
      return true;
    }),
  query('to')
    .optional()
    .trim()
    .custom((val, { req }) => {
      if (!isValidDateString(val)) {
        throw new Error("'to' must be a valid calendar date in YYYY-MM-DD format");
      }
      const from = req.query?.from;
      if (from && isValidDateString(from)) {
        if (from > val) {
          throw new Error("'from' date cannot be after 'to' date");
        }
        if (getDaysDifference(from, val) > 400) {
          throw new Error('Date range cannot exceed 400 days');
        }
      }
      return true;
    }),
]);

export const validateCompletionDate = validate([
  param('date')
    .trim()
    .custom((val) => {
      if (!isValidDateString(val)) {
        throw new Error('Date parameter must be a valid calendar date in YYYY-MM-DD format');
      }
      return true;
    }),
]);
