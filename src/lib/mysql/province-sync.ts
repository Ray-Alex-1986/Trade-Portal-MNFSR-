import 'server-only';

import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPermissions } from '@/lib/permissions';
import { User } from '@/lib/types';
import { getMySqlSessionUser } from './session';
import { getMySqlPool, toMySqlDateTime, withMySqlTransaction } from './server';

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RECORDS_PER_SYNC = 500;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

interface ProvinceSourceRow extends RowDataPacket {
  id: string;
  name: string;
  province: string;
  api_url: string;
  api_key: string | null;
  total_records_pulled: number | string | null;
  is_active: number | boolean;
}

export class MySqlProvinceSyncError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'MySqlProvinceSyncError';
  }
}

const asNumber = (value: unknown) => typeof value === 'number' ? value : Number(value) || 0;
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Unexpected sync failure.').slice(0, 500);

function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [first, second] = address.split('.').map(Number);
    return first === 0 || first === 10 || first === 127 || first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 0) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19));
  }
  if (family === 6) {
    const normalised = address.toLowerCase();
    const mappedV4 = normalised.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return normalised === '::' || normalised === '::1' || normalised.startsWith('fe80:') ||
      normalised.startsWith('fc') || normalised.startsWith('fd') ||
      (mappedV4 ? isPrivateAddress(mappedV4) : false);
  }
  return false;
}

async function safeExternalUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new MySqlProvinceSyncError('The configured API URL is invalid.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new MySqlProvinceSyncError('Only credential-free HTTP and HTTPS API URLs are supported.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || isPrivateAddress(host)) {
    throw new MySqlProvinceSyncError('The API URL must not target a private or local network address.');
  }
  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(entry => isPrivateAddress(entry.address))) {
      throw new MySqlProvinceSyncError('The API URL must not resolve to a private or local network address.');
    }
  } catch (error) {
    if (error instanceof MySqlProvinceSyncError) throw error;
    throw new MySqlProvinceSyncError('The API host could not be resolved.');
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

async function readJsonPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json') && !contentType.includes('+json')) {
    throw new MySqlProvinceSyncError('Upstream response was not JSON.', 502);
  }
  const contentLength = Number(response.headers.get('content-length') || '0');
  if (contentLength > MAX_RESPONSE_BYTES) {
    throw new MySqlProvinceSyncError('Upstream response exceeded the sync size limit.', 502);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new MySqlProvinceSyncError('Upstream response was empty.', 502);

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new MySqlProvinceSyncError('Upstream response exceeded the sync size limit.', 502);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new MySqlProvinceSyncError('Upstream response was not valid JSON.', 502);
  }
}

function recordText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  return String(value).trim().slice(0, maxLength) || fallback;
}

function optionalRecordText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  return String(value).trim().slice(0, maxLength) || null;
}

async function addAudit(
  connection: PoolConnection,
  actor: User,
  action: string,
  sourceId: string,
  detail: string,
) {
  await connection.execute(
    `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, module, record_id, new_value, ip_address)
     VALUES (?, ?, ?, ?, ?, 'Province Integrations', ?, ?, 'server')`,
    [randomUUID(), actor.id, actor.full_name, actor.role, action, sourceId, detail.slice(0, 500)],
  );
}

async function notifyActor(
  connection: PoolConnection,
  actor: User,
  title: string,
  message: string,
  type: 'success' | 'warning' | 'error',
) {
  await connection.execute(
    `INSERT INTO notifications (id, user_id, title, message, type, link)
     VALUES (?, ?, ?, ?, ?, '/admin/province-integrations')`,
    [randomUUID(), actor.id, title, message, type],
  );
}

async function completeFailure(logId: string, source: ProvinceSourceRow, actor: User, startedMs: number, reason: string) {
  const completedAt = toMySqlDateTime();
  await withMySqlTransaction(async connection => {
    await connection.execute(
      `UPDATE province_sync_logs
          SET status = 'failed', completed_at = ?, duration_ms = ?, error_message = ?
        WHERE id = ?`,
      [completedAt, Date.now() - startedMs, reason, logId],
    );
    await connection.execute(
      `UPDATE province_api_sources
          SET last_sync_at = ?, last_sync_status = 'failed', last_sync_records = 0, last_sync_error = ?
        WHERE id = ?`,
      [completedAt, reason, source.id],
    );
    await notifyActor(connection, actor, 'Province Sync Failed', `${source.name}: ${reason}`, 'error');
    await addAudit(connection, actor, 'Province Sync Failed', source.id, reason);
  });
}

/** Fetches one public provincial source and atomically persists its latest snapshot. */
export async function runMySqlProvinceSync(request: Request, sourceId: string) {
  const actor = await getMySqlSessionUser(request);
  if (!actor) throw new MySqlProvinceSyncError('Authentication is required.', 401);
  if (!getPermissions(actor.role).manageProvinceIntegrations) {
    throw new MySqlProvinceSyncError('You do not have permission to sync provincial data.', 403);
  }
  const id = sourceId.trim();
  if (!id) throw new MySqlProvinceSyncError('sourceId is required.');

  const pool = getMySqlPool();
  const [sourceRows] = await pool.execute<ProvinceSourceRow[]>(
    `SELECT id, name, province, api_url, api_key, total_records_pulled, is_active
       FROM province_api_sources WHERE id = ? LIMIT 1`,
    [id],
  );
  const source = sourceRows[0];
  if (!source) throw new MySqlProvinceSyncError('API source was not found.', 404);
  if (!Boolean(source.is_active)) throw new MySqlProvinceSyncError('Activate this API source before syncing it.');

  const logId = randomUUID();
  const startedAt = toMySqlDateTime();
  const startedMs = Date.now();
  await pool.execute(
    `INSERT INTO province_sync_logs (id, source_id, source_name, province, status, records_pulled, started_at, triggered_by)
     VALUES (?, ?, ?, ?, 'running', 0, ?, ?)`,
    [logId, source.id, source.name, source.province, startedAt, actor.email],
  );

  try {
    const url = await safeExternalUrl(source.api_url);
    const headers: HeadersInit = { Accept: 'application/json' };
    if (source.api_key) {
      headers.Authorization = `Bearer ${source.api_key}`;
      headers['X-API-Key'] = source.api_key;
    }
    const response = await fetch(url, {
      headers,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      throw new MySqlProvinceSyncError('Upstream redirects are not allowed for provincial API sources.', 502);
    }
    if (!response.ok) throw new MySqlProvinceSyncError(`Upstream returned HTTP ${response.status}.`, 502);

    const records = normaliseRecords(await readJsonPayload(response));
    const completedAt = toMySqlDateTime();
    const durationMs = Date.now() - startedMs;
    await withMySqlTransaction(async connection => {
      await connection.execute('DELETE FROM province_data_records WHERE source_id = ?', [source.id]);
      for (const [index, data] of records.entries()) {
        await connection.execute(
          `INSERT INTO province_data_records (id, source_id, source_name, province, record_type, data, external_id, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(), source.id, source.name, source.province,
            recordText(data.record_type ?? data.type, 'record', 128), JSON.stringify(data),
            optionalRecordText(data.id ?? data.external_id ?? data.reference ?? index + 1, 255), completedAt,
          ],
        );
      }
      await connection.execute(
        `UPDATE province_sync_logs
            SET status = 'success', records_pulled = ?, completed_at = ?, duration_ms = ?, error_message = NULL
          WHERE id = ?`,
        [records.length, completedAt, durationMs, logId],
      );
      await connection.execute(
        `UPDATE province_api_sources
            SET last_sync_at = ?, last_sync_status = 'success', last_sync_records = ?, last_sync_error = NULL,
                total_records_pulled = ?, updated_at = ?
          WHERE id = ?`,
        [completedAt, records.length, asNumber(source.total_records_pulled) + records.length, completedAt, source.id],
      );
      await notifyActor(connection, actor, 'Province Sync Completed', `${source.name}: ${records.length} records pulled.`, 'success');
      await addAudit(connection, actor, 'Province Sync Completed', source.id, `${records.length} records pulled.`);
    });
    return { status: 'success' as const, recordsPulled: records.length, durationMs };
  } catch (error) {
    const reason = errorMessage(error);
    try {
      await completeFailure(logId, source, actor, startedMs, reason);
    } catch (persistenceError) {
      console.error('[mysql-province-sync:persist-failure]', persistenceError);
    }
    if (error instanceof MySqlProvinceSyncError) throw error;
    throw new MySqlProvinceSyncError(reason, 502);
  }
}
