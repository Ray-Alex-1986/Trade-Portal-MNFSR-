'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, UserRole } from './types';
import { mockUsers } from './mock-data';
import { getPermissions, hasPermission as permCheck, isAdminSection, canReviewStage, RolePermissions } from './permissions';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string; user?: User }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  login: async () => ({}),
  logout: async () => {},
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('export_portal_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, _password: string): Promise<{ error?: string; user?: User }> => {
    setIsLoading(true);
    try {
      // Mock mode: find user by email (seed users, then users persisted in the data store)
      let found = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!found && typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('export_portal_data_v2');
          if (raw) {
            const data = JSON.parse(raw);
            const stored = (data?.users || []).find((u: User) => u.email.toLowerCase() === email.toLowerCase());
            if (stored) found = stored;
          }
        } catch { /* ignore malformed storage */ }
      }
      if (found) {
        const userWithLogin = { ...found, last_login: new Date().toISOString() };
        setUser(userWithLogin);
        localStorage.setItem('export_portal_user', JSON.stringify(userWithLogin));
        return { user: userWithLogin };
      }
      return { error: 'Invalid credentials. Try one of the demo accounts.' };
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

export function useAuth() {
  return useContext(AuthContext);
}

export function useRole(): UserRole | null {
  return useAuth().user?.role ?? null;
}

export function usePermissions(): RolePermissions {
  return getPermissions(useAuth().user?.role);
}

/** @deprecated Use isAdminSection from permissions.ts instead */
export function isAdmin(role: UserRole | null): boolean {
  return isAdminSection(role);
}

/** @deprecated Use canReviewStage from permissions.ts instead */
export function canReview(role: UserRole | null): boolean {
  return canReviewStage(role, 'tdap') || canReviewStage(role, 'nafsa');
}

export { hasPermission, isAdminSection, canReviewStage, getPermissions } from './permissions';
