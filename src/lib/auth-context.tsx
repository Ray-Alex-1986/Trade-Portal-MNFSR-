'use client';

import { createContext } from 'react';
import { User } from './types';

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string; user?: User }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  login: async () => ({}),
  logout: async () => {},
  isAuthenticated: false,
});
