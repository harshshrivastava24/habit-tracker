import { Request, Response } from 'express';
import * as authService from '../services/authService.js';
import {
  REFRESH_COOKIE_NAME,
  getRefreshCookieOptions,
  getClearRefreshCookieOptions,
} from '../services/authService.js';
import { AppError } from '../utils/AppError.js';

export const signup = async (req: Request, res: Response): Promise<void> => {
  const { user, accessToken, rawRefreshToken } = await authService.signup(req.body);

  res.cookie(REFRESH_COOKIE_NAME, rawRefreshToken, getRefreshCookieOptions());
  res.status(201).json({ user, accessToken });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { user, accessToken, rawRefreshToken } = await authService.login(req.body);

  res.cookie(REFRESH_COOKIE_NAME, rawRefreshToken, getRefreshCookieOptions());
  res.status(200).json({ user, accessToken });
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  try {
    const { user, accessToken, rawRefreshToken: newRefreshToken } =
      await authService.refresh(rawRefreshToken);

    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, getRefreshCookieOptions());
    res.status(200).json({ user, accessToken });
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE_NAME, getClearRefreshCookieOptions());
    throw err;
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  await authService.logout(rawRefreshToken);
  res.clearCookie(REFRESH_COOKIE_NAME, getClearRefreshCookieOptions());
  res.status(200).json({ message: 'Logged out successfully' });
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId || req.user?.id;
  if (!userId) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  const user = await authService.getMe(userId);
  res.status(200).json({ user });
};
