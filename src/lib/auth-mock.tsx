'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { mockUsers } from './mock-data';
import { User } from './types';
import { AuthContext } from './auth-context';

/** Original localStorage-backed authentication, retained for offline mock mode. */
export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('export_portal_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore malformed storage */ }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, _password: string) => {
    setIsLoading(true);
    try {
      let found = mockUsers.find(item => item.email.toLowerCase() === email.trim().toLowerCase());
      if (!found) {
        try {
          const raw = localStorage.getItem('export_portal_data_v3');
          const data = raw ? JSON.parse(raw) : null;
          const stored = (data?.users || []).find((item: User) => item.email.toLowerCase() === email.trim().toLowerCase());
          if (stored) found = stored;
        } catch { /* ignore malformed storage */ }
      }
      if (!found) return { error: 'Invalid credentials. Check your email and password.' };

      const userWithLogin = { ...found, last_login: new Date().toISOString() };
      setUser(userWithLogin);
      localStorage.setItem('export_portal_user', JSON.stringify(userWithLogin));
      return { user: userWithLogin };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    localStorage.removeItem('export_portal_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
