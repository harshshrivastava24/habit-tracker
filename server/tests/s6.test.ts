import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User, Habit, Completion } from '../src/models/index.js';
import { generateAccessToken } from '../src/services/authService.js';
import { calculateExpectedCompletions } from '../src/services/statsService.js';
import {
  isValidDateString,
  getDaysDifference,
  addDaysToDate,
  getISOWeekRange,
  getTodayUTC,
} from '../src/utils/dateUtils.js';

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

const createUserWithToken = async (
  email: string,
  firstName = 'Test',
  lastName = 'User'
) => {
  const user = await User.create({
    firstName,
    lastName,
    email,
    passwordHash: '$2b$10$hashedpasswordplaceholder',
  });
  const token = generateAccessToken(user._id.toString(), user.email);
  return { user, token, authHeader: `Bearer ${token}` };
};

describe('Phase S6 Dashboard Stats & Service', () => {
  describe('Unit tests: dateUtils', () => {
    it('isValidDateString correctly validates real calendar dates and rejects impossible dates', () => {
      expect(isValidDateString('2026-10-30')).toBe(true);
      expect(isValidDateString('2024-02-29')).toBe(true); // Leap year
      expect(isValidDateString('2026-02-29')).toBe(false); // Non-leap year
      expect(isValidDateString('2026-02-30')).toBe(false); // Impossible date
      expect(isValidDateString('2026-04-31')).toBe(false); // April has 30 days
      expect(isValidDateString('2026-13-01')).toBe(false); // Invalid month
      expect(isValidDateString('not-a-date')).toBe(false);
      expect(isValidDateString('')).toBe(false);
    });

    it('getDaysDifference calculates difference in calendar days', () => {
      expect(getDaysDifference('2026-10-01', '2026-10-01')).toBe(0);
      expect(getDaysDifference('2026-10-01', '2026-10-29')).toBe(28);
      expect(getDaysDifference('2026-01-01', '2026-12-31')).toBe(364);
    });

    it('addDaysToDate correctly shifts calendar days across months and years', () => {
      expect(addDaysToDate('2026-10-29', -28)).toBe('2026-10-01');
      expect(addDaysToDate('2026-10-31', 1)).toBe('2026-11-01');
      expect(addDaysToDate('2026-01-01', -1)).toBe('2025-12-31');
    });

    it('getISOWeekRange returns Monday through Sunday containing the given date', () => {
      // 2026-10-29 is a Thursday
      const thursdayRange = getISOWeekRange('2026-10-29');
      expect(thursdayRange).toEqual({ from: '2026-10-26', to: '2026-11-01' });

      // Monday of the same week
      const mondayRange = getISOWeekRange('2026-10-26');
      expect(mondayRange).toEqual({ from: '2026-10-26', to: '2026-11-01' });

      // Sunday of the same week
      const sundayRange = getISOWeekRange('2026-11-01');
      expect(sundayRange).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    });
  });

  describe('Gate requirement: Unit tests for denominator (calculateExpectedCompletions)', () => {
    it('calculates full period denominator when habit started before or on period from', () => {
      // Habit started 2026-10-01, period from 2026-10-01 to 2026-10-29 (29 days inclusive)
      const expected = calculateExpectedCompletions(
        '2026-10-01',
        '2026-10-01',
        '2026-10-29',
        '2026-12-31'
      );
      expect(expected).toBe(29);
    });

    it('Gate: calculates mid-period startDate denominator correctly', () => {
      // Habit started mid-period on 2026-10-15, period from 2026-10-01 to 2026-10-29
      // Expected should be days from 2026-10-15 to 2026-10-29 inclusive: (29 - 15) + 1 = 15
      const expected = calculateExpectedCompletions(
        '2026-10-15',
        '2026-10-01',
        '2026-10-29',
        '2026-12-31'
      );
      expect(expected).toBe(15);
    });

    it('returns 0 when habit startDate is after the period', () => {
      // Habit starts 2026-11-05, period ends 2026-10-29
      const expected = calculateExpectedCompletions(
        '2026-11-05',
        '2026-10-01',
        '2026-10-29',
        '2026-12-31'
      );
      expect(expected).toBe(0);
    });

    it('caps future "to" date by allowedMaxDate', () => {
      // Period to is 2026-11-15, but allowedMaxDate is 2026-10-31
      // Start is 2026-10-01 -> days from 2026-10-01 to 2026-10-31 inclusive = 31
      const expected = calculateExpectedCompletions(
        '2026-10-01',
        '2026-10-01',
        '2026-11-15',
        '2026-10-31'
      );
      expect(expected).toBe(31);
    });

    it('returns 0 if start date is after capped allowedMaxDate', () => {
      const expected = calculateExpectedCompletions(
        '2026-11-05',
        '2026-10-01',
        '2026-11-15',
        '2026-10-31'
      );
      expect(expected).toBe(0);
    });
  });

  describe('GET /api/dashboard/stats (Integration)', () => {
    it('returns empty stats with 0 active habits and rate 0 when user has no active habits', async () => {
      const { authHeader } = await createUserWithToken('alice@example.com');

      const res = await request(app)
        .get('/api/dashboard/stats?from=2026-10-01&to=2026-10-29')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        period: { from: '2026-10-01', to: '2026-10-29' },
        activeHabits: 0,
        completionsThisWeek: 0,
        weekRange: { from: '2026-10-26', to: '2026-11-01' },
        completionsInPeriod: 0,
        expectedCompletions: 0,
        completionRate: 0,
        perHabit: [],
      });
    });

    it('defaults to last 30 days when from and to are omitted', async () => {
      const { authHeader } = await createUserWithToken('alice@example.com');

      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      const today = getTodayUTC();
      const expectedFrom = addDaysToDate(today, -29);
      expect(res.body.period.to).toBe(today);
      expect(res.body.period.from).toBe(expectedFrom);
      expect(res.body.weekRange).toEqual(getISOWeekRange(today));
    });

    it('correctly calculates stats matching the PRD formula and format', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');

      // Create two active habits
      const habit1 = await Habit.create({
        userId: user._id,
        name: 'Read',
        startDate: '2026-10-01',
      });
      const habit2 = await Habit.create({
        userId: user._id,
        name: 'Exercise',
        startDate: '2026-10-15', // mid-period start date
      });

      // Add completions for Habit 1 (3 completions)
      await Completion.create({
        habitId: habit1._id,
        userId: user._id,
        date: '2026-10-05',
      });
      await Completion.create({
        habitId: habit1._id,
        userId: user._id,
        date: '2026-10-06',
      });
      await Completion.create({
        habitId: habit1._id,
        userId: user._id,
        date: '2026-10-28', // falls in ISO week of 2026-10-29
      });

      // Add completions for Habit 2 (2 completions)
      await Completion.create({
        habitId: habit2._id,
        userId: user._id,
        date: '2026-10-20',
      });
      await Completion.create({
        habitId: habit2._id,
        userId: user._id,
        date: '2026-10-27', // falls in ISO week of 2026-10-29
      });

      const res = await request(app)
        .get('/api/dashboard/stats?from=2026-10-01&to=2026-10-29')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.activeHabits).toBe(2);
      expect(res.body.period).toEqual({ from: '2026-10-01', to: '2026-10-29' });
      expect(res.body.weekRange).toEqual({ from: '2026-10-26', to: '2026-11-01' });

      // Completions this week: 2026-10-28 (Habit 1) + 2026-10-27 (Habit 2) = 2
      expect(res.body.completionsThisWeek).toBe(2);

      // Total completions in period: 3 + 2 = 5
      expect(res.body.completionsInPeriod).toBe(5);

      // Expected completions:
      // Habit 1: 2026-10-01 to 2026-10-29 = 29
      // Habit 2: 2026-10-15 to 2026-10-29 = 15
      // Total expected = 44
      expect(res.body.expectedCompletions).toBe(44);

      // Completion rate: 5 / 44 = 0.1136... -> 0.11
      expect(res.body.completionRate).toBe(0.11);

      // Per habit breakdown
      expect(res.body.perHabit.length).toBe(2);
      const readStat = res.body.perHabit.find(
        (h: { name: string }) => h.name === 'Read'
      );
      expect(readStat).toEqual({
        habitId: habit1._id.toString(),
        name: 'Read',
        completions: 3,
        expected: 29,
        rate: 0.1, // 3 / 29 = 0.103... -> 0.1
      });

      const exerciseStat = res.body.perHabit.find(
        (h: { name: string }) => h.name === 'Exercise'
      );
      expect(exerciseStat).toEqual({
        habitId: habit2._id.toString(),
        name: 'Exercise',
        completions: 2,
        expected: 15,
        rate: 0.13, // 2 / 15 = 0.133... -> 0.13
      });
    });

    it('Stats change dynamically after adding and removing a completion', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');
      const habit = await Habit.create({
        userId: user._id,
        name: 'Dynamic Habit',
        startDate: '2026-10-01',
      });

      // Initial stats
      const initialRes = await request(app)
        .get('/api/dashboard/stats?from=2026-10-01&to=2026-10-10')
        .set('Authorization', authHeader);
      expect(initialRes.body.completionsInPeriod).toBe(0);
      expect(initialRes.body.completionRate).toBe(0);

      // Add completion via PUT
      await request(app)
        .put(`/api/habits/${habit._id}/completions/2026-10-05`)
        .set('Authorization', authHeader);

      const afterAddRes = await request(app)
        .get('/api/dashboard/stats?from=2026-10-01&to=2026-10-10')
        .set('Authorization', authHeader);
      expect(afterAddRes.body.completionsInPeriod).toBe(1);
      // 1 / 10 = 0.1
      expect(afterAddRes.body.completionRate).toBe(0.1);

      // Remove completion via DELETE
      await request(app)
        .delete(`/api/habits/${habit._id}/completions/2026-10-05`)
        .set('Authorization', authHeader);

      const afterRemoveRes = await request(app)
        .get('/api/dashboard/stats?from=2026-10-01&to=2026-10-10')
        .set('Authorization', authHeader);
      expect(afterRemoveRes.body.completionsInPeriod).toBe(0);
      expect(afterRemoveRes.body.completionRate).toBe(0);
    });

    it('archived habits are completely excluded from stats', async () => {
      const { authHeader, user } = await createUserWithToken('alice@example.com');

      // Create an active habit
      const activeHabit = await Habit.create({
        userId: user._id,
        name: 'Active Habit',
        startDate: '2026-10-01',
      });
      await Completion.create({
        habitId: activeHabit._id,
        userId: user._id,
        date: '2026-10-05',
      });

      // Create an archived habit with completions
      const archivedHabit = await Habit.create({
        userId: user._id,
        name: 'Archived Habit',
        startDate: '2026-10-01',
        archivedAt: new Date(),
      });
      await Completion.create({
        habitId: archivedHabit._id,
        userId: user._id,
        date: '2026-10-05',
      });

      const res = await request(app)
        .get('/api/dashboard/stats?from=2026-10-01&to=2026-10-10')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.activeHabits).toBe(1);
      expect(res.body.completionsInPeriod).toBe(1);
      expect(res.body.perHabit.length).toBe(1);
      expect(res.body.perHabit[0].name).toBe('Active Habit');
    });

    it('validates query parameters: rejects from > to and range > 366 days', async () => {
      const { authHeader } = await createUserWithToken('alice@example.com');

      const res1 = await request(app)
        .get('/api/dashboard/stats?from=2026-10-20&to=2026-10-10')
        .set('Authorization', authHeader);
      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe('VALIDATION_ERROR');

      const res2 = await request(app)
        .get('/api/dashboard/stats?from=2025-01-01&to=2026-02-01')
        .set('Authorization', authHeader);
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('VALIDATION_ERROR');

      const res3 = await request(app)
        .get('/api/dashboard/stats?from=2026-02-30&to=2026-10-10')
        .set('Authorization', authHeader);
      expect(res3.status).toBe(400);
      expect(res3.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('user isolation: user B does not see user A stats', async () => {
      const userA = await createUserWithToken('userA@example.com');
      const userB = await createUserWithToken('userB@example.com');

      const habitA = await Habit.create({
        userId: userA.user._id,
        name: "User A's Habit",
        startDate: '2026-10-01',
      });
      await Completion.create({
        habitId: habitA._id,
        userId: userA.user._id,
        date: '2026-10-05',
      });

      const resB = await request(app)
        .get('/api/dashboard/stats?from=2026-10-01&to=2026-10-10')
        .set('Authorization', userB.authHeader);

      expect(resB.status).toBe(200);
      expect(resB.body.activeHabits).toBe(0);
      expect(resB.body.completionsInPeriod).toBe(0);
      expect(resB.body.perHabit).toEqual([]);
    });
  });
});
