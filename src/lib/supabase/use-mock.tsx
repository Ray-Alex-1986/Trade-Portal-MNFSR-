'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export type PortalBackend = 'mock' | 'supabase' | 'mysql';

interface MockDataContext {
  backend: PortalBackend;
  isMockMode: boolean;
  setIsMockMode: (v: boolean) => void;
}

const MockDataContext = createContext<MockDataContext>({
  backend: 'mock', isMockMode: true, setIsMockMode: () => {},
});

function hasSupabaseBrowserConfig(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && anonKey && url !== 'your_supabase_project_url' && anonKey !== 'your_supabase_anon_key');
}

/**
 * MySQL is selected only through this non-secret public build setting. Without
 * it, a configured Supabase deployment remains the active browser backend.
 */
export function getConfiguredPortalBackend(): PortalBackend {
  const requested = process.env.NEXT_PUBLIC_PORTAL_BACKEND?.toLowerCase();
  if (requested === 'mysql' || requested === 'mock') return requested;
  if (requested === 'supabase') return hasSupabaseBrowserConfig() ? 'supabase' : 'mock';
  return hasSupabaseBrowserConfig() ? 'supabase' : 'mock';
}

export function MockDataProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<PortalBackend>(getConfiguredPortalBackend);
  const setIsMockMode = (isMockMode: boolean) => {
    setBackend(isMockMode ? 'mock' : getConfiguredPortalBackend());
  };

  return (
    <MockDataContext.Provider value={{ backend, isMockMode: backend === 'mock', setIsMockMode }}>
      {children}
    </MockDataContext.Provider>
  );
}

export function usePortalBackend(): PortalBackend {
  return useContext(MockDataContext).backend;
}

export function useMockData() {
  return useContext(MockDataContext).isMockMode;
}

export function useMySqlData() {
  return usePortalBackend() === 'mysql';
}
