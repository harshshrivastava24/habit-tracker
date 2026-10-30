import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

let memoryToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let onTokenRefreshedCallback: ((user: any, token: string) => void) | null = null;
let onAuthFailedCallback: (() => void) | null = null;

export const setMemoryToken = (token: string | null) => {
  memoryToken = token;
};

export const getMemoryToken = () => memoryToken;

export const setAuthCallbacks = (
  onTokenRefreshed: (user: any, token: string) => void,
  onAuthFailed: () => void
) => {
  onTokenRefreshedCallback = onTokenRefreshed;
  onAuthFailedCallback = onAuthFailed;
};

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Request interceptor: add Bearer token from client memory
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (memoryToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${memoryToken}`;
  }
  return config;
});

// Response interceptor: single-flight refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const url = originalRequest?.url || '';

    // IMPORTANT: never attempt a refresh for 401s from login, signup or refresh
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/signup') ||
      url.includes('/auth/refresh');

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = api
          .post('/auth/refresh')
          .then((res) => {
            const newToken = res.data.accessToken;
            setMemoryToken(newToken);
            if (onTokenRefreshedCallback) {
              onTokenRefreshedCallback(res.data.user, newToken);
            }
            return newToken;
          })
          .catch((refreshErr) => {
            setMemoryToken(null);
            if (onAuthFailedCallback) {
              onAuthFailedCallback();
            }
            return Promise.reject(refreshErr);
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        const newToken = await refreshPromise;
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);
