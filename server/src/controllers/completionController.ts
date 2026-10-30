import { Request, Response } from 'express';
import * as completionService from '../services/completionService.js';

export const getCompletions = async (
  req: Request,
  res: Response
): Promise<void> => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const completions = await completionService.getCompletions(
    req.userId!,
    req.params.id,
    from,
    to
  );

  res.status(200).json({ completions });
};

export const upsertCompletion = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { isNew, completion } = await completionService.upsertCompletion(
    req.userId!,
    req.params.id,
    req.params.date
  );

  res.status(isNew ? 201 : 200).json({ completion });
};

export const deleteCompletion = async (
  req: Request,
  res: Response
): Promise<void> => {
  await completionService.deleteCompletion(
    req.userId!,
    req.params.id,
    req.params.date
  );

  res.status(204).send();
};

