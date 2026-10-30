import { api } from './client';

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

export const dashboardApi = {
  getStats: async (from?: string, to?: string): Promise<DashboardStats> => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const res = await api.get<DashboardStats>(`/dashboard/stats${queryString}`);
    return res.data;
  },
};
