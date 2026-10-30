import React, { useState } from 'react';
import type { Habit, CreateHabitData, UpdateHabitData } from '../api/habits';
import { getLocalDateString } from '../utils/date';
import type { AxiosError } from 'axios';

export interface HabitFormProps {
  initialHabit?: Habit | null;
  onSubmit: (data: CreateHabitData | UpdateHabitData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface FormErrors {
  name?: string;
  description?: string;
  startDate?: string;
  general?: string;
}

export const HabitForm: React.FC<HabitFormProps> = ({
  initialHabit,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [name, setName] = useState(initialHabit?.name || '');
  const [description, setDescription] = useState(initialHabit?.description || '');
  const [startDate, setStartDate] = useState(
    initialHabit?.startDate || getLocalDateString()
  );
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length > 100) {
      newErrors.name = 'Name must be 100 characters or fewer';
    }

    if (description && description.length > 500) {
      newErrors.description = 'Description must be 500 characters or fewer';
    }

    if (!startDate) {
      newErrors.startDate = 'Start date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validate()) {
      return;
    }

    try {
      const payload: CreateHabitData = {
        name: name.trim(),
        description: description.trim() || undefined,
        startDate,
        frequency: 'DAILY',
      };
      await onSubmit(payload);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{
        error?: {
          message?: string;
          details?: Array<{ field: string; message: string }>;
        };
      }>;

      const serverError = axiosErr.response?.data?.error;
      const newErrors: FormErrors = {};

      if (serverError?.details && serverError.details.length > 0) {
        serverError.details.forEach((detail) => {
          if (detail.field === 'name') newErrors.name = detail.message;
          if (detail.field === 'description') newErrors.description = detail.message;
          if (detail.field === 'startDate') newErrors.startDate = detail.message;
        });
      } else if (serverError?.message) {
        newErrors.general = serverError.message;
      } else {
        newErrors.general = 'Failed to save habit';
      }

      setErrors(newErrors);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {errors.general && (
        <div className="p-3 border border-border text-xs text-text-primary rounded-md">
          {errors.general}
        </div>
      )}

      <div>
        <label className="block text-xs text-text-muted mb-1" htmlFor="habit-name">
          Name <span className="text-text-muted">*</span>
        </label>
        <input
          id="habit-name"
          type="text"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
          placeholder="e.g. Read 20 pages"
          className="w-full bg-surface border border-border rounded-md px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary disabled:opacity-50"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-text-muted">{errors.name}</p>
        )}
      </div>

      <div>
        <label className="block text-xs text-text-muted mb-1" htmlFor="habit-description">
          Description (optional)
        </label>
        <textarea
          id="habit-description"
          rows={3}
          value={description}
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isLoading}
          placeholder="e.g. Non-fiction books before sleep"
          className="w-full bg-surface border border-border rounded-md px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary disabled:opacity-50 resize-none"
        />
        {errors.description && (
          <p className="mt-1 text-xs text-text-muted">{errors.description}</p>
        )}
      </div>

      <div>
        <label className="block text-xs text-text-muted mb-1" htmlFor="habit-startDate">
          Start date <span className="text-text-muted">*</span>
        </label>
        <input
          id="habit-startDate"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          disabled={isLoading}
          className="w-full bg-surface border border-border rounded-md px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary disabled:opacity-50 tabular-nums"
        />
        {errors.startDate && (
          <p className="mt-1 text-xs text-text-muted">{errors.startDate}</p>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-3 py-1.5 text-xs border border-border rounded-md text-text-primary hover:border-text-primary transition-colors disabled:opacity-50 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-1.5 text-xs bg-text-primary text-background font-medium rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? 'Saving...' : initialHabit ? 'Save changes' : 'Create habit'}
        </button>
      </div>
    </form>
  );
};
