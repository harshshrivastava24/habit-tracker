import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, Habit, Completion, RefreshToken } from '../src/models/index.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  // Ensure indexes are built
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

describe('Phase S2 Models and Indexes', () => {
  describe('User Model', () => {
    it('creates a user with valid attributes', async () => {
      const user = await User.create({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        passwordHash: '$2b$10$hashedpasswordstring',
      });

      expect(user._id).toBeDefined();
      expect(user.firstName).toBe('Jane');
      expect(user.lastName).toBe('Doe');
      expect(user.email).toBe('jane.doe@example.com');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('Gate: enforces unique email index', async () => {
      await User.create({
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
        passwordHash: '$2b$10$hashedpassword1',
      });

      await expect(
        User.create({
          firstName: 'Alice2',
          lastName: 'Smith2',
          email: 'alice@example.com',
          passwordHash: '$2b$10$hashedpassword2',
        })
      ).rejects.toThrow(/E11000 duplicate key error/);
    });

    it('lowercases and trims email', async () => {
      const user = await User.create({
        firstName: ' Bob ',
        lastName: ' Builder ',
        email: '  BOB.builder@EXAMPLE.COM  ',
        passwordHash: '$2b$10$hashedpassword',
      });

      expect(user.email).toBe('bob.builder@example.com');
      expect(user.firstName).toBe('Bob');
      expect(user.lastName).toBe('Builder');
    });

    it('does not return passwordHash in queries by default and excludes it from toJSON', async () => {
      const created = await User.create({
        firstName: 'Secret',
        lastName: 'User',
        email: 'secret@example.com',
        passwordHash: '$2b$10$supersecretpasswordhash',
      });

      const found = await User.findById(created._id);
      expect(found).toBeDefined();
      expect(found?.passwordHash).toBeUndefined();

      const json = found?.toJSON();
      expect(json?.passwordHash).toBeUndefined();
      expect(json?.__v).toBeUndefined();
    });

    it('validates required fields', async () => {
      await expect(
        User.create({
          firstName: '',
          lastName: '',
          email: 'invalid-email',
        })
      ).rejects.toThrow();
    });
  });

  describe('Habit Model', () => {
    it('creates a habit with valid attributes and defaults', async () => {
      const userId = new Types.ObjectId();
      const habit = await Habit.create({
        userId,
        name: 'Morning Meditation',
        description: '10 minutes of mindfulness',
        startDate: '2026-10-30',
      });

      expect(habit._id).toBeDefined();
      expect(habit.userId.toString()).toBe(userId.toString());
      expect(habit.name).toBe('Morning Meditation');
      expect(habit.description).toBe('10 minutes of mindfulness');
      expect(habit.startDate).toBe('2026-10-30');
      expect(habit.frequency).toBe('DAILY');
      expect(habit.archivedAt).toBeNull();
      expect(habit.category).toBeNull();
      expect(habit.reminderTime).toBeNull();
      expect(habit.createdAt).toBeInstanceOf(Date);
      expect(habit.updatedAt).toBeInstanceOf(Date);
    });

    it('validates startDate format YYYY-MM-DD', async () => {
      const userId = new Types.ObjectId();
      await expect(
        Habit.create({
          userId,
          name: 'Exercise',
          startDate: '30-10-2026', // invalid format
        })
      ).rejects.toThrow();
    });

    it('validates frequency enum', async () => {
      const userId = new Types.ObjectId();
      await expect(
        Habit.create({
          userId,
          name: 'Invalid Frequency Habit',
          startDate: '2026-10-30',
          frequency: 'MONTHLY' as unknown as 'DAILY',
        })
      ).rejects.toThrow();
    });

    it('has compound index { userId: 1, archivedAt: 1 } defined', () => {
      const indexes = Habit.schema.indexes();
      const hasUserArchivedIndex = indexes.some(([fields]) => {
        return fields.userId === 1 && fields.archivedAt === 1;
      });
      expect(hasUserArchivedIndex).toBe(true);
    });
  });

  describe('Completion Model', () => {
    it('creates a completion record with habitId, userId, and date', async () => {
      const habitId = new Types.ObjectId();
      const userId = new Types.ObjectId();
      const completion = await Completion.create({
        habitId,
        userId,
        date: '2026-10-30',
      });

      expect(completion._id).toBeDefined();
      expect(completion.habitId.toString()).toBe(habitId.toString());
      expect(completion.userId.toString()).toBe(userId.toString());
      expect(completion.date).toBe('2026-10-30');
      expect(completion.createdAt).toBeInstanceOf(Date);
    });

    it('Gate: enforces unique compound index on { habitId: 1, date: 1 }', async () => {
      const habitId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      await Completion.create({
        habitId,
        userId,
        date: '2026-10-30',
      });

      // Attempting to complete the same habit on the same day must fail
      await expect(
        Completion.create({
          habitId,
          userId,
          date: '2026-10-30',
        })
      ).rejects.toThrow(/E11000 duplicate key error/);
    });

    it('allows different habits to be completed on the same date', async () => {
      const habit1 = new Types.ObjectId();
      const habit2 = new Types.ObjectId();
      const userId = new Types.ObjectId();

      const c1 = await Completion.create({
        habitId: habit1,
        userId,
        date: '2026-10-30',
      });
      const c2 = await Completion.create({
        habitId: habit2,
        userId,
        date: '2026-10-30',
      });

      expect(c1._id).toBeDefined();
      expect(c2._id).toBeDefined();
    });

    it('allows the same habit to be completed on different dates', async () => {
      const habitId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      const c1 = await Completion.create({
        habitId,
        userId,
        date: '2026-10-29',
      });
      const c2 = await Completion.create({
        habitId,
        userId,
        date: '2026-10-30',
      });

      expect(c1._id).toBeDefined();
      expect(c2._id).toBeDefined();
    });

    it('has { userId: 1, date: 1 } index defined for stats', () => {
      const indexes = Completion.schema.indexes();
      const hasUserDateIndex = indexes.some(([fields]) => {
        return fields.userId === 1 && fields.date === 1;
      });
      expect(hasUserDateIndex).toBe(true);
    });
  });

  describe('RefreshToken Model', () => {
    it('creates a refresh token record with valid fields and defaults', async () => {
      const userId = new Types.ObjectId();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const token = await RefreshToken.create({
        userId,
        tokenHash: 'abc123sha256hash',
        expiresAt,
      });

      expect(token._id).toBeDefined();
      expect(token.userId.toString()).toBe(userId.toString());
      expect(token.tokenHash).toBe('abc123sha256hash');
      expect(token.expiresAt.getTime()).toBe(expiresAt.getTime());
      expect(token.revokedAt).toBeNull();
      expect(token.createdAt).toBeInstanceOf(Date);
    });

    it('has TTL index defined on expiresAt with expireAfterSeconds 0', () => {
      const indexes = RefreshToken.schema.indexes();
      const hasTtlIndex = indexes.some(([fields, options]) => {
        return fields.expiresAt === 1 && options?.expireAfterSeconds === 0;
      });
      expect(hasTtlIndex).toBe(true);
    });
  });
});
