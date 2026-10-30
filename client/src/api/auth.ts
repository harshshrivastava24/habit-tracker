import { api } from './client';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export const authApi = {
  signup: async (data: SignupData): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/signup', data);
    return res.data;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/login', data);
    return res.data;
  },

  refresh: async (): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/refresh');
    return res.data;
  },

  logout: async (): Promise<{ message: string }> => {
    const res = await api.post<{ message: string }>('/auth/logout');
    return res.data;
  },

  getMe: async (): Promise<{ user: User }> => {
    const res = await api.get<{ user: User }>('/auth/me');
    return res.data;
  },
};
