import { api } from './client';

export interface CompletionItem {
  date: string;
}

export interface CompletionRecord {
  habitId: string;
  date: string;
}

export const completionsApi = {
  getCompletions: async (
    habitId: string,
    from?: string,
    to?: string
  ): Promise<CompletionItem[]> => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const res = await api.get<{ completions: CompletionItem[] }>(
      `/habits/${habitId}/completions${queryString}`
    );
    return res.data.completions;
  },

  upsertCompletion: async (
    habitId: string,
    date: string
  ): Promise<CompletionRecord> => {
    const res = await api.put<{ completion: CompletionRecord }>(
      `/habits/${habitId}/completions/${date}`
    );
    return res.data.completion;
  },

  deleteCompletion: async (habitId: string, date: string): Promise<void> => {
    await api.delete(`/habits/${habitId}/completions/${date}`);
  },
};
