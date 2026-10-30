import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { User, RefreshToken, UserDocument, IUser } from '../models/index.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const REFRESH_COOKIE_NAME = 'refresh_token';

export interface FormattedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface SignupInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: FormattedUser;
  accessToken: string;
  rawRefreshToken: string;
}

export const formatUser = (
  user: UserDocument | (IUser & { _id: Types.ObjectId | string })
): FormattedUser => {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  };
};

export const getRefreshCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
  path: '/api/auth',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
});

export const getClearRefreshCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
  path: '/api/auth',
});

export const generateAccessToken = (userId: string, email: string): string => {
  return jwt.sign({ sub: userId, email }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const createRefreshTokenRecord = async (
  userId: Types.ObjectId | string,
  rawToken: string
) => {
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  );
  return RefreshToken.create({
    userId,
    tokenHash,
    expiresAt,
  });
};

export const signup = async (input: SignupInput): Promise<AuthResult> => {
  const email = input.email.trim().toLowerCase();
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_COST);
  let user: UserDocument;
  try {
    user = await User.create({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email,
      passwordHash,
    });
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw err;
  }

  const accessToken = generateAccessToken(user._id.toString(), user.email);
  const rawRefreshToken = generateRefreshToken();
  await createRefreshTokenRecord(user._id, rawRefreshToken);

  return {
    user: formatUser(user),
    accessToken,
    rawRefreshToken,
  };
};

export const login = async (input: LoginInput): Promise<AuthResult> => {
  const email = input.email.trim().toLowerCase();
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.passwordHash) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const isMatch = await bcrypt.compare(input.password, user.passwordHash);
  if (!isMatch) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const accessToken = generateAccessToken(user._id.toString(), user.email);
  const rawRefreshToken = generateRefreshToken();
  await createRefreshTokenRecord(user._id, rawRefreshToken);

  return {
    user: formatUser(user),
    accessToken,
    rawRefreshToken,
  };
};

export const refresh = async (rawRefreshToken?: string): Promise<AuthResult> => {
  if (!rawRefreshToken) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Refresh token required');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const tokenDoc = await RefreshToken.findOne({ tokenHash });
  if (!tokenDoc) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid refresh token');
  }

  // Reuse detection: if a revoked token is presented, revoke all tokens for this user
  if (tokenDoc.revokedAt != null) {
    await RefreshToken.updateMany(
      { userId: tokenDoc.userId, revokedAt: null },
      { revokedAt: new Date() }
    );
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid refresh token');
  }

  // Check expiration
  if (tokenDoc.expiresAt < new Date()) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Refresh token expired');
  }

  // Revoke previous token on rotation
  tokenDoc.revokedAt = new Date();
  await tokenDoc.save();

  const user = await User.findById(tokenDoc.userId);
  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'User not found');
  }

  const accessToken = generateAccessToken(user._id.toString(), user.email);
  const newRawRefreshToken = generateRefreshToken();
  await createRefreshTokenRecord(user._id, newRawRefreshToken);

  return {
    user: formatUser(user),
    accessToken,
    rawRefreshToken: newRawRefreshToken,
  };
};

export const logout = async (rawRefreshToken?: string): Promise<void> => {
  if (rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken);
    await RefreshToken.updateOne(
      { tokenHash, revokedAt: null },
      { revokedAt: new Date() }
    );
  }
};

export const getMe = async (userId: string): Promise<FormattedUser> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'User not found');
  }
  return formatUser(user);
};

