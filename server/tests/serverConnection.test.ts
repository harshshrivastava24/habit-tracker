import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import express, { Request, Response } from 'express';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

describe('Server Bootstrap & Database Connection Regression Tests', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
  });

  afterAll(async () => {
    await disconnectDB();
    await mongoServer.stop();
  });

  it('connectDB successfully connects mongoose and sets readyState to 1', async () => {
    await disconnectDB();
    expect(mongoose.connection.readyState).toBe(0); // disconnected

    await connectDB(mongoServer.getUri());
    expect(mongoose.connection.readyState).toBe(1); // connected
  });

  it('errorHandler logs full error stack in development and returns generic 500 without leaking stack to client', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const testApp = express();
    testApp.get('/throw-unexpected', (_req: Request, _res: Response) => {
      throw new Error('Database operation failed unexpectedly');
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/throw-unexpected');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
    // Verify client never receives stack
    expect(res.body.error.stack).toBeUndefined();

    // Verify server console logged the full stack trace
    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedError = consoleErrorSpy.mock.calls[0][1];
    expect(loggedError).toContain('Database operation failed unexpectedly');
    expect(loggedError).toContain('Error: Database operation failed unexpectedly');

    consoleErrorSpy.mockRestore();
    process.env.NODE_ENV = originalNodeEnv;
  });
});
