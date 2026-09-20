import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, setToken, type AuthUser, type UserRole } from '@/lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string, captcha: string, captchaExpected: string, remember: boolean) => Promise<void>;
  completeSession: (token: string, user: AuthUser) => void;
  refreshUser: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('propvault_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem('propvault_user');
      localStorage.removeItem('propvault_token');
      return null;
    }
  });

  useEffect(() => {
    const t = localStorage.getItem('propvault_token');
    if (!t) return;
    setToken(t);
    api
      .me()
      .then((fresh) => {
        setUser(fresh);
        localStorage.setItem('propvault_user', JSON.stringify(fresh));
      })
      .catch(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('propvault_user');
        localStorage.removeItem('propvault_token');
      });
  }, []);

  const login = useCallback(
    async (username: string, password: string, captcha: string, captchaExpected: string, remember: boolean) => {
      const res = await api.login({ username, password, captcha, captchaExpected, remember });
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('propvault_user', JSON.stringify(res.user));
    },
    []
  );

  const completeSession = useCallback((sessionToken: string, sessionUser: AuthUser) => {
    setToken(sessionToken);
    setUser(sessionUser);
    localStorage.setItem('propvault_user', JSON.stringify(sessionUser));
  }, []);

  const refreshUser = useCallback((sessionUser: AuthUser) => {
    setUser(sessionUser);
    localStorage.setItem('propvault_user', JSON.stringify(sessionUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('propvault_user');
    localStorage.removeItem('propvault_token');
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, completeSession, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export type { UserRole };
