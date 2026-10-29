// Load .env if loadEnvFile exists (Node 20.6+)
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // If running without .env on disk or already loaded, proceed
  }
}

export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  MONGODB_URI: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  ACCESS_TOKEN_TTL: string;
  REFRESH_TOKEN_TTL_DAYS: number;
  BCRYPT_COST: number;
}

const getEnvOrThrow = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value.trim() === '') {
    throw new Error(`Environment validation error: Missing required environment variable '${key}'.`);
  }
  return value;
};

const getEnvNumber = (key: string, defaultValue: number): number => {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const num = parseInt(raw, 10);
  if (isNaN(num)) {
    throw new Error(
      `Environment validation error: Environment variable '${key}' must be a valid integer, received '${raw}'.`
    );
  }
  return num;
};

export const loadEnv = (): EnvConfig => {
  const isTest = process.env.NODE_ENV === 'test';
  const nodeEnv = (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || (isTest ? 'test' : 'development');

  return {
    NODE_ENV: nodeEnv,
    PORT: getEnvNumber('PORT', 5000),
    MONGODB_URI: getEnvOrThrow(
      'MONGODB_URI',
      isTest ? 'mongodb://localhost:27017/habit_tracker_test' : undefined
    ),
    JWT_ACCESS_SECRET: getEnvOrThrow(
      'JWT_ACCESS_SECRET',
      isTest ? 'test-access-secret-1234567890' : undefined
    ),
    JWT_REFRESH_SECRET: getEnvOrThrow(
      'JWT_REFRESH_SECRET',
      isTest ? 'test-refresh-secret-1234567890' : undefined
    ),
    ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL || '15m',
    REFRESH_TOKEN_TTL_DAYS: getEnvNumber('REFRESH_TOKEN_TTL_DAYS', 7),
    BCRYPT_COST: getEnvNumber('BCRYPT_COST', 10),
  };
};

export const env = loadEnv();
