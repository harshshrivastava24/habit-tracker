import { Types } from 'mongoose';
import { Habit, Completion } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { getMaxAllowedCompletionDate } from '../utils/dateUtils.js';

export interface CompletionResponse {
  habitId: string;
  date: string;
}

export interface UpsertCompletionResult {
  isNew: boolean;
  completion: CompletionResponse;
}

export const getCompletions = async (
  userId: string,
  habitId: string,
  from?: string,
  to?: string
): Promise<Array<{ date: string }>> => {
  if (!Types.ObjectId.isValid(habitId)) {
    throw new AppError(404, 'NOT_FOUND', 'Habit not found');
  }

  // PRD Section 7.3: Verify habit exists and is owned by the user (allowed for archived habits)
  const habit = await Habit.findOne({
    _id: new Types.ObjectId(habitId),
    userId: new Types.ObjectId(userId),
  });

  if (!habit) {
    throw new AppError(404, 'NOT_FOUND', 'Habit not found');
  }

  const filter: Record<string, unknown> = {
    habitId: habit._id,
    userId: habit.userId,
  };

  if (from && to) {
    filter.date = { $gte: from, $lte: to };
  } else if (from) {
    filter.date = { $gte: from };
  } else if (to) {
    filter.date = { $lte: to };
  }

  const completions = await Completion.find(filter).sort({ date: 1 });
  return completions.map((c) => ({ date: c.date }));
};

export const upsertCompletion = async (
  userId: string,
  habitId: string,
  date: string
): Promise<UpsertCompletionResult> => {
  if (!Types.ObjectId.isValid(habitId)) {
    throw new AppError(404, 'NOT_FOUND', 'Habit not found');
  }

  const habit = await Habit.findOne({
    _id: new Types.ObjectId(habitId),
    userId: new Types.ObjectId(userId),
  });

  if (!habit) {
    throw new AppError(404, 'NOT_FOUND', 'Habit not found');
  }

  // PRD Section 7.3: Archived habit -> 409 HABIT_ARCHIVED
  if (habit.archivedAt !== null) {
    throw new AppError(
      409,
      'HABIT_ARCHIVED',
      'Cannot modify completions for an archived habit'
    );
  }

  // PRD Section 7.3 & 4.1: date >= habit.startDate
  if (date < habit.startDate) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Completion date cannot be earlier than habit start date',
      { date: 'Completion date cannot be earlier than habit start date' }
    );
  }

  // PRD Section 7.3 & 4.1: date <= UTC today + 1 day
  const maxDate = getMaxAllowedCompletionDate();
  if (date > maxDate) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Completion date cannot be in the future (beyond tomorrow UTC)',
      { date: 'Completion date cannot be later than UTC tomorrow' }
    );
  }

  try {
    const result = await Completion.findOneAndUpdate(
      { habitId: habit._id, date },
      {
        $setOnInsert: {
          habitId: habit._id,
          userId: habit.userId,
          date,
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        includeResultMetadata: true,
      }
    );

    const isNew = result.lastErrorObject?.updatedExisting === false;
    return {
      isNew,
      completion: {
        habitId: habit._id.toString(),
        date,
      },
    };
  } catch (err: unknown) {
    // Catch Mongo duplicate key error 11000 for concurrent requests
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      return {
        isNew: false,
        completion: {
          habitId: habit._id.toString(),
          date,
        },
      };
    }
    throw err;
  }
};

export const deleteCompletion = async (
  userId: string,
  habitId: string,
  date: string
): Promise<void> => {
  if (!Types.ObjectId.isValid(habitId)) {
    throw new AppError(404, 'NOT_FOUND', 'Habit not found');
  }

  const habit = await Habit.findOne({
    _id: new Types.ObjectId(habitId),
    userId: new Types.ObjectId(userId),
  });

  if (!habit) {
    throw new AppError(404, 'NOT_FOUND', 'Habit not found');
  }

  // PRD Section 7.3: Allowed on archived habits? No: 409 HABIT_ARCHIVED
  if (habit.archivedAt !== null) {
    throw new AppError(
      409,
      'HABIT_ARCHIVED',
      'Cannot modify completions for an archived habit'
    );
  }

  // Idempotent undo
  await Completion.deleteOne({
    habitId: habit._id,
    userId: habit.userId,
    date,
  });
};
