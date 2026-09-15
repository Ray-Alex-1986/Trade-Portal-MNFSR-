'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { AuthContext } from './auth-context';
import { User } from './types';

interface AuthResponse {
  user?: User | null;
  error?: string;
}

/** Native MySQL session provider. Credentials remain in an HTTP-only server cookie. */
export function MySqlAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    try {
      const response = await fetch('/api/mysql/auth/session', { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json() as AuthResponse;
      setUser(result.user ?? null);
    } catch (error) {
      console.error('[mysql-auth-session]', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/mysql/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json().catch(() => ({})) as AuthResponse;
      if (!response.ok || !result.user) return { error: result.error ?? 'Unable to sign in.' };
      setUser(result.user);
      localStorage.removeItem('export_portal_data_v3');
      localStorage.removeItem('export_portal_user');
      return { user: result.user };
    } catch {
      return { error: 'The authentication service is unavailable.' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/mysql/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
