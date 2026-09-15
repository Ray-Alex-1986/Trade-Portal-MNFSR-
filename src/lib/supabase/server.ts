import 'server-only';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface ServerProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface AuthenticatedAdmin {
  client: SupabaseClient;
  profile: ServerProfile;
}

export function getSupabaseServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase server credentials are not configured.');
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Validates a caller's Bearer access token with Supabase Auth, then uses the
 * service client to read the role reliably despite client-side RLS policies.
 */
export async function getAuthenticatedAdmin(request: Request): Promise<AuthenticatedAdmin | null> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const client = getSupabaseServiceClient();
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, email, full_name, role:roles(name)')
    .eq('id', authData.user.id)
    .single();
  if (profileError || !profile) return null;

  const relation = profile.role as { name: string } | { name: string }[] | null;
  const role = Array.isArray(relation) ? relation[0]?.name : relation?.name;
  if (!role || !['super_admin', 'moc_admin', 'tdap_admin', 'tdap_officer', 'nafsa_admin', 'nafsa_officer', 'auditor'].includes(role)) {
    return null;
  }

  return {
    client,
    profile: {
      id: profile.id as string,
      email: profile.email as string,
      full_name: profile.full_name as string,
      role,
    },
  };
}

export function isSuperAdmin(profile: ServerProfile): boolean {
  return profile.role === 'super_admin';
}
