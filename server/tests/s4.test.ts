import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User, Habit, Completion } from '../src/models/index.js';
import { generateAccessToken } from '../src/services/authService.js';

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

describe('Phase S4 Habits CRUD & Ownership Enforcement', () => {
  describe('POST /api/habits (Create Habit)', () => {
    it('creates a habit with valid payload and returns 201 { habit }', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');

      const res = await request(app)
        .post('/api/habits')
        .set('Authorization', authHeader)
        .send({
          name: 'Read 20 pages',
          description: 'Daily reading habit',
          startDate: '2026-10-30',
          frequency: 'DAILY',
          category: 'Learning',
          reminderTime: '21:00',
        });

      expect(res.status).toBe(201);
      expect(res.body.habit).toBeDefined();
      expect(res.body.habit._id).toBeDefined();
      expect(res.body.habit.name).toBe('Read 20 pages');
      expect(res.body.habit.description).toBe('Daily reading habit');
      expect(res.body.habit.startDate).toBe('2026-10-30');
      expect(res.body.habit.frequency).toBe('DAILY');
      expect(res.body.habit.category).toBe('Learning');
      expect(res.body.habit.reminderTime).toBe('21:00');
      expect(res.body.habit.archivedAt).toBeNull();
      expect(res.body.habit.userId.toString()).toBe(user._id.toString());
    });

    it('rejects invalid calendar date like 2026-02-30 with 400 VALIDATION_ERROR', async () => {
      const { authHeader } = await createUserWithToken('alice@example.com');

      const res = await request(app)
        .post('/api/habits')
        .set('Authorization', authHeader)
        .send({
          name: 'Invalid Date Habit',
          startDate: '2026-02-30',
          frequency: 'DAILY',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.startDate).toBeDefined();
    });

    it('rejects blank name and missing required fields with 400 VALIDATION_ERROR', async () => {
      const { authHeader } = await createUserWithToken('alice@example.com');

      const res = await request(app)
        .post('/api/habits')
        .set('Authorization', authHeader)
        .send({
          name: '   ',
          startDate: '',
          frequency: 'MONTHLY',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.name).toBeDefined();
      expect(res.body.error.details.startDate).toBeDefined();
      expect(res.body.error.details.frequency).toBeDefined();
    });

    it('ignores client attempts to set userId, archivedAt, or _id in body', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const fakeUserId = new Types.ObjectId();
      const fakeHabitId = new Types.ObjectId();

      const res = await request(app)
        .post('/api/habits')
        .set('Authorization', authHeader)
        .send({
          _id: fakeHabitId,
          userId: fakeUserId,
          archivedAt: new Date(),
          name: 'Security Test Habit',
          startDate: '2026-10-30',
          frequency: 'DAILY',
        });

      expect(res.status).toBe(201);
      expect(res.body.habit.userId.toString()).toBe(user._id.toString());
      expect(res.body.habit.userId.toString()).not.toBe(fakeUserId.toString());
      expect(res.body.habit.archivedAt).toBeNull();
      expect(res.body.habit._id.toString()).not.toBe(fakeHabitId.toString());
    });
  });

  describe('GET /api/habits (List Habits)', () => {
    it('returns empty list { habits: [] } when user has no habits', async () => {
      const { authHeader } = await createUserWithToken('alice@example.com');

      const res = await request(app)
        .get('/api/habits')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.habits).toEqual([]);
    });

    it('returns active habits sorted by createdAt desc by default', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');

      const habit1 = await Habit.create({
        userId: user._id,
        name: 'First Habit',
        startDate: '2026-10-01',
        createdAt: new Date('2026-10-01T10:00:00Z'),
      });
      const habit2 = await Habit.create({
        userId: user._id,
        name: 'Second Habit',
        startDate: '2026-10-02',
        createdAt: new Date('2026-10-02T10:00:00Z'),
      });
      // Archived habit should be excluded
      await Habit.create({
        userId: user._id,
        name: 'Archived Habit',
        startDate: '2026-09-01',
        archivedAt: new Date(),
      });

      const res = await request(app)
        .get('/api/habits')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.habits.length).toBe(2);
      expect(res.body.habits[0]._id.toString()).toBe(habit2._id.toString());
      expect(res.body.habits[1]._id.toString()).toBe(habit1._id.toString());
    });

    it('returns archived habits when status=archived', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');

      await Habit.create({
        userId: user._id,
        name: 'Active Habit',
        startDate: '2026-10-01',
      });
      const archivedHabit = await Habit.create({
        userId: user._id,
        name: 'Old Habit',
        startDate: '2026-08-01',
        archivedAt: new Date(),
      });

      const res = await request(app)
        .get('/api/habits?status=archived')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.habits.length).toBe(1);
      expect(res.body.habits[0]._id.toString()).toBe(archivedHabit._id.toString());
      expect(res.body.habits[0].archivedAt).not.toBeNull();
    });

    it('returns 400 VALIDATION_ERROR on invalid status query param', async () => {
      const { authHeader } = await createUserWithToken('alice@example.com');

      const res = await request(app)
        .get('/api/habits?status=invalid_status')
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/habits/:id', () => {
    it('returns 200 { habit } for existing habit, including archived ones', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');

      const habit = await Habit.create({
        userId: user._id,
        name: 'Archived Meditation',
        startDate: '2026-01-01',
        archivedAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/habits/${habit._id}`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.habit._id.toString()).toBe(habit._id.toString());
      expect(res.body.habit.name).toBe('Archived Meditation');
    });

    it('returns 404 NOT_FOUND for non-existent habit', async () => {
      const { authHeader } = await createUserWithToken('alice@example.com');
      const nonExistentId = new Types.ObjectId();

      const res = await request(app)
        .get(`/api/habits/${nonExistentId}`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 NOT_FOUND for invalid ObjectId in :id parameter', async () => {
      const { authHeader } = await createUserWithToken('alice@example.com');

      const res = await request(app)
        .get('/api/habits/invalid-object-id')
        .set('Authorization', authHeader);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/habits/:id', () => {
    it('updates allowed habit fields and returns 200 { habit }', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');

      const habit = await Habit.create({
        userId: user._id,
        name: 'Original Habit',
        description: 'Old description',
        startDate: '2026-10-01',
        frequency: 'DAILY',
      });

      const res = await request(app)
        .patch(`/api/habits/${habit._id}`)
        .set('Authorization', authHeader)
        .send({
          name: 'Updated Habit Name',
          description: 'New description',
          startDate: '2026-10-15',
          category: 'Health',
          reminderTime: '08:00',
        });

      expect(res.status).toBe(200);
      expect(res.body.habit.name).toBe('Updated Habit Name');
      expect(res.body.habit.description).toBe('New description');
      expect(res.body.habit.startDate).toBe('2026-10-15');
      expect(res.body.habit.category).toBe('Health');
      expect(res.body.habit.reminderTime).toBe('08:00');
    });

    it('rejects invalid field updates with 400 VALIDATION_ERROR', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');

      const habit = await Habit.create({
        userId: user._id,
        name: 'Test Habit',
        startDate: '2026-10-01',
      });

      const res = await request(app)
        .patch(`/api/habits/${habit._id}`)
        .set('Authorization', authHeader)
        .send({
          name: '   ',
          startDate: '2026-02-30', // invalid date
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.name).toBeDefined();
      expect(res.body.error.details.startDate).toBeDefined();
    });
  });

  describe('DELETE /api/habits/:id', () => {
    it('hard deletes the habit and removes all associated completions with 204', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');

      const habit = await Habit.create({
        userId: user._id,
        name: 'Habit to delete',
        startDate: '2026-10-01',
      });

      // Add completions for this habit
      await Completion.create({
        habitId: habit._id,
        userId: user._id,
        date: '2026-10-05',
      });
      await Completion.create({
        habitId: habit._id,
        userId: user._id,
        date: '2026-10-06',
      });

      const res = await request(app)
        .delete(`/api/habits/${habit._id}`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(204);

      // Verify habit is deleted from DB
      const dbHabit = await Habit.findById(habit._id);
      expect(dbHabit).toBeNull();

      // Verify all completions for this habit are deleted
      const completions = await Completion.find({ habitId: habit._id });
      expect(completions.length).toBe(0);
    });

    it('returns 404 NOT_FOUND when attempting to delete non-existent habit', async () => {
      const { authHeader } = await createUserWithToken('alice@example.com');
      const nonExistentId = new Types.ObjectId();

      const res = await request(app)
        .delete(`/api/habits/${nonExistentId}`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/habits/:id/archive and /unarchive', () => {
    it('archives habit by setting archivedAt, and is idempotent', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');

      const habit = await Habit.create({
        userId: user._id,
        name: 'Habit to archive',
        startDate: '2026-10-01',
      });

      const res1 = await request(app)
        .post(`/api/habits/${habit._id}/archive`)
        .set('Authorization', authHeader);

      expect(res1.status).toBe(200);
      expect(res1.body.habit.archivedAt).not.toBeNull();

      // Idempotency check: call archive a second time
      const res2 = await request(app)
        .post(`/api/habits/${habit._id}/archive`)
        .set('Authorization', authHeader);

      expect(res2.status).toBe(200);
      expect(res2.body.habit.archivedAt).not.toBeNull();
    });

    it('unarchives habit by setting archivedAt to null', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');

      const habit = await Habit.create({
        userId: user._id,
        name: 'Archived Habit to restore',
        startDate: '2026-10-01',
        archivedAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/habits/${habit._id}/unarchive`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.habit.archivedAt).toBeNull();
    });
  });

  describe('Gate requirement: Ownership enforcement (User B gets 404 on User A habit)', () => {
    let userAHabitId: string;
    let userBAuthHeader: string;

    beforeEach(async () => {
      const userA = await createUserWithToken('userA@example.com', 'User', 'A');
      const habitA = await Habit.create({
        userId: userA.user._id,
        name: "User A's Secret Habit",
        startDate: '2026-10-01',
      });
      userAHabitId = habitA._id.toString();

      const userB = await createUserWithToken('userB@example.com', 'User', 'B');
      userBAuthHeader = userB.authHeader;
    });

    it('User B receives 404 (never 403) on GET /habits/:id for User A habit', async () => {
      const res = await request(app)
        .get(`/api/habits/${userAHabitId}`)
        .set('Authorization', userBAuthHeader);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('User B receives 404 (never 403) on PATCH /habits/:id for User A habit', async () => {
      const res = await request(app)
        .patch(`/api/habits/${userAHabitId}`)
        .set('Authorization', userBAuthHeader)
        .send({ name: 'Hacked Habit Name' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');

      // Verify in DB that User A's habit name was not changed
      const dbHabit = await Habit.findById(userAHabitId);
      expect(dbHabit?.name).toBe("User A's Secret Habit");
    });

    it('User B receives 404 (never 403) on DELETE /habits/:id for User A habit', async () => {
      const res = await request(app)
        .delete(`/api/habits/${userAHabitId}`)
        .set('Authorization', userBAuthHeader);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');

      // Verify in DB that User A's habit was not deleted
      const dbHabit = await Habit.findById(userAHabitId);
      expect(dbHabit).not.toBeNull();
    });

    it('User B receives 404 (never 403) on POST /habits/:id/archive for User A habit', async () => {
      const res = await request(app)
        .post(`/api/habits/${userAHabitId}/archive`)
        .set('Authorization', userBAuthHeader);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('User B receives 404 (never 403) on POST /habits/:id/unarchive for User A habit', async () => {
      const res = await request(app)
        .post(`/api/habits/${userAHabitId}/unarchive`)
        .set('Authorization', userBAuthHeader);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('User B does not see User A habits in GET /habits list', async () => {
      const res = await request(app)
        .get('/api/habits')
        .set('Authorization', userBAuthHeader);

      expect(res.status).toBe(200);
      expect(res.body.habits).toEqual([]);
    });
  });
});
