import { useState, useEffect, useCallback } from 'react';
import { completionsApi } from '../api/completions';
import type { CompletionItem } from '../api/completions';
import type { AxiosError } from 'axios';

export const useCompletions = (habitId: string, from?: string, to?: string) => {
  const [data, setData] = useState<CompletionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompletions = useCallback(async () => {
    if (!habitId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await completionsApi.getCompletions(habitId, from, to);
      setData(items);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ error?: { message?: string } }>;
      setError(axiosErr.response?.data?.error?.message || 'Failed to fetch completions');
    } finally {
      setLoading(false);
    }
  }, [habitId, from, to]);

  useEffect(() => {
    fetchCompletions();
  }, [fetchCompletions]);

  return { data, loading, error, refetch: fetchCompletions };
};
