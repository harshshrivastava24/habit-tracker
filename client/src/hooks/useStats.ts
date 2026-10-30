import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '../api/dashboard';
import type { DashboardStats } from '../api/dashboard';
import type { AxiosError } from 'axios';

export const useStats = (from?: string, to?: string) => {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stats = await dashboardApi.getStats(from, to);
      setData(stats);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ error?: { message?: string } }>;
      setError(axiosErr.response?.data?.error?.message || 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { data, loading, error, refetch: fetchStats };
};
