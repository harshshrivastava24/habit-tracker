import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { User, RefreshToken } from '../src/models/index.js';
import { env } from '../src/config/env.js';
import { REFRESH_COOKIE_NAME } from '../src/services/authService.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  await Promise.all([User.init(), RefreshToken.init()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

const getCookie = (res: request.Response, cookieName: string): string | undefined => {
  const rawCookies = res.headers['set-cookie'];
  if (!rawCookies) return undefined;
  const cookieArray = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
  const found = cookieArray.find((c) => c.startsWith(`${cookieName}=`));
  if (!found) return undefined;
  return found.split(';')[0].split('=')[1];
};

const getCookieHeader = (res: request.Response, cookieName: string): string | undefined => {
  const rawCookies = res.headers['set-cookie'];
  if (!rawCookies) return undefined;
  const cookieArray = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
  return cookieArray.find((c) => c.startsWith(`${cookieName}=`));
};

describe('Phase S3 Authentication', () => {
  const validSignupData = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    password: 'password123',
  };

  describe('POST /api/auth/signup', () => {
    it('successfully registers user, returns user + accessToken, sets httpOnly refresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(validSignupData);

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBeDefined();
      expect(res.body.user.firstName).toBe('John');
      expect(res.body.user.lastName).toBe('Doe');
      expect(res.body.user.email).toBe('john.doe@example.com');
      expect(res.body.accessToken).toBeDefined();

      // Gate check: password hash is never in responses
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');

      // Gate check: refresh cookie is httpOnly
      const cookieHeader = getCookieHeader(res, REFRESH_COOKIE_NAME);
      expect(cookieHeader).toBeDefined();
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader).toContain('Path=/api/auth');
      expect(cookieHeader).toContain('SameSite=Lax');

      // Verify user in DB has password hashed, not plain text
      const dbUser = await User.findById(res.body.user.id).select('+passwordHash');
      expect(dbUser?.passwordHash).toBeDefined();
      expect(dbUser?.passwordHash).not.toBe('password123');
      expect(dbUser?.passwordHash.startsWith('$2b$')).toBe(true);

      // Verify refresh token is hashed in DB
      const rawCookieToken = getCookie(res, REFRESH_COOKIE_NAME);
      expect(rawCookieToken).toBeDefined();
      const dbTokens = await RefreshToken.find({ userId: res.body.user.id });
      expect(dbTokens.length).toBe(1);
      expect(dbTokens[0].tokenHash).not.toBe(rawCookieToken);
    });

    it('returns 409 EMAIL_TAKEN when registering with existing email', async () => {
      await request(app).post('/api/auth/signup').send(validSignupData);

      const res = await request(app).post('/api/auth/signup').send({
        ...validSignupData,
        email: 'JOHN.DOE@example.com', // case-insensitive check
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('validates fields and returns 400 VALIDATION_ERROR with field-level details', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        firstName: '',
        lastName: '',
        email: 'not-an-email',
        password: 'weak',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toBeDefined();
      expect(res.body.error.details.firstName).toBeDefined();
      expect(res.body.error.details.lastName).toBeDefined();
      expect(res.body.error.details.email).toBeDefined();
      expect(res.body.error.details.password).toBeDefined();
    });

    it('rejects password without numbers', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        ...validSignupData,
        password: 'lettersOnlyPassword',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.password).toBeDefined();
    });

    it('rejects password without letters', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        ...validSignupData,
        password: '1234567890',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.password).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/signup').send(validSignupData);
    });

    it('successfully logs in with valid credentials, returns tokens and sets httpOnly cookie', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'john.doe@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('john.doe@example.com');
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.passwordHash).toBeUndefined();

      const cookieHeader = getCookieHeader(res, REFRESH_COOKIE_NAME);
      expect(cookieHeader).toBeDefined();
      expect(cookieHeader).toContain('HttpOnly');
    });

    it('returns 401 INVALID_CREDENTIALS for unknown email with generic message', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'unknown@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('returns 401 INVALID_CREDENTIALS for wrong password with same generic message', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'john.doe@example.com',
        password: 'wrongPassword123',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('validates missing email and password fields', async () => {
      const res = await request(app).post('/api/auth/login').send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.email).toBeDefined();
      expect(res.body.error.details.password).toBeDefined();
    });
  });

  describe('GET /api/auth/me and requireAuth middleware', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      const signupRes = await request(app).post('/api/auth/signup').send(validSignupData);
      accessToken = signupRes.body.accessToken;
      userId = signupRes.body.user.id;
    });

    it('returns 200 { user } when valid Bearer token is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        id: userId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
      });
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('returns 401 UNAUTHENTICATED when Authorization header is missing', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 401 UNAUTHENTICATED when Authorization header is malformed', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Basic invalidtoken');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 401 UNAUTHENTICATED when token is expired', async () => {
      const expiredToken = jwt.sign(
        { sub: userId, email: 'john.doe@example.com' },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(res.body.error.message).toBe('Access token expired');
    });

    it('returns 401 UNAUTHENTICATED when token signature is invalid', async () => {
      const badToken = jwt.sign(
        { sub: userId, email: 'john.doe@example.com' },
        'wrong-secret',
        { expiresIn: '15m' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${badToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(res.body.error.message).toBe('Invalid access token');
    });
  });

  describe('POST /api/auth/refresh (Rotation + Reuse Detection)', () => {
    it('successfully rotates refresh token and issues new access token', async () => {
      const signupRes = await request(app).post('/api/auth/signup').send(validSignupData);
      const rawCookie1 = getCookie(signupRes, REFRESH_COOKIE_NAME);
      expect(rawCookie1).toBeDefined();

      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${rawCookie1}`);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.user).toBeDefined();
      expect(refreshRes.body.accessToken).toBeDefined();
      expect(refreshRes.body.user.passwordHash).toBeUndefined();

      const rawCookie2 = getCookie(refreshRes, REFRESH_COOKIE_NAME);
      expect(rawCookie2).toBeDefined();
      expect(rawCookie2).not.toBe(rawCookie1);

      // Old refresh token must now be rejected
      const replayRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${rawCookie1}`);

      expect(replayRes.status).toBe(401);
      expect(replayRes.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('reuse detection: presenting an already-revoked token revokes all tokens for that user', async () => {
      // 1. Initial signup -> Token A
      const signupRes = await request(app).post('/api/auth/signup').send(validSignupData);
      const tokenA = getCookie(signupRes, REFRESH_COOKIE_NAME);

      // 2. Refresh with Token A -> Token B (Token A is now revoked)
      const refreshRes1 = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${tokenA}`);
      const tokenB = getCookie(refreshRes1, REFRESH_COOKIE_NAME);

      // 3. Attacker/replayer presents revoked Token A
      const replayRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${tokenA}`);
      expect(replayRes.status).toBe(401);

      // 4. Token B (previously valid) must now also be revoked due to reuse detection
      const refreshRes2 = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${tokenB}`);
      expect(refreshRes2.status).toBe(401);
      expect(refreshRes2.body.error.code).toBe('UNAUTHENTICATED');

      // Verify in DB: all tokens for user have revokedAt set
      const dbTokens = await RefreshToken.find({ userId: signupRes.body.user.id });
      expect(dbTokens.length).toBeGreaterThanOrEqual(2);
      expect(dbTokens.every((t) => t.revokedAt !== null)).toBe(true);
    });

    it('returns 401 UNAUTHENTICATED when refresh cookie is missing', async () => {
      const res = await request(app).post('/api/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 401 UNAUTHENTICATED when refresh token is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=invalidhexstring1234567890`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('revokes refresh token, clears cookie, and prevents further refresh', async () => {
      const signupRes = await request(app).post('/api/auth/signup').send(validSignupData);
      const rawCookie = getCookie(signupRes, REFRESH_COOKIE_NAME);

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${rawCookie}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toBe('Logged out successfully');

      // Check cookie was cleared
      const cookieHeader = getCookieHeader(logoutRes, REFRESH_COOKIE_NAME);
      expect(cookieHeader).toBeDefined();
      // Express clearCookie sets max-age=0 or expires in past
      expect(cookieHeader).toMatch(/(Expires=|Max-Age=0)/i);

      // Refresh after logout must fail
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${rawCookie}`);

      expect(refreshRes.status).toBe(401);
      expect(refreshRes.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 200 when logging out with no cookie (already logged out)', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out successfully');
    });
  });
});

