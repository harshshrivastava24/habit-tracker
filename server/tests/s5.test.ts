import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User, Habit, Completion } from '../src/models/index.js';
import { generateAccessToken } from '../src/services/authService.js';
import { getMaxAllowedCompletionDate } from '../src/utils/dateUtils.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  await Promise.all([User.init(), Habit.init(), Completion.init()]);
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

const createUserWithToken = async (email: string, firstName = 'Test', lastName = 'User') => {
  const user = await User.create({
    firstName,
    lastName,
    email,
    passwordHash: '$2b$10$hashedpasswordplaceholder',
  });
  const token = generateAccessToken(user._id.toString(), user.email);
  return { user, token, authHeader: `Bearer ${token}` };
};

describe('Phase S5 Completions API & Date Rules', () => {
  describe('PUT /api/habits/:id/completions/:date (Upsert)', () => {
    it('creates a new completion and returns 201 with body { completion: { habitId, date } }', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Morning Workout',
        startDate: '2026-10-01',
      });

      const res = await request(app)
        .put(`/api/habits/${habit._id}/completions/2026-10-05`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(201);
      expect(res.body.completion).toBeDefined();
      expect(res.body.completion.habitId).toBe(habit._id.toString());
      expect(res.body.completion.date).toBe('2026-10-05');

      const count = await Completion.countDocuments({
        habitId: habit._id,
        date: '2026-10-05',
      });
      expect(count).toBe(1);
    });

    it('Gate: PUT twice is idempotent and returns 200 on the second call with exactly 1 record', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Morning Workout',
        startDate: '2026-10-01',
      });

      // First call -> 201 Created
      const res1 = await request(app)
        .put(`/api/habits/${habit._id}/completions/2026-10-05`)
        .set('Authorization', authHeader);
      expect(res1.status).toBe(201);

      // Second call -> 200 OK (already exists)
      const res2 = await request(app)
        .put(`/api/habits/${habit._id}/completions/2026-10-05`)
        .set('Authorization', authHeader);
      expect(res2.status).toBe(200);
      expect(res2.body.completion).toEqual({
        habitId: habit._id.toString(),
        date: '2026-10-05',
      });

      const count = await Completion.countDocuments({
        habitId: habit._id,
        date: '2026-10-05',
      });
      expect(count).toBe(1);
    });

    it('Gate: concurrent PUTs (Promise.all) yield exactly one record in the database', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Concurrency Test Habit',
        startDate: '2026-10-01',
      });

      const promises = Array.from({ length: 5 }).map(() =>
        request(app)
          .put(`/api/habits/${habit._id}/completions/2026-10-10`)
          .set('Authorization', authHeader)
      );

      const responses = await Promise.all(promises);

      // Each request must succeed with either 201 or 200
      for (const res of responses) {
        expect([200, 201]).toContain(res.status);
      }

      // Exactly one 201 response and four 200 responses
      const createdCount = responses.filter((r) => r.status === 201).length;
      expect(createdCount).toBe(1);

      // Exactly one record in MongoDB
      const count = await Completion.countDocuments({
        habitId: habit._id,
        date: '2026-10-10',
      });
      expect(count).toBe(1);
    });

    it('Gate: rejects completion date earlier than habit startDate with 400', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Start Date Rule Habit',
        startDate: '2026-10-15',
      });

      const res = await request(app)
        .put(`/api/habits/${habit._id}/completions/2026-10-14`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('Gate: rejects far-future dates (beyond UTC today + 1 day) with 400', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Future Date Habit',
        startDate: '2026-10-01',
      });

      // Calculate UTC today + 2 days (must be rejected)
      const now = new Date();
      const futureDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2)
      );
      const futureDateStr = futureDate.toISOString().slice(0, 10);

      const res = await request(app)
        .put(`/api/habits/${habit._id}/completions/${futureDateStr}`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('allows completion date equal to UTC today + 1 day (tomorrow in UTC)', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Tolerance Habit',
        startDate: '2026-01-01',
      });

      const maxAllowed = getMaxAllowedCompletionDate();
      const res = await request(app)
        .put(`/api/habits/${habit._id}/completions/${maxAllowed}`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(201);
      expect(res.body.completion.date).toBe(maxAllowed);
    });

    it('Gate: rejects invalid calendar date strings (e.g. 2026-02-30) with 400', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Invalid Date Habit',
        startDate: '2026-01-01',
      });

      const res = await request(app)
        .put(`/api/habits/${habit._id}/completions/2026-02-30`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('Gate: archived habit blocks mutation and returns 409 HABIT_ARCHIVED', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Archived Habit',
        startDate: '2026-10-01',
        archivedAt: new Date(),
      });

      const res = await request(app)
        .put(`/api/habits/${habit._id}/completions/2026-10-05`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('HABIT_ARCHIVED');
    });

    it('returns 404 NOT_FOUND if habit belongs to another user', async () => {
      const userA = await createUserWithToken('userA@example.com');
      const userB = await createUserWithToken('userB@example.com');

      const habitA = await Habit.create({
        userId: userA.user._id,
        name: "User A's Habit",
        startDate: '2026-10-01',
      });

      const res = await request(app)
        .put(`/api/habits/${habitA._id}/completions/2026-10-05`)
        .set('Authorization', userB.authHeader);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/habits/:id/completions/:date (Undo)', () => {
    it('Gate: undo removes completion and returns 204 No Content', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Undo Habit',
        startDate: '2026-10-01',
      });

      // Create completion first
      await Completion.create({
        habitId: habit._id,
        userId: user._id,
        date: '2026-10-05',
      });

      const res = await request(app)
        .delete(`/api/habits/${habit._id}/completions/2026-10-05`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(204);

      const found = await Completion.findOne({
        habitId: habit._id,
        date: '2026-10-05',
      });
      expect(found).toBeNull();
    });

    it('Gate: undo is idempotent and returns 204 even if completion did not exist', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Idempotent Undo Habit',
        startDate: '2026-10-01',
      });

      const res = await request(app)
        .delete(`/api/habits/${habit._id}/completions/2026-10-05`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(204);
    });

    it('Gate: archived habit blocks undo mutation with 409 HABIT_ARCHIVED', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Archived Undo Habit',
        startDate: '2026-10-01',
        archivedAt: new Date(),
      });

      const res = await request(app)
        .delete(`/api/habits/${habit._id}/completions/2026-10-05`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('HABIT_ARCHIVED');
    });

    it('returns 404 NOT_FOUND if habit belongs to another user', async () => {
      const userA = await createUserWithToken('userA@example.com');
      const userB = await createUserWithToken('userB@example.com');

      const habitA = await Habit.create({
        userId: userA.user._id,
        name: "User A's Habit",
        startDate: '2026-10-01',
      });

      const res = await request(app)
        .delete(`/api/habits/${habitA._id}/completions/2026-10-05`)
        .set('Authorization', userB.authHeader);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/habits/:id/completions (List completions)', () => {
    it('returns completions sorted ascending { completions: [{ date }] }', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'History Habit',
        startDate: '2026-10-01',
      });

      await Completion.create({
        habitId: habit._id,
        userId: user._id,
        date: '2026-10-05',
      });
      await Completion.create({
        habitId: habit._id,
        userId: user._id,
        date: '2026-10-02',
      });
      await Completion.create({
        habitId: habit._id,
        userId: user._id,
        date: '2026-10-08',
      });

      const res = await request(app)
        .get(`/api/habits/${habit._id}/completions`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.completions).toEqual([
        { date: '2026-10-02' },
        { date: '2026-10-05' },
        { date: '2026-10-08' },
      ]);
    });

    it('filters completions by from and to query params', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Filter Habit',
        startDate: '2026-10-01',
      });

      await Completion.create({
        habitId: habit._id,
        userId: user._id,
        date: '2026-10-01',
      });
      await Completion.create({
        habitId: habit._id,
        userId: user._id,
        date: '2026-10-05',
      });
      await Completion.create({
        habitId: habit._id,
        userId: user._id,
        date: '2026-10-10',
      });

      const res = await request(app)
        .get(`/api/habits/${habit._id}/completions?from=2026-10-02&to=2026-10-08`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.completions).toEqual([{ date: '2026-10-05' }]);
    });

    it('allowed for archived habits', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Archived Read-only Habit',
        startDate: '2026-10-01',
        archivedAt: new Date(),
      });

      await Completion.create({
        habitId: habit._id,
        userId: user._id,
        date: '2026-10-02',
      });

      const res = await request(app)
        .get(`/api/habits/${habit._id}/completions`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.completions).toEqual([{ date: '2026-10-02' }]);
    });

    it('rejects from > to with 400 VALIDATION_ERROR', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Range Habit',
        startDate: '2026-10-01',
      });

      const res = await request(app)
        .get(`/api/habits/${habit._id}/completions?from=2026-10-10&to=2026-10-05`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects date range exceeding 400 days with 400 VALIDATION_ERROR', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Long Range Habit',
        startDate: '2025-01-01',
      });

      const res = await request(app)
        .get(`/api/habits/${habit._id}/completions?from=2025-01-01&to=2026-03-01`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Habit CRUD interactions with completions', () => {
    it('editing habit keeps all completions intact', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Edit Keeps Completions Habit',
        startDate: '2026-10-01',
      });

      await Completion.create({
        habitId: habit._id,
        userId: user._id,
        date: '2026-10-05',
      });

      await request(app)
        .patch(`/api/habits/${habit._id}`)
        .set('Authorization', authHeader)
        .send({
          name: 'Renamed Habit',
          startDate: '2026-10-03',
        });

      const completions = await Completion.find({ habitId: habit._id });
      expect(completions.length).toBe(1);
      expect(completions[0].date).toBe('2026-10-05');
    });
  });
});
