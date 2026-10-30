import { Types } from 'mongoose';
import { Habit, Completion } from '../models/index.js';
import {
  getTodayUTC,
  addDaysToDate,
  getMaxAllowedCompletionDate,
  getDaysDifference,
  getISOWeekRange,
  isValidDateString,
} from '../utils/dateUtils.js';

export interface PeriodRange {
  from: string;
  to: string;
}

export interface HabitStat {
  habitId: string;
  name: string;
  completions: number;
  expected: number;
  rate: number;
}

export interface DashboardStats {
  period: PeriodRange;
  activeHabits: number;
  completionsThisWeek: number;
  weekRange: PeriodRange;
  completionsInPeriod: number;
  expectedCompletions: number;
  completionRate: number;
  perHabit: HabitStat[];
}

/**
 * Pure function computing expected completions for a habit in a period.
 * Expected = number of days from max(from, habit.startDate) to min(to, allowedMaxDate) inclusive (0 if empty range).
 */
export const calculateExpectedCompletions = (
  startDate: string,
  from: string,
  to: string,
  allowedMaxDate: string = getMaxAllowedCompletionDate()
): number => {
  const cappedEnd = to < allowedMaxDate ? to : allowedMaxDate;
  const effectiveStart = from > startDate ? from : startDate;

  if (effectiveStart > cappedEnd) {
    return 0;
  }

  return getDaysDifference(effectiveStart, cappedEnd) + 1;
};

/**
 * Computes dashboard statistics for the authenticated user over [from, to].
 */
export const getDashboardStats = async (
  userId: string,
  from?: string,
  to?: string
): Promise<DashboardStats> => {
  const resolvedTo = to && isValidDateString(to) ? to : getTodayUTC();
  const resolvedFrom =
    from && isValidDateString(from) ? from : addDaysToDate(resolvedTo, -29);

  const weekRange = getISOWeekRange(resolvedTo);
  const allowedMaxDate = getMaxAllowedCompletionDate();

  // PRD Section 7.4: Stats cover active (non-archived) habits only
  const activeHabits = await Habit.find({
    userId: new Types.ObjectId(userId),
    archivedAt: null,
  }).sort({ createdAt: -1 });

  if (activeHabits.length === 0) {
    return {
      period: { from: resolvedFrom, to: resolvedTo },
      activeHabits: 0,
      completionsThisWeek: 0,
      weekRange,
      completionsInPeriod: 0,
      expectedCompletions: 0,
      completionRate: 0,
      perHabit: [],
    };
  }

  const activeHabitIds = activeHabits.map((h) => h._id);

  // Completions this week for active habits
  const completionsThisWeek = await Completion.countDocuments({
    userId: new Types.ObjectId(userId),
    habitId: { $in: activeHabitIds },
    date: { $gte: weekRange.from, $lte: weekRange.to },
  });

  // Completions in the period via aggregation grouped by habitId
  const completionsInPeriod = await Completion.aggregate<{
    _id: Types.ObjectId;
    dates: string[];
  }>([
    {
      $match: {
        userId: new Types.ObjectId(userId),
        habitId: { $in: activeHabitIds },
        date: { $gte: resolvedFrom, $lte: resolvedTo },
      },
    },
    {
      $group: {
        _id: '$habitId',
        dates: { $push: '$date' },
      },
    },
  ]);

  const habitCompletionsMap = new Map<string, string[]>();
  for (const group of completionsInPeriod) {
    habitCompletionsMap.set(group._id.toString(), group.dates);
  }

  const perHabit: HabitStat[] = [];
  let totalCompletionsInPeriod = 0;
  let totalExpectedCompletions = 0;

  for (const habit of activeHabits) {
    const habitIdStr = habit._id.toString();
    const expected = calculateExpectedCompletions(
      habit.startDate,
      resolvedFrom,
      resolvedTo,
      allowedMaxDate
    );

    const effectiveStart =
      resolvedFrom > habit.startDate ? resolvedFrom : habit.startDate;
    const cappedEnd = resolvedTo < allowedMaxDate ? resolvedTo : allowedMaxDate;

    const dates = habitCompletionsMap.get(habitIdStr) || [];
    // Only completions with date inside [max(from, startDate), min(to, allowedMaxDate)] count
    const validCount =
      effectiveStart <= cappedEnd
        ? dates.filter((d) => d >= effectiveStart && d <= cappedEnd).length
        : 0;

    const rate = expected > 0 ? Number((validCount / expected).toFixed(2)) : 0;

    perHabit.push({
      habitId: habitIdStr,
      name: habit.name,
      completions: validCount,
      expected,
      rate,
    });

    totalCompletionsInPeriod += validCount;
    totalExpectedCompletions += expected;
  }

  const completionRate =
    totalExpectedCompletions > 0
      ? Number((totalCompletionsInPeriod / totalExpectedCompletions).toFixed(2))
      : 0;

  return {
    period: { from: resolvedFrom, to: resolvedTo },
    activeHabits: activeHabits.length,
    completionsThisWeek,
    weekRange,
    completionsInPeriod: totalCompletionsInPeriod,
    expectedCompletions: totalExpectedCompletions,
    completionRate,
    perHabit,
  };
};
