import { Types } from 'mongoose';
import { Habit, HabitDocument, HabitFrequency, Completion } from '../models/index.js';
import { AppError } from '../utils/AppError.js';

export interface CreateHabitInput {
  name: string;
  description?: string;
  startDate: string;
  frequency: HabitFrequency;
  category?: string | null;
  reminderTime?: string | null;
}

export interface UpdateHabitInput {
  name?: string;
  description?: string;
  startDate?: string;
  frequency?: HabitFrequency;
  category?: string | null;
  reminderTime?: string | null;
}

export const getHabits = async (
  userId: string,
  status: 'active' | 'archived' = 'active'
): Promise<HabitDocument[]> => {
  const filter: Record<string, unknown> = {
    userId: new Types.ObjectId(userId),
  };

  if (status === 'active') {
    filter.archivedAt = null;
  } else {
    filter.archivedAt = { $ne: null };
  }

  return Habit.find(filter).sort({ createdAt: -1 });
};

export const createHabit = async (
  userId: string,
  input: CreateHabitInput
): Promise<HabitDocument> => {
  return Habit.create({
    userId: new Types.ObjectId(userId),
    name: input.name.trim(),
    description: input.description,
    startDate: input.startDate,
    frequency: input.frequency || 'DAILY',
    archivedAt: null,
    category: input.category || null,
    reminderTime: input.reminderTime || null,
  });
};

export const getHabitById = async (
  userId: string,
  habitId: string
): Promise<HabitDocument> => {
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

  return habit;
};

export const updateHabit = async (
  userId: string,
  habitId: string,
  updates: UpdateHabitInput
): Promise<HabitDocument> => {
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

  if (updates.name !== undefined) habit.name = updates.name.trim();
  if (updates.description !== undefined) habit.description = updates.description;
  if (updates.startDate !== undefined) habit.startDate = updates.startDate;
  if (updates.frequency !== undefined) habit.frequency = updates.frequency;
  if (updates.category !== undefined) habit.category = updates.category;
  if (updates.reminderTime !== undefined) habit.reminderTime = updates.reminderTime;

  await habit.save();
  return habit;
};

export const deleteHabit = async (
  userId: string,
  habitId: string
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

  // PRD Section 7.2: Hard delete removes habit and all its completions
  await Completion.deleteMany({
    habitId: habit._id,
    userId: habit.userId,
  });

  await Habit.deleteOne({
    _id: habit._id,
    userId: habit.userId,
  });
};

export const archiveHabit = async (
  userId: string,
  habitId: string
): Promise<HabitDocument> => {
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

  if (!habit.archivedAt) {
    habit.archivedAt = new Date();
    await habit.save();
  }

  return habit;
};

export const unarchiveHabit = async (
  userId: string,
  habitId: string
): Promise<HabitDocument> => {
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

  if (habit.archivedAt) {
    habit.archivedAt = null;
    await habit.save();
  }

  return habit;
};

