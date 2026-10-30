import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { habitsApi } from '../api/habits';
import type { Habit } from '../api/habits';
import { completionsApi } from '../api/completions';
import { useStats } from '../hooks/useStats';
import { StatCard } from '../components/StatCard';
import { HabitCard } from '../components/HabitCard';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { getLocalDateString } from '../utils/date';
import { getDailyQuote } from '../data/quotes';
import { Link } from 'react-router-dom';
import type { AxiosError } from 'axios';

export const Dashboard: React.FC = () => {
  // Build from and to local dates: to = today, from = today minus 29 days (30 days total)
  const { todayStr, fromStr } = useMemo(() => {
    const now = new Date();
    const today = getLocalDateString(now);
    const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    const from = getLocalDateString(past);
    return { todayStr: today, fromStr: from };
  }, []);

  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useStats(fromStr, todayStr);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [completedTodayHabitIds, setCompletedTodayHabitIds] = useState<Set<string>>(
    new Set()
  );
  const [habitsLoading, setHabitsLoading] = useState<boolean>(true);
  const [habitsError, setHabitsError] = useState<string | null>(null);
  const [togglingHabitId, setTogglingHabitId] = useState<string | null>(null);

  const fetchActiveHabitsAndCompletions = useCallback(async () => {
    setHabitsLoading(true);
    setHabitsError(null);
    try {
      const activeHabits = await habitsApi.getHabits('active');
      setHabits(activeHabits);

      // Fetch completions for today in parallel for each habit
      const completionChecks = await Promise.all(
        activeHabits.map(async (h) => {
          try {
            const list = await completionsApi.getCompletions(
              h._id,
              todayStr,
              todayStr
            );
            return { habitId: h._id, completed: list.length > 0 };
          } catch {
            return { habitId: h._id, completed: false };
          }
        })
      );

      const completedIds = new Set<string>();
      completionChecks.forEach((c) => {
        if (c.completed) completedIds.add(c.habitId);
      });
      setCompletedTodayHabitIds(completedIds);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ error?: { message?: string } }>;
      setHabitsError(
        axiosErr.response?.data?.error?.message || 'Failed to load habits'
      );
    } finally {
      setHabitsLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    fetchActiveHabitsAndCompletions();
  }, [fetchActiveHabitsAndCompletions]);

  const handleToggle = async (habit: Habit) => {
    if (togglingHabitId) return;

    setTogglingHabitId(habit._id);
    const isCompleted = completedTodayHabitIds.has(habit._id);

    try {
      if (isCompleted) {
        await completionsApi.deleteCompletion(habit._id, todayStr);
        setCompletedTodayHabitIds((prev) => {
          const next = new Set(prev);
          next.delete(habit._id);
          return next;
        });
      } else {
        await completionsApi.upsertCompletion(habit._id, todayStr);
        setCompletedTodayHabitIds((prev) => {
          const next = new Set(prev);
          next.add(habit._id);
          return next;
        });
      }
      // Refetch stats after completing/undoing
      await refetchStats();
    } catch {
      // Refresh to sync true state on failure
      await fetchActiveHabitsAndCompletions();
    } finally {
      setTogglingHabitId(null);
    }
  };

  const reloadAll = () => {
    refetchStats();
    fetchActiveHabitsAndCompletions();
  };

  const dailyQuote = useMemo(() => getDailyQuote(), []);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-muted mt-1">
          &ldquo;{dailyQuote.text}&rdquo;{dailyQuote.author ? ` — ${dailyQuote.author}` : ''}
        </p>
      </div>

      {/* Stats Row with vertical dividers, no card/box */}
      <div>
        {statsLoading ? (
          <div className="py-6">
            <Spinner size="sm" />
          </div>
        ) : statsError ? (
          <ErrorMessage message={statsError} onRetry={refetchStats} />
        ) : stats ? (
          <div className="flex border-b border-border pb-6">
            <StatCard
              label="Active habits"
              value={stats.activeHabits}
              isFirst
            />
            <StatCard
              label="Completions this week"
              value={stats.completionsThisWeek}
              subtext={`${stats.weekRange.from} to ${stats.weekRange.to}`}
            />
            <StatCard
              label="Completion rate"
              value={`${Math.round(stats.completionRate * 100)}%`}
              subtext={`${stats.period.from} to ${stats.period.to}`}
            />
          </div>
        ) : null}
      </div>

      {/* Today Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-medium text-text-primary">Today</h2>
          <span className="text-xs text-text-muted tabular-nums">{todayStr}</span>
        </div>

        {habitsLoading ? (
          <div className="py-8">
            <Spinner size="md" />
          </div>
        ) : habitsError ? (
          <ErrorMessage message={habitsError} onRetry={reloadAll} />
        ) : habits.length === 0 ? (
          <EmptyState
            message="No active habits yet."
            description="Create your first habit to begin tracking your daily progress."
            action={
              <Link
                to="/habits"
                className="text-xs bg-surface border border-border text-text-primary px-3 py-1.5 rounded-md hover:border-text-primary transition-colors inline-block"
              >
                Go to Habits
              </Link>
            }
          />
        ) : (
          <div>
            {habits.map((habit) => (
              <HabitCard
                key={habit._id}
                habit={habit}
                variant="dashboard"
                isCompleted={completedTodayHabitIds.has(habit._id)}
                onToggle={handleToggle}
                isToggling={togglingHabitId === habit._id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
