'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  AuditLog, Company, Complaint, ExportRecord, Notification, ProvinceApiSource,
  ProvinceDataRecord, ProvinceSyncLog, User, UserRole,
} from './types';
import { useAuth } from './auth';
import {
  DataStoreContext, DataStoreContextType, MasterCategory, MutationResult, NewUserInput, RegistrationInput, ReviewDecision,
} from './data-store';

interface PortalSnapshot {
  users: User[];
  companies: Company[];
  exportRecords: ExportRecord[];
  complaints: Complaint[];
  masterItems: Record<MasterCategory, string[]>;
  auditLogs: AuditLog[];
  notifications: Notification[];
  provinceApiSources: ProvinceApiSource[];
  provinceSyncLogs: ProvinceSyncLog[];
  provinceDataRecords: ProvinceDataRecord[];
}

const POLL_INTERVAL_MS = 15_000;
const nowISO = () => new Date().toISOString();
const localId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const ok = <T,>(data?: T): MutationResult<T> => ({ data });
const fail = <T,>(error: unknown, fallback: string): MutationResult<T> => ({
  error: error instanceof Error && error.message ? error.message : fallback,
});

const emptySnapshot = (): PortalSnapshot => ({
  users: [], companies: [], exportRecords: [], complaints: [],
  masterItems: {
    products: [], countries: [], provinces: [], ports: [], complaint_categories: [],
    document_types: [], roles: [], institutions: [],
  },
  auditLogs: [], notifications: [], provinceApiSources: [], provinceSyncLogs: [], provinceDataRecords: [],
});

function localComplaint(input: Partial<Complaint> & { tracking_number: string }): Complaint {
  const createdAt = nowISO();
  return {
    id: localId('complaint'), tracking_number: input.tracking_number, complainant_type: input.complainant_type || 'Buyer',
    full_name: input.full_name || '', email: input.email || '', phone: input.phone || '', company_name: input.company_name,
    country: input.country || '', address: input.address, tic: input.tic, exporter_company: input.exporter_company,
    export_registration_number: input.export_registration_number, export_record_number: input.export_record_number,
    product: input.product, category: input.category || 'Other', subject: input.subject || '', description: input.description || '',
    incident_date: input.incident_date || '', preferred_contact: input.preferred_contact || 'Email', priority: input.priority || 'medium',
    status: 'submitted', sla_deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), days_pending: 0,
    escalation_level: 0, created_at: createdAt, updated_at: createdAt,
  };
}

async function parseJson<T>(response: Response): Promise<T & { error?: string }> {
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

/** MySQL transport: every mutation is executed by a server route and the snapshot is refreshed from the response. */
export function MySqlDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<PortalSnapshot>(emptySnapshot);
  const [isLoaded, setIsLoaded] = useState(false);
  const mounted = useRef(true);
  const snapshotRef = useRef(snapshot);

  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const reload = useCallback(async () => {
    const response = await fetch('/api/mysql/portal', { cache: 'no-store', credentials: 'same-origin' });
    const next = await parseJson<PortalSnapshot>(response);
    snapshotRef.current = next;
    if (mounted.current) setSnapshot(next);
  }, []);

  const run = useCallback(async (operation: string, payload?: unknown): Promise<MutationResult> => {
    try {
      const response = await fetch('/api/mysql/portal', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, payload }),
      });
      const next = await parseJson<PortalSnapshot>(response);
      snapshotRef.current = next;
      if (mounted.current) setSnapshot(next);
      return ok();
    } catch (error) {
      console.error(`[mysql-data-store:${operation}]`, error);
      void reload().catch(reloadError => console.error('[mysql-data-store:reload]', reloadError));
      return fail(error, 'The change could not be saved.');
    }
  }, [reload]);

  useEffect(() => {
    let active = true;
    setIsLoaded(false);
    void reload()
      .catch(error => console.error('[mysql-data-store:load]', error))
      .finally(() => { if (active) setIsLoaded(true); });
    if (!user) return () => { active = false; };
    const intervalId = window.setInterval(() => { void reload().catch(error => console.error('[mysql-data-store:poll]', error)); }, POLL_INTERVAL_MS);
    return () => { active = false; window.clearInterval(intervalId); };
  }, [reload, user?.id]);

  const addUser = useCallback(async (input: NewUserInput): Promise<MutationResult<User>> => {
    const result = await run('create_user', input);
    if (result.error) return { error: result.error };
    const created = snapshotRef.current.users.find(item => item.email.toLowerCase() === input.email.trim().toLowerCase());
    return ok(created ?? {
      id: localId('user'), email: input.email, full_name: input.full_name, role: input.role as UserRole,
      institution: input.institution, is_active: true, created_at: nowISO(),
    });
  }, [run]);

  const updateUser = useCallback((id: string, patch: Partial<User>) => run('update_user', { id, ...patch }), [run]);
  const deleteUser = useCallback((id: string) => run('delete_user', { id }), [run]);

  const submitRegistration = useCallback(async (input: RegistrationInput): Promise<MutationResult<{ user: User; company: Company }>> => {
    try {
      const response = await fetch('/api/mysql/auth/register', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      });
      const body = await parseJson<{ user: User; company: Company }>(response);
      void reload().catch(() => undefined);
      return ok({ user: body.user, company: body.company });
    } catch (error) {
      return fail(error, 'Registration could not be submitted.');
    }
  }, [reload]);

  const reviewRegistration = useCallback((id: string, decision: ReviewDecision, remarks?: string) => run('review_registration', { id, decision, remarks }), [run]);
  const resubmitRegistration = useCallback((id: string, patch?: Partial<Company>) => run('resubmit_registration', { id, patch }), [run]);

  const addExportRecord = useCallback(async (input: Partial<ExportRecord>): Promise<MutationResult<ExportRecord>> => {
    const before = new Set(snapshotRef.current.exportRecords.map(item => item.id));
    const result = await run('create_export_record', input);
    if (result.error) return { error: result.error };
    const created = snapshotRef.current.exportRecords.find(item => !before.has(item.id) && item.exporter_id === user?.id)
      ?? snapshotRef.current.exportRecords.find(item => !before.has(item.id));
    if (!created) return { error: 'The export record was saved but could not be loaded. Refresh the page.' };
    return ok(created);
  }, [run, user?.id]);

  const updateExportRecord = useCallback((id: string, patch: Partial<ExportRecord>) => run('update_export_record', { id, patch }), [run]);
  const deleteExportRecord = useCallback((id: string) => run('delete_export_record', { id }), [run]);
  const reviewExportRecord = useCallback((id: string, decision: ReviewDecision, remarks?: string) => run('review_export_record', { id, decision, remarks }), [run]);

  const addComplaint = useCallback(async (input: Partial<Complaint> & { tracking_number: string }): Promise<MutationResult<Complaint>> => {
    try {
      const response = await fetch('/api/mysql/complaints', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      });
      await parseJson(response);
      void reload().catch(() => undefined);
      return ok(localComplaint(input));
    } catch (error) {
      return fail(error, 'Complaint could not be submitted.');
    }
  }, [reload]);

  const updateComplaint = useCallback((id: string, patch: Partial<Complaint>) => run('update_complaint', { id, patch }), [run]);
  const resolveComplaint = useCallback((id: string, resolutionSummary: string) => run('resolve_complaint', { id, resolution_summary: resolutionSummary }), [run]);
  const escalateComplaint = useCallback((id: string) => run('escalate_complaint', { id }), [run]);
  const addComplaintNote = useCallback((id: string, note: string) => run('add_complaint_note', { id, note }), [run]);

  const addMasterItem = useCallback((category: MasterCategory, value: string) => run('create_master_item', { category, value }), [run]);
  const updateMasterItem = useCallback(async (category: MasterCategory, index: number, value: string): Promise<MutationResult> => {
    const oldValue = snapshotRef.current.masterItems[category][index];
    if (oldValue === undefined) return { error: 'Master-data item was not found.' };
    return run('update_master_item', { category, old_value: oldValue, value });
  }, [run]);
  const deleteMasterItem = useCallback(async (category: MasterCategory, index: number): Promise<MutationResult> => {
    const oldValue = snapshotRef.current.masterItems[category][index];
    if (oldValue === undefined) return { error: 'Master-data item was not found.' };
    return run('delete_master_item', { category, old_value: oldValue, value: oldValue });
  }, [run]);

  const addProvinceApiSource = useCallback(async (input: Partial<ProvinceApiSource>): Promise<MutationResult<ProvinceApiSource>> => {
    const before = new Set(snapshotRef.current.provinceApiSources.map(item => item.id));
    const result = await run('create_province_source', input);
    if (result.error) return { error: result.error };
    const created = snapshotRef.current.provinceApiSources.find(item => !before.has(item.id));
    return ok(created ?? {
      id: localId('source'), name: input.name || 'New API Source', province: input.province || 'Punjab', system_name: input.system_name || '',
      api_url: input.api_url || '', api_key: input.api_key, cron_interval: input.cron_interval || 'daily', cron_expression: input.cron_expression,
      is_active: input.is_active ?? true, total_records_pulled: 0, created_at: nowISO(), updated_at: nowISO(), created_by: user?.id || '',
    });
  }, [run, user?.id]);

  const updateProvinceApiSource = useCallback((id: string, patch: Partial<ProvinceApiSource>) => run('update_province_source', { id, patch }), [run]);
  const deleteProvinceApiSource = useCallback((id: string) => run('delete_province_source', { id }), [run]);

  const triggerProvinceSync = useCallback(async (sourceId: string): Promise<MutationResult> => {
    setSnapshot(previous => ({ ...previous, provinceApiSources: previous.provinceApiSources.map(item => item.id === sourceId ? { ...item, last_sync_status: 'running' } : item) }));
    try {
      const response = await fetch('/api/mysql/province-sync', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId }),
      });
      await parseJson(response);
      await reload();
      return ok();
    } catch (error) {
      void reload().catch(() => undefined);
      return fail(error, 'The provincial sync failed.');
    }
  }, [reload]);

  const markAllNotificationsRead = useCallback(() => run('mark_notifications_read'), [run]);

  const resetData = useCallback(async (): Promise<MutationResult> => ({
    error: 'Demo reset is unavailable for the MySQL production backend.',
  }), []);

  const refresh = useCallback(async () => {
    await reload().catch(error => console.error('[mysql-data-store:refresh]', error));
  }, [reload]);

  const value: DataStoreContextType = {
    isLoaded, ...snapshot,
    addUser, updateUser, deleteUser, submitRegistration, reviewRegistration, resubmitRegistration,
    addExportRecord, updateExportRecord, deleteExportRecord, reviewExportRecord,
    addComplaint, updateComplaint, resolveComplaint, escalateComplaint, addComplaintNote,
    addMasterItem, updateMasterItem, deleteMasterItem,
    addProvinceApiSource, updateProvinceApiSource, deleteProvinceApiSource, triggerProvinceSync,
    markAllNotificationsRead, resetData, refresh,
  };

  return <DataStoreContext.Provider value={value}>{children}</DataStoreContext.Provider>;
}
