'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface MockDataContext {
  isMockMode: boolean;
  setIsMockMode: (v: boolean) => void;
}

const MockDataContext = createContext<MockDataContext>({ isMockMode: true, setIsMockMode: () => {} });

export function MockDataProvider({ children }: { children: ReactNode }) {
  const [isMockMode, setIsMockMode] = useState(true);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (url && url !== 'your_supabase_project_url') {
      setIsMockMode(false);
    }
  }, []);

  return (
    <MockDataContext.Provider value={{ isMockMode, setIsMockMode }}>
      {children}
    </MockDataContext.Provider>
  );
}

export function useMockData() {
  return useContext(MockDataContext).isMockMode;
}
