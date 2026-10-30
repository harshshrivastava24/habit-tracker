import { api } from './client';

export interface Habit {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  startDate: string;
  frequency: 'DAILY';
  archivedAt: string | null;
  category?: string | null;
  reminderTime?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateHabitData {
  name: string;
  description?: string;
  startDate: string;
  frequency: 'DAILY';
  category?: string | null;
  reminderTime?: string | null;
}

export interface UpdateHabitData {
  name?: string;
  description?: string;
  startDate?: string;
  frequency?: 'DAILY';
  category?: string | null;
  reminderTime?: string | null;
}

export const habitsApi = {
  getHabits: async (status: 'active' | 'archived' = 'active'): Promise<Habit[]> => {
    const res = await api.get<{ habits: Habit[] }>(`/habits?status=${status}`);
    return res.data.habits;
  },

  getHabit: async (id: string): Promise<Habit> => {
    const res = await api.get<{ habit: Habit }>(`/habits/${id}`);
    return res.data.habit;
  },

  createHabit: async (data: CreateHabitData): Promise<Habit> => {
    const res = await api.post<{ habit: Habit }>('/habits', data);
    return res.data.habit;
  },

  updateHabit: async (id: string, data: UpdateHabitData): Promise<Habit> => {
    const res = await api.patch<{ habit: Habit }>(`/habits/${id}`, data);
    return res.data.habit;
  },

  deleteHabit: async (id: string): Promise<void> => {
    await api.delete(`/habits/${id}`);
  },

  archiveHabit: async (id: string): Promise<Habit> => {
    const res = await api.post<{ habit: Habit }>(`/habits/${id}/archive`);
    return res.data.habit;
  },

  unarchiveHabit: async (id: string): Promise<Habit> => {
    const res = await api.post<{ habit: Habit }>(`/habits/${id}/unarchive`);
    return res.data.habit;
  },
};
