import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/supabase/server';

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RECORDS_PER_SYNC = 500;

interface SourceRow {
  id: string;
  name: string;
  province: string;
  api_url: string;
  api_key: string | null;
  total_records_pulled: number | null;
}

function assertSafeExternalUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS API URLs are supported.');
  }
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' || host.endsWith('.local') || host === '::1' ||
    /^127\./.test(host) || /^0\./.test(host) || /^10\./.test(host) ||
    /^192\.168\./.test(host) || /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    throw new Error('The API URL must not target a private or local network address.');
  }
  return url;
}

function normaliseRecords(payload: unknown): Record<string, unknown>[] {
  const candidate = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : [payload];

  return candidate
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .slice(0, MAX_RECORDS_PER_SYNC);
}

export async function POST(request: Request) {
  const admin = await getAuthenticatedAdmin(request).catch((error) => {
    console.error('[province-sync] authorization failed', error);
    return null;
  });
  if (!admin) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });

  const body = await request.json().catch(() => null) as { sourceId?: string } | null;
  if (!body?.sourceId) return NextResponse.json({ error: 'sourceId is required.' }, { status: 400 });

  const { client, profile } = admin;
  const { data: source, error: sourceError } = await client
    .from('province_api_sources')
    .select('id, name, province, api_url, api_key, total_records_pulled')
    .eq('id', body.sourceId)
    .single();
  if (sourceError || !source) return NextResponse.json({ error: 'API source was not found.' }, { status: 404 });

  const apiSource = source as SourceRow;
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const { data: log, error: logError } = await client
    .from('province_sync_logs')
    .insert({
      source_id: apiSource.id,
      source_name: apiSource.name,
      province: apiSource.province,
      status: 'running',
      records_pulled: 0,
      started_at: startedAt,
      triggered_by: profile.email,
    })
    .select('id')
    .single();
  if (logError || !log) return NextResponse.json({ error: 'Unable to start the sync log.' }, { status: 500 });

  try {
    const url = assertSafeExternalUrl(apiSource.api_url);
    const headers: HeadersInit = { Accept: 'application/json' };
    if (apiSource.api_key) {
      headers.Authorization = `Bearer ${apiSource.api_key}`;
      headers['X-API-Key'] = apiSource.api_key;
    }

    const response = await fetch(url, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}.`);

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) throw new Error('Upstream response was not JSON.');
    const records = normaliseRecords(await response.json());
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;

    // Each completed sync represents the source's latest snapshot. Do not
    // retain stale records when the province's upstream dataset changes.
    const { error: deleteError } = await client.from('province_data_records').delete().eq('source_id', apiSource.id);
    if (deleteError) throw deleteError;
    if (records.length) {
      const { error: recordsError } = await client.from('province_data_records').insert(
        records.map((data, index) => ({
          source_id: apiSource.id,
          source_name: apiSource.name,
          province: apiSource.province,
          record_type: String(data.record_type ?? data.type ?? 'record'),
          external_id: String(data.id ?? data.external_id ?? data.reference ?? index + 1),
          data,
          synced_at: completedAt,
        })),
      );
      if (recordsError) throw recordsError;
    }

    await Promise.all([
      client.from('province_sync_logs').update({
        status: 'success', records_pulled: records.length, completed_at: completedAt, duration_ms: durationMs,
      }).eq('id', log.id),
      client.from('province_api_sources').update({
        last_sync_at: completedAt,
        last_sync_status: 'success',
        last_sync_records: records.length,
        last_sync_error: null,
        total_records_pulled: (apiSource.total_records_pulled ?? 0) + records.length,
        updated_at: completedAt,
      }).eq('id', apiSource.id),
    ]);

    return NextResponse.json({ status: 'success', recordsPulled: records.length, durationMs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected sync failure.';
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;
    await Promise.all([
      client.from('province_sync_logs').update({
        status: 'failed', completed_at: completedAt, duration_ms: durationMs, error_message: message,
      }).eq('id', log.id),
      client.from('province_api_sources').update({
        last_sync_at: completedAt,
        last_sync_status: 'failed',
        last_sync_records: 0,
        last_sync_error: message,
        updated_at: completedAt,
      }).eq('id', apiSource.id),
    ]);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
