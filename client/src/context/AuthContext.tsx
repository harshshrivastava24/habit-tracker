import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';
import type { User, LoginData, SignupData } from '../api/auth';
import { setMemoryToken, setAuthCallbacks } from '../api/client';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (data: LoginData) => Promise<User>;
  signup: (data: SignupData) => Promise<User>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Wire up single-flight refresh callbacks from api interceptor
    setAuthCallbacks(
      (refreshedUser, refreshedToken) => {
        setUser(refreshedUser);
        setToken(refreshedToken);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );

    // Silent refresh on app load
    authApi
      .refresh()
      .then((res) => {
        setUser(res.user);
        setToken(res.accessToken);
        setMemoryToken(res.accessToken);
      })
      .catch(() => {
        setUser(null);
        setToken(null);
        setMemoryToken(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (data: LoginData): Promise<User> => {
    const res = await authApi.login(data);
    setUser(res.user);
    setToken(res.accessToken);
    setMemoryToken(res.accessToken);
    return res.user;
  };

  const signup = async (data: SignupData): Promise<User> => {
    const res = await authApi.signup(data);
    setUser(res.user);
    setToken(res.accessToken);
    setMemoryToken(res.accessToken);
    return res.user;
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network errors on logout, state must be cleared regardless
    } finally {
      setUser(null);
      setToken(null);
      setMemoryToken(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
