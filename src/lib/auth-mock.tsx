'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { mockUsers } from './mock-data';
import { User } from './types';
import { AuthContext } from './auth-context';
import { DEMO_PASSWORD, hasMockPassword, setMockPassword, verifyMockPassword } from './mock-passwords';

const SESSION_KEY = 'export_portal_user';
const DATA_KEY = 'export_portal_data_v3';

function readStoredUsers(): User[] {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    const data = raw ? JSON.parse(raw) as { users?: User[] } : null;
    return Array.isArray(data?.users) ? data.users : [];
  } catch {
    return [];
  }
}

function persistLastLogin(userId: string, lastLogin: string) {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as { users?: User[] };
    if (!Array.isArray(data.users)) return;
    data.users = data.users.map(u => (u.id === userId ? { ...u, last_login: lastLogin } : u));
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

/**
 * localStorage-backed authentication for offline demo mode.
 *
 * - Seeded demo accounts sign in with the shared demo password.
 * - Accounts created through registration or User Management sign in with the
 *   password chosen at creation time (stored as a salted digest).
 * - Deactivated or deleted accounts cannot sign in and are signed out on the
 *   next page load.
 */
export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const session = JSON.parse(stored) as User;
        // Re-validate against the current dataset so deletions/deactivations take effect.
        const current = readStoredUsers().find(u => u.id === session.id);
        if (current && current.is_active) {
          setUser({ ...current, last_login: session.last_login ?? current.last_login });
        } else if (!current && readStoredUsers().length === 0 && mockUsers.some(u => u.id === session.id)) {
          setUser(session);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch { /* ignore malformed storage */ }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const normalized = email.trim().toLowerCase();
      if (!normalized || !password) return { error: 'Email and password are required.' };

      const storedUsers = readStoredUsers();
      const pool = storedUsers.length ? storedUsers : mockUsers;
      const found = pool.find(item => item.email.toLowerCase() === normalized);
      if (!found) return { error: 'Invalid credentials. Check your email and password.' };
      if (!found.is_active) return { error: 'This account has been deactivated. Contact the portal administrator.' };

      const isSeededDemoAccount = mockUsers.some(item => item.email.toLowerCase() === normalized);
      let valid: boolean;
      if (hasMockPassword(normalized)) {
        valid = await verifyMockPassword(normalized, password);
      } else if (isSeededDemoAccount) {
        valid = password === DEMO_PASSWORD;
      } else {
        // Legacy account created before password storage existed: adopt the
        // password used now so subsequent logins are verified.
        valid = true;
        await setMockPassword(normalized, password);
      }
      if (!valid) return { error: 'Invalid credentials. Check your email and password.' };

      const lastLogin = new Date().toISOString();
      const userWithLogin: User = { ...found, last_login: lastLogin };
      setUser(userWithLogin);
      localStorage.setItem(SESSION_KEY, JSON.stringify(userWithLogin));
      persistLastLogin(found.id, lastLogin);
      return { user: userWithLogin };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
