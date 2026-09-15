'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { User, UserRole } from './types';
import { AuthContext } from './auth-context';
import { getSupabaseBrowserClient } from './supabase/client';

type Relation = { name: string } | { name: string }[] | null;

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  role: Relation;
  institution: Relation;
}

const one = (value: Relation) => Array.isArray(value) ? value[0] ?? null : value;

function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: (one(row.role)?.name ?? 'exporter') as UserRole,
    institution: one(row.institution)?.name ?? undefined,
    is_active: row.is_active,
    last_login: row.last_login ?? undefined,
    created_at: row.created_at,
  };
}

/** Supabase Auth provider used whenever valid public Supabase keys are present. */
export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (id: string): Promise<User | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_active, last_login, created_at, role:roles(name), institution:institutions(name)')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    const profile = mapProfile(data as ProfileRow);
    return profile.is_active ? profile : null;
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let active = true;
    const restore = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const profile = data.session ? await loadProfile(data.session.user.id) : null;
      if (active) {
        setUser(profile);
        setIsLoading(false);
      }
    };
    void restore();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        const profile = session ? await loadProfile(session.user.id) : null;
        if (active) {
          setUser(profile);
          setIsLoading(false);
        }
      })();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  const login = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: 'The database connection is not configured.' };
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error || !data.user) return { error: error?.message ?? 'Unable to sign in.' };

      const profile = await loadProfile(data.user.id);
      if (!profile) {
        await supabase.auth.signOut();
        return { error: 'Your account is not provisioned or is inactive. Contact the portal administrator.' };
      }

      const lastLogin = new Date().toISOString();
      setUser({ ...profile, last_login: lastLogin });
      await supabase.from('profiles').update({ last_login: lastLogin }).eq('id', profile.id);
      localStorage.removeItem('export_portal_data_v3');
      localStorage.removeItem('export_portal_user');
      return { user: { ...profile, last_login: lastLogin } };
    } finally {
      setIsLoading(false);
    }
  }, [supabase, loadProfile]);

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
