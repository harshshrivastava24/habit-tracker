import { Request, Response } from 'express';
import * as habitService from '../services/habitService.js';

export const getHabits = async (req: Request, res: Response): Promise<void> => {
  const status = (req.query.status as 'active' | 'archived') || 'active';
  const habits = await habitService.getHabits(req.userId!, status);
  res.status(200).json({ habits });
};

export const createHabit = async (req: Request, res: Response): Promise<void> => {
  const habit = await habitService.createHabit(req.userId!, req.body);
  res.status(201).json({ habit });
};

export const getHabitById = async (req: Request, res: Response): Promise<void> => {
  const habit = await habitService.getHabitById(req.userId!, req.params.id);
  res.status(200).json({ habit });
};

export const updateHabit = async (req: Request, res: Response): Promise<void> => {
  const habit = await habitService.updateHabit(req.userId!, req.params.id, req.body);
  res.status(200).json({ habit });
};

export const deleteHabit = async (req: Request, res: Response): Promise<void> => {
  await habitService.deleteHabit(req.userId!, req.params.id);
  res.status(204).send();
};

export const archiveHabit = async (req: Request, res: Response): Promise<void> => {
  const habit = await habitService.archiveHabit(req.userId!, req.params.id);
  res.status(200).json({ habit });
};

export const unarchiveHabit = async (req: Request, res: Response): Promise<void> => {
  const habit = await habitService.unarchiveHabit(req.userId!, req.params.id);
  res.status(200).json({ habit });
};
