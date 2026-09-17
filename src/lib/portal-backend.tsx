'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export type PortalBackend = 'mock' | 'mysql';

interface PortalBackendContext {
  backend: PortalBackend;
  isMockMode: boolean;
  setIsMockMode: (v: boolean) => void;
}

const PortalBackendContext = createContext<PortalBackendContext>({
  backend: 'mysql',
  isMockMode: false,
  setIsMockMode: () => {},
});

/** Default is MySQL. Set NEXT_PUBLIC_PORTAL_BACKEND=mock only for offline browser demos. */
export function getConfiguredPortalBackend(): PortalBackend {
  return process.env.NEXT_PUBLIC_PORTAL_BACKEND?.toLowerCase() === 'mock' ? 'mock' : 'mysql';
}

export function MockDataProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<PortalBackend>(getConfiguredPortalBackend);
  const setIsMockMode = (isMockMode: boolean) => {
    setBackend(isMockMode ? 'mock' : getConfiguredPortalBackend());
  };

  return (
    <PortalBackendContext.Provider value={{ backend, isMockMode: backend === 'mock', setIsMockMode }}>
      {children}
    </PortalBackendContext.Provider>
  );
}

export function usePortalBackend(): PortalBackend {
  return useContext(PortalBackendContext).backend;
}

export function useMockData() {
  return useContext(PortalBackendContext).isMockMode;
}

export function useMySqlData() {
  return usePortalBackend() === 'mysql';
}
