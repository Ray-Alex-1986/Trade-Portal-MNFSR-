'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useMockData } from './use-mock';

function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url === 'your_supabase_project_url') return null;
  return createBrowserClient(url, key);
}

let clientInstance: ReturnType<typeof createSupabaseBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (typeof window === 'undefined') return null;
  if (clientInstance === undefined) {
    clientInstance = createSupabaseBrowserClient();
  }
  return clientInstance;
}

export function useSupabase() {
  const supabase = getSupabaseBrowserClient();
  const isMockMode = useMockData();
  return { supabase, isMockMode };
}
