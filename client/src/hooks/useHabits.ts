import { useState, useEffect, useCallback } from 'react';
import { habitsApi } from '../api/habits';
import type { Habit } from '../api/habits';
import type { AxiosError } from 'axios';

export const useHabits = (status: 'active' | 'archived' = 'active') => {
  const [data, setData] = useState<Habit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHabits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const habits = await habitsApi.getHabits(status);
      setData(habits);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ error?: { message?: string } }>;
      setError(axiosErr.response?.data?.error?.message || 'Failed to fetch habits');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  return { data, loading, error, refetch: fetchHabits };
};
