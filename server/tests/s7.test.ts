import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User, Habit, Completion, RefreshToken } from '../src/models/index.js';
import { REFRESH_COOKIE_NAME } from '../src/services/authService.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  await Promise.all([
    User.init(),
    Habit.init(),
    Completion.init(),
    RefreshToken.init(),
  ]);
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

describe('Phase S7 Full Test Sweep & Business Rules Coverage', () => {
  describe('Full End-to-End User Lifecycle Flow', () => {
    it('executes complete journey: signup -> habits -> completions -> stats -> archive -> delete -> refresh -> logout', async () => {
      // 1. Signup
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          firstName: 'Alice',
          lastName: 'Wonderland',
          email: 'alice.flow@example.com',
          password: 'password123',
        });
      expect(signupRes.status).toBe(201);
      const token = signupRes.body.accessToken;
      let refreshCookie = getCookie(signupRes, REFRESH_COOKIE_NAME);
      const authHeader = `Bearer ${token}`;

      // 2. Fetch authenticated user profile
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', authHeader);
      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe('alice.flow@example.com');

      // 3. Create Habit 1 (Reading)
      const habit1Res = await request(app)
        .post('/api/habits')
        .set('Authorization', authHeader)
        .send({
          name: 'Read Books',
          description: 'Read 20 pages every day',
          startDate: '2026-10-01',
          frequency: 'DAILY',
          category: 'Personal Development',
          reminderTime: '20:30',
        });
      expect(habit1Res.status).toBe(201);
      const habit1Id = habit1Res.body.habit._id;

      // 4. Create Habit 2 (Exercise)
      const habit2Res = await request(app)
        .post('/api/habits')
        .set('Authorization', authHeader)
        .send({
          name: 'Morning Jog',
          startDate: '2026-10-15',
          frequency: 'DAILY',
        });
      expect(habit2Res.status).toBe(201);
      const habit2Id = habit2Res.body.habit._id;

      // 5. List active habits
      const listRes = await request(app)
        .get('/api/habits')
        .set('Authorization', authHeader);
      expect(listRes.status).toBe(200);
      expect(listRes.body.habits.length).toBe(2);

      // 6. Complete Habit 1 on multiple days
      await request(app)
        .put(`/api/habits/${habit1Id}/completions/2026-10-05`)
        .set('Authorization', authHeader);
      await request(app)
        .put(`/api/habits/${habit1Id}/completions/2026-10-06`)
        .set('Authorization', authHeader);
      await request(app)
        .put(`/api/habits/${habit1Id}/completions/2026-10-28`)
        .set('Authorization', authHeader);

      // 7. Complete Habit 2 on multiple days
      await request(app)
        .put(`/api/habits/${habit2Id}/completions/2026-10-20`)
        .set('Authorization', authHeader);
      await request(app)
        .put(`/api/habits/${habit2Id}/completions/2026-10-27`)
        .set('Authorization', authHeader);

      // 8. Query completions for Habit 1 with date filter
      const compRes = await request(app)
        .get(`/api/habits/${habit1Id}/completions?from=2026-10-01&to=2026-10-10`)
        .set('Authorization', authHeader);
      expect(compRes.status).toBe(200);
      expect(compRes.body.completions).toEqual([
        { date: '2026-10-05' },
        { date: '2026-10-06' },
      ]);

      // 9. Check Dashboard Stats
      const statsRes = await request(app)
        .get('/api/dashboard/stats?from=2026-10-01&to=2026-10-29')
        .set('Authorization', authHeader);
      expect(statsRes.status).toBe(200);
      expect(statsRes.body.activeHabits).toBe(2);
      expect(statsRes.body.completionsInPeriod).toBe(5);
      // Habit 1: 29 days, Habit 2: 15 days -> total expected = 44
      expect(statsRes.body.expectedCompletions).toBe(44);
      expect(statsRes.body.completionRate).toBe(0.11);
      expect(statsRes.body.completionsThisWeek).toBe(2); // 2026-10-28 and 2026-10-27

      // 10. Archive Habit 2
      const archiveRes = await request(app)
        .post(`/api/habits/${habit2Id}/archive`)
        .set('Authorization', authHeader);
      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.habit.archivedAt).not.toBeNull();

      // Verify active list now has only 1 habit
      const listAfterArchive = await request(app)
        .get('/api/habits')
        .set('Authorization', authHeader);
      expect(listAfterArchive.body.habits.length).toBe(1);
      expect(listAfterArchive.body.habits[0]._id).toBe(habit1Id);

      // Verify archived list contains Habit 2
      const archivedList = await request(app)
        .get('/api/habits?status=archived')
        .set('Authorization', authHeader);
      expect(archivedList.body.habits.length).toBe(1);
      expect(archivedList.body.habits[0]._id).toBe(habit2Id);

      // Verify stats exclude archived habit
      const statsAfterArchive = await request(app)
        .get('/api/dashboard/stats?from=2026-10-01&to=2026-10-29')
        .set('Authorization', authHeader);
      expect(statsAfterArchive.body.activeHabits).toBe(1);
      expect(statsAfterArchive.body.completionsInPeriod).toBe(3);
      expect(statsAfterArchive.body.expectedCompletions).toBe(29);

      // 11. Archived habit blocks completion mutation
      const blockedPut = await request(app)
        .put(`/api/habits/${habit2Id}/completions/2026-10-22`)
        .set('Authorization', authHeader);
      expect(blockedPut.status).toBe(409);
      expect(blockedPut.body.error.code).toBe('HABIT_ARCHIVED');

      const blockedDelete = await request(app)
        .delete(`/api/habits/${habit2Id}/completions/2026-10-20`)
        .set('Authorization', authHeader);
      expect(blockedDelete.status).toBe(409);
      expect(blockedDelete.body.error.code).toBe('HABIT_ARCHIVED');

      // But viewing completions on archived habit remains allowed
      const archivedCompRes = await request(app)
        .get(`/api/habits/${habit2Id}/completions`)
        .set('Authorization', authHeader);
      expect(archivedCompRes.status).toBe(200);
      expect(archivedCompRes.body.completions.length).toBe(2);

      // 12. Unarchive Habit 2
      const unarchiveRes = await request(app)
        .post(`/api/habits/${habit2Id}/unarchive`)
        .set('Authorization', authHeader);
      expect(unarchiveRes.status).toBe(200);
      expect(unarchiveRes.body.habit.archivedAt).toBeNull();

      // 13. Hard Delete Habit 1 (and all its completions)
      const deleteRes = await request(app)
        .delete(`/api/habits/${habit1Id}`)
        .set('Authorization', authHeader);
      expect(deleteRes.status).toBe(204);

      // Verify Habit 1 is deleted from DB
      expect(await Habit.findById(habit1Id)).toBeNull();
      // Verify all completions for Habit 1 are purged
      expect(await Completion.countDocuments({ habitId: habit1Id })).toBe(0);

      // 14. Rotate Refresh Token
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshCookie}`);
      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.accessToken).toBeDefined();
      refreshCookie = getCookie(refreshRes, REFRESH_COOKIE_NAME);

      // 15. Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshCookie}`);
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toBe('Logged out successfully');

      // 16. Refresh after logout fails with 401 UNAUTHENTICATED
      const refreshAfterLogout = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshCookie}`);
      expect(refreshAfterLogout.status).toBe(401);
      expect(refreshAfterLogout.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('Exhaustive Ownership Isolation (User B receives 404, never 403)', () => {
    it('enforces 404 on all endpoints when User B attempts to access User A resources', async () => {
      // Create User A
      const userARes = await request(app)
        .post('/api/auth/signup')
        .send({
          firstName: 'User',
          lastName: 'A',
          email: 'user.a@example.com',
          password: 'password123',
        });
      const tokenA = `Bearer ${userARes.body.accessToken}`;

      // Create User B
      const userBRes = await request(app)
        .post('/api/auth/signup')
        .send({
          firstName: 'User',
          lastName: 'B',
          email: 'user.b@example.com',
          password: 'password123',
        });
      const tokenB = `Bearer ${userBRes.body.accessToken}`;

      // User A creates habit and completion
      const habitRes = await request(app)
        .post('/api/habits')
        .set('Authorization', tokenA)
        .send({
          name: "User A's Confidential Habit",
          startDate: '2026-10-01',
          frequency: 'DAILY',
        });
      const habitId = habitRes.body.habit._id;

      await request(app)
        .put(`/api/habits/${habitId}/completions/2026-10-05`)
        .set('Authorization', tokenA);

      // 1. GET /habits/:id
      const getRes = await request(app)
        .get(`/api/habits/${habitId}`)
        .set('Authorization', tokenB);
      expect(getRes.status).toBe(404);
      expect(getRes.body.error.code).toBe('NOT_FOUND');

      // 2. PATCH /habits/:id
      const patchRes = await request(app)
        .patch(`/api/habits/${habitId}`)
        .set('Authorization', tokenB)
        .send({ name: 'Tampered' });
      expect(patchRes.status).toBe(404);
      expect(patchRes.body.error.code).toBe('NOT_FOUND');

      // 3. DELETE /habits/:id
      const deleteRes = await request(app)
        .delete(`/api/habits/${habitId}`)
        .set('Authorization', tokenB);
      expect(deleteRes.status).toBe(404);
      expect(deleteRes.body.error.code).toBe('NOT_FOUND');

      // 4. POST /habits/:id/archive
      const archiveRes = await request(app)
        .post(`/api/habits/${habitId}/archive`)
        .set('Authorization', tokenB);
      expect(archiveRes.status).toBe(404);
      expect(archiveRes.body.error.code).toBe('NOT_FOUND');

      // 5. POST /habits/:id/unarchive
      const unarchiveRes = await request(app)
        .post(`/api/habits/${habitId}/unarchive`)
        .set('Authorization', tokenB);
      expect(unarchiveRes.status).toBe(404);
      expect(unarchiveRes.body.error.code).toBe('NOT_FOUND');

      // 6. GET /habits/:id/completions
      const compGetRes = await request(app)
        .get(`/api/habits/${habitId}/completions`)
        .set('Authorization', tokenB);
      expect(compGetRes.status).toBe(404);
      expect(compGetRes.body.error.code).toBe('NOT_FOUND');

      // 7. PUT /habits/:id/completions/:date
      const compPutRes = await request(app)
        .put(`/api/habits/${habitId}/completions/2026-10-06`)
        .set('Authorization', tokenB);
      expect(compPutRes.status).toBe(404);
      expect(compPutRes.body.error.code).toBe('NOT_FOUND');

      // 8. DELETE /habits/:id/completions/:date
      const compDelRes = await request(app)
        .delete(`/api/habits/${habitId}/completions/2026-10-05`)
        .set('Authorization', tokenB);
      expect(compDelRes.status).toBe(404);
      expect(compDelRes.body.error.code).toBe('NOT_FOUND');

      // 9. Verify User A's data was completely untouched
      const freshHabit = await Habit.findById(habitId);
      expect(freshHabit?.name).toBe("User A's Confidential Habit");
      expect(freshHabit?.archivedAt).toBeNull();
      const compCount = await Completion.countDocuments({ habitId });
      expect(compCount).toBe(1);
    });
  });

  describe('Standard Error Shape Consistency Across All Handlers', () => {
    it('guarantees code, message, and absence of stack traces across error types', async () => {
      // 400 VALIDATION_ERROR
      const valRes = await request(app)
        .post('/api/auth/signup')
        .send({});
      expect(valRes.status).toBe(400);
      expect(valRes.body.error.code).toBe('VALIDATION_ERROR');
      expect(valRes.body.error.message).toBeDefined();
      expect(valRes.body.error.details).toBeDefined();
      expect(valRes.body.stack).toBeUndefined();

      // 401 UNAUTHENTICATED
      const unauthRes = await request(app).get('/api/habits');
      expect(unauthRes.status).toBe(401);
      expect(unauthRes.body.error.code).toBe('UNAUTHENTICATED');
      expect(unauthRes.body.stack).toBeUndefined();

      // 404 NOT_FOUND
      const notFoundRes = await request(app).get('/api/unknown-route');
      expect(notFoundRes.status).toBe(404);
      expect(notFoundRes.body.error.code).toBe('NOT_FOUND');
      expect(notFoundRes.body.stack).toBeUndefined();
    });
  });
});
