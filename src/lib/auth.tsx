'use client';

import { ReactNode, useContext } from 'react';
import { UserRole } from './types';
import { getPermissions, isAdminSection, canReviewStage, RolePermissions } from './permissions';
import { usePortalBackend } from './supabase/use-mock';
import { AuthContext } from './auth-context';
import { MockAuthProvider } from './auth-mock';
import { MySqlAuthProvider } from './auth-mysql';
import { SupabaseAuthProvider } from './auth-supabase';

/**
 * Authentication dispatcher. Both providers expose the unchanged useAuth()
 * contract, letting every existing page run in either offline demo or real
 * Supabase mode without knowing which backend is active.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const backend = usePortalBackend();
  if (backend === 'mock') return <MockAuthProvider>{children}</MockAuthProvider>;
  if (backend === 'mysql') return <MySqlAuthProvider>{children}</MySqlAuthProvider>;
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>;
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

/** @deprecated Use isAdminSection from permissions.ts instead. */
export function isAdmin(role: UserRole | null): boolean {
  return isAdminSection(role);
}

/** @deprecated Use canReviewStage from permissions.ts instead. */
export function canReview(role: UserRole | null): boolean {
  return canReviewStage(role, 'tdap') || canReviewStage(role, 'nafsa');
}

export { hasPermission, isAdminSection, canReviewStage, getPermissions } from './permissions';
