'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Realtime subscription helper (Phase 3 of the Supabase migration plan).
 *
 * One Supabase channel subscribes to postgres_changes on every portal table.
 * On any event we refetch ONLY the affected table — the tables are small, so
 * correctness is favoured over clever delta merging. The result is that every
 * open browser tab reflects any user's change within ~1s, no refresh needed.
 */

export type PortalTable =
  | 'profiles'
  | 'companies'
  | 'export_records'
  | 'documents'
  | 'complaints'
  | 'notifications'
  | 'audit_logs'
  | 'master_data'
  | 'province_api_sources'
  | 'province_sync_logs'
  | 'province_data_records';

const PORTAL_TABLES: PortalTable[] = [
  'profiles',
  'companies',
  'export_records',
  'documents',
  'complaints',
  'notifications',
  'audit_logs',
  'master_data',
  'province_api_sources',
  'province_sync_logs',
  'province_data_records',
];

const CHANNEL_NAME = 'portal-changes';

/**
 * Subscribe to all portal-table changes. Returns an unsubscribe function that
 * removes the channel — call it from a useEffect cleanup.
 */
export function subscribeToPortalChanges(
  supabase: SupabaseClient,
  onChange: (table: PortalTable) => void,
): () => void {
  const channel = supabase.channel(CHANNEL_NAME);

  for (const table of PORTAL_TABLES) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      () => onChange(table),
    );
  }

  void channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR') {
      console.error('[realtime] channel error — live updates may be unavailable');
    }
  });

  return () => {
    void supabase.removeChannel(channel);
  };
}
