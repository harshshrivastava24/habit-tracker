import { Request, Response } from 'express';
import * as statsService from '../services/statsService.js';

export const getStats = async (req: Request, res: Response): Promise<void> => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const stats = await statsService.getDashboardStats(req.userId!, from, to);
  res.status(200).json(stats);
};
