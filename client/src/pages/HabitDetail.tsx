import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { habitsApi } from '../api/habits';
import type { Habit, UpdateHabitData } from '../api/habits';
import { completionsApi } from '../api/completions';
import { Calendar } from '../components/Calendar';
import { Modal } from '../components/Modal';
import { HabitForm } from '../components/HabitForm';
import { Spinner } from '../components/Spinner';
import { ErrorMessage } from '../components/ErrorMessage';
import type { AxiosError } from 'axios';

export const HabitDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [habit, setHabit] = useState<Habit | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());
  const [completionsLoading, setCompletionsLoading] = useState<boolean>(false);
  const [isToggling, setIsToggling] = useState<boolean>(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage((cur) => (cur === msg ? null : cur));
    }, 4000);
  };

  const fetchHabit = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await habitsApi.getHabit(id);
      setHabit(data);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ error?: { message?: string } }>;
      setError(axiosErr.response?.data?.error?.message || 'Failed to load habit');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchHabit();
  }, [fetchHabit]);

  const fetchMonthCompletions = useCallback(async () => {
    if (!id) return;
    setCompletionsLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      const list = await completionsApi.getCompletions(id, from, to);
      setCompletedDates(new Set(list.map((c) => c.date)));
    } catch {
      // Keep existing completedDates on error
    } finally {
      setCompletionsLoading(false);
    }
  }, [id, currentMonth]);

  useEffect(() => {
    if (habit) {
      fetchMonthCompletions();
    }
  }, [habit, fetchMonthCompletions]);

  const handleToggleDate = async (dateStr: string) => {
    if (!habit || isToggling || Boolean(habit.archivedAt)) return;

    setIsToggling(true);
    const isCurrentlyCompleted = completedDates.has(dateStr);

    try {
      if (isCurrentlyCompleted) {
        await completionsApi.deleteCompletion(habit._id, dateStr);
        setCompletedDates((prev) => {
          const next = new Set(prev);
          next.delete(dateStr);
          return next;
        });
      } else {
        await completionsApi.upsertCompletion(habit._id, dateStr);
        setCompletedDates((prev) => {
          const next = new Set(prev);
          next.add(dateStr);
          return next;
        });
      }
    } catch {
      // On failure, refetch to restore true server state
      await fetchMonthCompletions();
    } finally {
      setIsToggling(false);
    }
  };

  const handleEditSubmit = async (data: UpdateHabitData) => {
    if (!habit) return;
    setActionLoading(true);
    try {
      const updated = await habitsApi.updateHabit(habit._id, data);
      setHabit(updated);
      setIsEditModalOpen(false);
      showSuccess('Habit updated');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!habit) return;
    setActionLoading(true);
    try {
      if (habit.archivedAt) {
        const updated = await habitsApi.unarchiveHabit(habit._id);
        setHabit(updated);
        showSuccess('Habit unarchived');
      } else {
        const updated = await habitsApi.archiveHabit(habit._id);
        setHabit(updated);
        showSuccess('Habit archived');
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <Spinner size="lg" />;
  }

  if (error || !habit) {
    return <ErrorMessage message={error || 'Habit not found'} onRetry={fetchHabit} />;
  }

  const isArchived = Boolean(habit.archivedAt);

  return (
    <div className="space-y-8">
      {/* Back link */}
      <div>
        <Link
          to="/habits"
          className="text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          ← Back to habits
        </Link>
      </div>

      {/* Header and details */}
      <div className="border-b border-border pb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-semibold text-text-primary">
                {habit.name}
              </h1>
              {isArchived && (
                <span className="text-xs uppercase tracking-wider text-text-muted border border-border px-2 py-0.5 rounded">
                  Archived
                </span>
              )}
            </div>
            {habit.description && (
              <p className="text-sm text-text-muted mt-2 max-w-xl">
                {habit.description}
              </p>
            )}
            <p className="text-xs text-text-muted mt-2 tabular-nums">
              Started {habit.startDate} • Frequency: Daily
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="text-xs bg-surface border border-border text-text-primary px-3 py-1.5 rounded-md hover:border-text-primary transition-colors cursor-pointer"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleArchiveToggle}
              disabled={actionLoading}
              className="text-xs bg-surface border border-border text-text-primary px-3 py-1.5 rounded-md hover:border-text-primary transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isArchived ? 'Unarchive' : 'Archive'}
            </button>
          </div>
        </div>
      </div>

      {/* Success notification */}
      {successMessage && (
        <div className="text-xs text-text-primary py-2 px-3 border border-border rounded-md flex justify-between items-center">
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-text-muted hover:text-text-primary ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Calendar Section */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Activity</h2>
        {completionsLoading ? (
          <Spinner size="sm" />
        ) : (
          <Calendar
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            habitStartDate={habit.startDate}
            isArchived={isArchived}
            completedDates={completedDates}
            onToggleDate={handleToggleDate}
            isToggling={isToggling}
          />
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !actionLoading && setIsEditModalOpen(false)}
        title="Edit habit"
      >
        <HabitForm
          initialHabit={habit}
          onSubmit={handleEditSubmit}
          onCancel={() => setIsEditModalOpen(false)}
          isLoading={actionLoading}
        />
      </Modal>
    </div>
  );
};
