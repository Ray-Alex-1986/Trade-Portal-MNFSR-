'use client';

import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  User, Company, ExportRecord, Complaint, AuditLog, Notification,
  UserRole, StageReviewStatus, ProvinceApiSource, ProvinceSyncLog, ProvinceDataRecord,
  SyncStatus,
} from './types';
import { useAuth } from './auth';
import { resolveReviewStage } from './permissions';
import { getSupabaseBrowserClient } from './supabase/client';
import { subscribeToPortalChanges, PortalTable } from './supabase/realtime';
import {
  DataStoreContext, DataStoreContextType, MasterCategory, MutationResult, NewUserInput, RegistrationInput, ReviewDecision,
} from './data-store';

const nowISO = () => new Date().toISOString();
const localId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const nullableDate = (value: string | undefined) => value?.trim() || null;
const ok = <T,>(data?: T): MutationResult<T> => ({ data });
const fail = <T,>(error: string): MutationResult<T> => ({ error });
const NOT_CONFIGURED = 'The database connection is not configured.';

const EMPTY_MASTER: Record<MasterCategory, string[]> = {
  products: [], countries: [], provinces: [], ports: [],
  complaint_categories: [], document_types: [], roles: [], institutions: [],
};

interface PortalData {
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

interface Actor {
  id: string;
  name: string;
  role: UserRole;
}

// ---------------------------------------------------------------------------
// Row mappers (DB rows mirror the app types; only joins/nesting differ)
// ---------------------------------------------------------------------------
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  role?: { name: string } | { name: string }[] | null;
  institution?: { name: string } | { name: string }[] | null;
}

function mapProfile(p: ProfileRow): User {
  return {
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    role: (one(p.role)?.name ?? 'exporter') as UserRole,
    institution: one(p.institution)?.name ?? undefined,
    is_active: p.is_active,
    created_at: p.created_at,
    last_login: p.last_login ?? undefined,
  };
}

function mapExportRecord(row: Record<string, unknown> & { documents?: Record<string, unknown>[] }): ExportRecord {
  const { documents, ...rest } = row;
  return {
    ...(rest as unknown as ExportRecord),
    documents: (documents ?? []).map(d => ({ ...(d as object) })) as ExportRecord['documents'],
  };
}

function groupMaster(rows: { category: string; name: string }[]): Record<MasterCategory, string[]> {
  const grouped: Record<MasterCategory, string[]> = {
    products: [], countries: [], provinces: [], ports: [],
    complaint_categories: [], document_types: [], roles: [], institutions: [],
  };
  for (const row of rows) {
    const cat = row.category as MasterCategory;
    if (cat in grouped) grouped[cat].push(row.name);
  }
  return grouped;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => ({})) as { error?: string };
  return body.error || `${fallback} (HTTP ${response.status})`;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function SupabaseDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const [data, setData] = useState<PortalData>({
    users: [], companies: [], exportRecords: [], complaints: [],
    masterItems: EMPTY_MASTER, auditLogs: [], notifications: [],
    provinceApiSources: [], provinceSyncLogs: [], provinceDataRecords: [],
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const actorRef = useRef<Actor>({ id: 'system', name: 'System', role: 'super_admin' });
  const dataRef = useRef(data);

  useEffect(() => { dataRef.current = data; }, [data]);

  useEffect(() => {
    actorRef.current = user
      ? { id: user.id, name: user.full_name, role: user.role }
      : { id: 'system', name: 'System', role: 'super_admin' };
  }, [user]);

  const logError = (scope: string, error: { message?: string } | null | undefined) => {
    if (error) console.error(`[data-store:${scope}]`, error.message ?? error);
  };

  // -------------------------------------------------------------------------
  // Loaders
  // -------------------------------------------------------------------------
  const loadUsers = useCallback(async () => {
    if (!supabase) return;
    const { data: rows, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_active, last_login, created_at, role:roles(name), institution:institutions(name)')
      .order('created_at', { ascending: false });
    if (error) return logError('loadUsers', error);
    setData(prev => ({ ...prev, users: (rows ?? []).map(r => mapProfile(r as ProfileRow)) }));
  }, [supabase]);

  const loadCompanies = useCallback(async () => {
    if (!supabase) return;
    const { data: rows, error } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
    if (error) return logError('loadCompanies', error);
    setData(prev => ({ ...prev, companies: (rows ?? []) as unknown as Company[] }));
  }, [supabase]);

  const loadExportRecords = useCallback(async () => {
    if (!supabase) return;
    const { data: rows, error } = await supabase
      .from('export_records')
      .select('*, documents(*)')
      .order('created_at', { ascending: false });
    if (error) return logError('loadExportRecords', error);
    setData(prev => ({ ...prev, exportRecords: (rows ?? []).map(r => mapExportRecord(r as never)) }));
  }, [supabase]);

  const loadComplaints = useCallback(async () => {
    if (!supabase) return;
    const { data: rows, error } = await supabase.from('complaints').select('*').order('created_at', { ascending: false });
    if (error) return logError('loadComplaints', error);
    setData(prev => ({ ...prev, complaints: (rows ?? []) as unknown as Complaint[] }));
  }, [supabase]);

  const loadMasterData = useCallback(async () => {
    if (!supabase) return;
    const { data: rows, error } = await supabase.from('master_data').select('category, name').order('sort_order');
    if (error) return logError('loadMasterData', error);
    setData(prev => ({ ...prev, masterItems: groupMaster((rows ?? []) as { category: string; name: string }[]) }));
  }, [supabase]);

  const loadAuditLogs = useCallback(async () => {
    if (!supabase) return;
    const { data: rows, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return logError('loadAuditLogs', error);
    setData(prev => ({ ...prev, auditLogs: (rows ?? []) as unknown as AuditLog[] }));
  }, [supabase]);

  const loadNotifications = useCallback(async () => {
    if (!supabase) return;
    const { data: rows, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return logError('loadNotifications', error);
    setData(prev => ({ ...prev, notifications: (rows ?? []) as unknown as Notification[] }));
  }, [supabase]);

  const loadProvinceSources = useCallback(async () => {
    if (!supabase) return;
    const { data: rows, error } = await supabase.from('province_api_sources').select('*').order('created_at');
    if (error) return logError('loadProvinceSources', error);
    setData(prev => ({ ...prev, provinceApiSources: (rows ?? []) as unknown as ProvinceApiSource[] }));
  }, [supabase]);

  const loadProvinceSyncLogs = useCallback(async () => {
    if (!supabase) return;
    const { data: rows, error } = await supabase
      .from('province_sync_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(100);
    if (error) return logError('loadProvinceSyncLogs', error);
    setData(prev => ({ ...prev, provinceSyncLogs: (rows ?? []) as unknown as ProvinceSyncLog[] }));
  }, [supabase]);

  const loadProvinceDataRecords = useCallback(async () => {
    if (!supabase) return;
    const { data: rows, error } = await supabase
      .from('province_data_records')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(300);
    if (error) return logError('loadProvinceDataRecords', error);
    setData(prev => ({ ...prev, provinceDataRecords: (rows ?? []) as unknown as ProvinceDataRecord[] }));
  }, [supabase]);

  const loadAll = useCallback(async () => {
    await Promise.all([
      loadUsers(), loadCompanies(), loadExportRecords(), loadComplaints(), loadMasterData(),
      loadAuditLogs(), loadNotifications(), loadProvinceSources(), loadProvinceSyncLogs(),
      loadProvinceDataRecords(),
    ]);
  }, [loadUsers, loadCompanies, loadExportRecords, loadComplaints, loadMasterData,
      loadAuditLogs, loadNotifications, loadProvinceSources, loadProvinceSyncLogs, loadProvinceDataRecords]);

  const tableLoaders: Record<PortalTable, () => Promise<void>> = {
    profiles: loadUsers,
    companies: loadCompanies,
    export_records: loadExportRecords,
    documents: loadExportRecords,
    complaints: loadComplaints,
    notifications: loadNotifications,
    audit_logs: loadAuditLogs,
    master_data: loadMasterData,
    province_api_sources: loadProvinceSources,
    province_sync_logs: loadProvinceSyncLogs,
    province_data_records: loadProvinceDataRecords,
  };

  // Initial load + reload whenever the signed-in user changes (RLS visibility changes).
  // Clear protected data immediately on logout so a later anonymous query can
  // never leave the prior user's records rendered in the browser.
  useEffect(() => {
    if (!supabase) { setIsLoaded(true); return; }
    if (!user) {
      setData({
        users: [], companies: [], exportRecords: [], complaints: [],
        masterItems: EMPTY_MASTER, auditLogs: [], notifications: [],
        provinceApiSources: [], provinceSyncLogs: [], provinceDataRecords: [],
      });
      setIsLoaded(true);
      void loadMasterData();
      return;
    }
    let cancelled = false;
    setIsLoaded(false);
    (async () => {
      await loadAll();
      if (!cancelled) setIsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [supabase, user?.id, loadAll, loadMasterData]);

  // Live subscriptions — any DB change refetches the affected table
  useEffect(() => {
    if (!supabase || !user) return;
    return subscribeToPortalChanges(supabase, (table) => {
      void tableLoaders[table]?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user?.id]);

  // -------------------------------------------------------------------------
  // Shared write helpers
  // -------------------------------------------------------------------------
  const audit = useCallback(async (entry: { action: string; module: string; record_id: string; previous_value?: string; new_value?: string }) => {
    if (!supabase) return;
    const actor = actorRef.current;
    if (actor.id === 'system') return; // RLS only permits authenticated users to write their own entries
    const { error } = await supabase.from('audit_logs').insert({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: entry.action,
      module: entry.module,
      record_id: entry.record_id,
      previous_value: entry.previous_value,
      new_value: entry.new_value,
      ip_address: 'client',
    });
    logError('audit', error);
    void loadAuditLogs();
  }, [supabase, loadAuditLogs]);

  const notifyUser = useCallback(async (userId: string, title: string, message: string, type: Notification['type'], link?: string) => {
    if (!supabase || !userId || userId === 'system') return;
    const { error } = await supabase.from('notifications').insert({ user_id: userId, title, message, type, link });
    logError('notify', error);
  }, [supabase]);

  const notifySuperAdmins = useCallback(async (title: string, message: string, type: Notification['type'], link?: string) => {
    if (!supabase) return;
    const { error } = await supabase.rpc('notify_super_admins', { p_title: title, p_message: message, p_type: type, p_link: link });
    logError('notifySuperAdmins', error);
  }, [supabase]);

  const patchState = useCallback((updater: (prev: PortalData) => Partial<PortalData>) => {
    setData(prev => ({ ...prev, ...updater(prev) }));
  }, []);

  /** Attach the current Supabase access token to protected server-route calls. */
  const fetchWithAuth = useCallback(async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const { data: sessionData } = await supabase?.auth.getSession() ?? { data: { session: null } };
    const token = sessionData.session?.access_token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  }, [supabase]);

  // -------------------------------------------------------------------------
  // Users
  // -------------------------------------------------------------------------
  const addUser = useCallback(async (input: NewUserInput): Promise<MutationResult<User>> => {
    try {
      const response = await fetchWithAuth('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) return fail(await readError(response, 'The user could not be created'));
      const { user: created } = await response.json() as { user: User };
      patchState(prev => ({ users: [created, ...prev.users.filter(u => u.id !== created.id)] }));
      void loadUsers();
      return ok(created);
    } catch (error) {
      console.error('[addUser]', error);
      return fail('The user management service is unavailable.');
    }
  }, [patchState, fetchWithAuth, loadUsers]);

  const updateUser = useCallback(async (id: string, patch: Partial<User>): Promise<MutationResult> => {
    const previous = dataRef.current.users.find(u => u.id === id);
    patchState(prev => ({ users: prev.users.map(u => (u.id === id ? { ...u, ...patch } : u)) }));
    try {
      const response = await fetchWithAuth('/api/admin-users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch, institution: patch.institution === undefined ? undefined : (patch.institution || null) }),
      });
      if (!response.ok) {
        void loadUsers();
        return fail(await readError(response, 'The user could not be updated'));
      }
      void loadUsers();
      void audit({
        action: 'Update User', module: 'User Management', record_id: previous?.email ?? id,
        new_value: JSON.stringify(patch).substring(0, 200),
      });
      return ok();
    } catch (error) {
      console.error('[updateUser]', error);
      void loadUsers();
      return fail('The user management service is unavailable.');
    }
  }, [patchState, audit, fetchWithAuth, loadUsers]);

  const deleteUser = useCallback(async (id: string): Promise<MutationResult> => {
    const previous = dataRef.current.users.find(u => u.id === id);
    try {
      const response = await fetchWithAuth(`/api/admin-users?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) return fail(await readError(response, 'The user could not be deleted'));
      patchState(prev => ({ users: prev.users.filter(u => u.id !== id) }));
      void audit({ action: 'Delete User', module: 'User Management', record_id: previous?.email ?? id, new_value: previous?.full_name });
      return ok();
    } catch (error) {
      console.error('[deleteUser]', error);
      return fail('The user management service is unavailable.');
    }
  }, [patchState, audit, fetchWithAuth]);

  // -------------------------------------------------------------------------
  // Registrations
  // -------------------------------------------------------------------------
  const submitRegistration = useCallback(async (input: RegistrationInput): Promise<MutationResult<{ user: User; company: Company }>> => {
    const { registerExporter } = await import('./registration');
    const result = await registerExporter(input);
    if (result.error || !result.user || !result.company) return fail(result.error || 'Registration could not be submitted.');
    return ok({ user: result.user, company: result.company });
  }, []);

  const reviewRegistration = useCallback(async (id: string, decision: ReviewDecision, remarks?: string): Promise<MutationResult> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const company = dataRef.current.companies.find(c => c.id === id);
    if (!company) return fail('Registration was not found.');
    const actor = actorRef.current;
    const stage = resolveReviewStage(actor.role, company.tdap_review_status);
    if (!stage) return fail('Your role cannot review registrations.');

    const oldStatus = company.status;
    let newStatus: Company['status'] = oldStatus;
    let tdapReview: StageReviewStatus = company.tdap_review_status;
    let nafsaReview: StageReviewStatus = company.nafsa_review_status;
    let nadraStatus = company.nadra_status;
    let secpStatus = company.secp_status;
    let ntnStatus = company.ntn_status;

    if (decision === 'approve') {
      if (stage === 'tdap') {
        tdapReview = 'reviewed';
        nafsaReview = 'pending';
        newStatus = 'under_nafsa_review';
      } else {
        nafsaReview = 'reviewed';
        newStatus = 'approved';
        nadraStatus = 'verified';
        secpStatus = 'verified';
        ntnStatus = 'verified';
      }
    } else if (decision === 'reject') {
      newStatus = 'rejected';
      if (stage === 'tdap') tdapReview = 'rejected';
      else nafsaReview = 'rejected';
    } else {
      newStatus = 'additional_info_required';
      if (stage === 'tdap') tdapReview = 'info_requested';
      else nafsaReview = 'info_requested';
    }

    const { error } = await supabase.from('companies').update({
      status: newStatus,
      tdap_review_status: tdapReview,
      nafsa_review_status: nafsaReview,
      nadra_status: nadraStatus,
      secp_status: secpStatus,
      ntn_status: ntnStatus,
      updated_by: actor.id,
      updated_at: nowISO(),
    }).eq('id', id);
    if (error) {
      logError('reviewRegistration', error);
      return fail(`The decision could not be saved: ${error.message}`);
    }

    patchState(prev => ({
      companies: prev.companies.map(c => c.id === id ? {
        ...c, status: newStatus, tdap_review_status: tdapReview, nafsa_review_status: nafsaReview,
        nadra_status: nadraStatus, secp_status: secpStatus, ntn_status: ntnStatus, updated_at: nowISO(),
      } : c),
    }));

    const stageLabel = stage === 'tdap' ? 'TDAP' : 'NAFSA';
    void audit({
      action: `${decision === 'approve' ? 'Approve' : decision === 'reject' ? 'Reject' : 'Request Info'} (${stageLabel})`,
      module: 'Registration', record_id: company.registration_number,
      previous_value: oldStatus, new_value: remarks ? `${newStatus} — ${remarks}` : newStatus,
    });

    const notifType: Notification['type'] = decision === 'approve' ? 'success' : decision === 'reject' ? 'error' : 'warning';
    let notifTitle: string;
    let notifMsg: string;
    if (decision === 'approve' && stage === 'tdap') {
      notifTitle = 'TDAP Review Passed';
      notifMsg = `Your registration ${company.registration_number} has passed TDAP review and moved to NAFSA review.`;
    } else if (decision === 'approve') {
      notifTitle = 'Registration Approved';
      notifMsg = `Your registration ${company.registration_number} (${company.legal_name}) has been fully approved. You are now a verified exporter.`;
    } else if (decision === 'reject') {
      notifTitle = `Registration Rejected (${stageLabel})`;
      notifMsg = `Your registration ${company.registration_number} has been rejected by ${stageLabel}.${remarks ? ` Reason: ${remarks}` : ''}`;
    } else {
      notifTitle = `Additional Information Required (${stageLabel})`;
      notifMsg = `${stageLabel} requires additional information for registration ${company.registration_number}.${remarks ? ` Details: ${remarks}` : ''}`;
    }
    void notifyUser(company.owner_id, notifTitle, notifMsg, notifType, '/dashboard');
    return ok();
  }, [supabase, patchState, audit, notifyUser]);

  const resubmitRegistration = useCallback(async (id: string, patch?: Partial<Company>): Promise<MutationResult> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const company = dataRef.current.companies.find(c => c.id === id);
    if (!company) return fail('Registration was not found.');
    const actor = actorRef.current;
    if (company.owner_id !== actor.id && actor.role !== 'super_admin') return fail('Only the company owner can resubmit this registration.');
    if (!['additional_info_required', 'rejected', 'draft'].includes(company.status)) return fail('Only returned or draft registrations can be resubmitted.');
    const { id: _id, owner_id: _owner, status: _status, created_at: _c, updated_at: _u, ...safePatch } = patch ?? {};
    const update = { ...safePatch, status: 'submitted', tdap_review_status: 'pending', nafsa_review_status: 'not_initiated', updated_at: nowISO() };
    const { error } = await supabase.from('companies').update(update).eq('id', id);
    if (error) return fail(`The registration could not be resubmitted: ${error.message}`);
    patchState(prev => ({ companies: prev.companies.map(c => c.id === id ? { ...c, ...update } as Company : c) }));
    void audit({ action: 'Resubmit Registration', module: 'Registration', record_id: company.registration_number, previous_value: company.status, new_value: 'submitted' });
    void notifySuperAdmins('Registration Resubmitted', `${company.legal_name} (${company.registration_number}) has resubmitted its registration for review.`, 'info', '/admin/reviews');
    return ok();
  }, [supabase, patchState, audit, notifySuperAdmins]);

  // -------------------------------------------------------------------------
  // Export records
  // -------------------------------------------------------------------------
  const addExportRecord = useCallback(async (input: Partial<ExportRecord>): Promise<MutationResult<ExportRecord>> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const actor = actorRef.current;
    const state = dataRef.current;
    if (!input.product?.trim()) return fail('Product is required.');
    const myCompany = state.companies.find(c => c.id === input.company_id && c.owner_id === actor.id)
      ?? state.companies.find(c => c.owner_id === actor.id && c.status === 'approved');
    if (!myCompany) return fail('An approved company registration is required before adding export records.');
    const maxNum = state.exportRecords.reduce((max, r) => {
      const m = r.consignment_number.match(/(\d+)$/);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 2025000);
    const consignment = `EXP-${Math.max(maxNum + 1, Number(String(Date.now()).slice(-7)))}`;
    const documents = input.documents || [];
    const row = {
      consignment_number: consignment,
      exporter_id: actor.id,
      company_id: myCompany.id,
      product: input.product.trim(),
      product_category: input.product_category || 'Other Agricultural',
      hs_code: input.hs_code || '9999.99',
      description: input.description || '',
      quantity: input.quantity ?? 0,
      unit: input.unit || 'Metric Tons',
      estimated_value: input.estimated_value ?? 0,
      currency: input.currency || 'USD',
      country_of_origin: 'Pakistan',
      province_of_production: input.province_of_production || 'Punjab',
      district_of_production: input.district_of_production || '',
      crop_year: input.crop_year ?? null,
      batch_number: input.batch_number || '',
      packaging_type: input.packaging_type || 'Carton Boxes',
      num_packages: input.num_packages ?? 0,
      intended_shipment_date: nullableDate(input.intended_shipment_date),
      buyer_name: input.buyer_name || '',
      buyer_company: input.buyer_company || '',
      buyer_country: input.buyer_country || '',
      buyer_address: input.buyer_address || '',
      buyer_contact: input.buyer_contact || '',
      buyer_email: input.buyer_email || '',
      buyer_phone: input.buyer_phone || '',
      purchase_order: input.purchase_order || '',
      destination_country: input.destination_country || '',
      destination_port: input.destination_port || '',
      port_of_departure: input.port_of_departure || 'Karachi Port',
      transport_mode: input.transport_mode || 'Sea',
      shipping_company: input.shipping_company || '',
      container_number: input.container_number || '',
      bill_of_lading: input.bill_of_lading || '',
      expected_departure: nullableDate(input.expected_departure),
      expected_arrival: nullableDate(input.expected_arrival),
      status: input.status || 'submitted',
      tdap_review_status: 'pending',
      nafsa_review_status: 'not_initiated',
      created_by: actor.id,
      updated_by: actor.id,
    };

    const { data: inserted, error } = await supabase.from('export_records').insert(row).select().single();
    if (error || !inserted) {
      console.error('[addExportRecord]', error?.message ?? 'The export record was not created.');
      return fail(`The export record could not be saved: ${error?.message ?? 'unknown error'}`);
    }

    const persistedRecord: ExportRecord = { ...(inserted as unknown as ExportRecord), documents: [] };
    if (documents.length) {
      const { data: documentRows, error: documentsError } = await supabase
        .from('documents')
        .insert(documents.map(({ id: _documentId, record_id: _recordId, ...document }) => ({
          ...document,
          record_id: persistedRecord.id,
          company_id: persistedRecord.company_id,
          uploaded_by: actor.id,
        })))
        .select();
      if (documentsError) console.error('[addExportRecord:documents]', documentsError.message);
      else persistedRecord.documents = (documentRows ?? []) as ExportRecord['documents'];
    }

    patchState(prev => ({ exportRecords: [persistedRecord, ...prev.exportRecords.filter(r => r.id !== persistedRecord.id)] }));
    void audit({
      action: 'Create Record', module: 'Export Records', record_id: persistedRecord.consignment_number,
      new_value: `${persistedRecord.product} → ${persistedRecord.destination_country} (${persistedRecord.status})`,
    });
    void notifyUser(actor.id, 'Export Record Submitted', `Your export record ${persistedRecord.consignment_number} has been submitted and is pending review.`, 'info', '/dashboard/exports');
    void notifySuperAdmins('New Export Record', `${myCompany.legal_name} submitted ${persistedRecord.consignment_number} (${persistedRecord.product} → ${persistedRecord.destination_country}).`, 'info', '/admin/reviews');
    return ok(persistedRecord);
  }, [supabase, patchState, audit, notifyUser, notifySuperAdmins]);

  const updateExportRecord = useCallback(async (id: string, patch: Partial<ExportRecord>): Promise<MutationResult> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const record = dataRef.current.exportRecords.find(r => r.id === id);
    if (!record) return fail('Export record was not found.');
    const { documents: _docs, id: _id, created_at: _c, updated_at: _u, ...rest } = patch;
    const resubmitted = patch.status === 'submitted' && record.status !== 'submitted';
    const update: Record<string, unknown> = {
      ...rest,
      ...(rest.intended_shipment_date !== undefined ? { intended_shipment_date: nullableDate(rest.intended_shipment_date) } : {}),
      ...(rest.expected_departure !== undefined ? { expected_departure: nullableDate(rest.expected_departure) } : {}),
      ...(rest.expected_arrival !== undefined ? { expected_arrival: nullableDate(rest.expected_arrival) } : {}),
      ...(resubmitted ? { tdap_review_status: 'pending', nafsa_review_status: 'not_initiated' } : {}),
      updated_by: actorRef.current.id,
      updated_at: nowISO(),
    };
    const { error } = await supabase.from('export_records').update(update).eq('id', id);
    if (error) return fail(`The export record could not be updated: ${error.message}`);
    patchState(prev => ({
      exportRecords: prev.exportRecords.map(r => r.id === id ? { ...r, ...patch, ...(resubmitted ? { tdap_review_status: 'pending', nafsa_review_status: 'not_initiated' } : {}), updated_at: nowISO() } : r),
    }));
    void audit({ action: resubmitted ? 'Resubmit Record' : 'Update Record', module: 'Export Records', record_id: record.consignment_number, new_value: JSON.stringify(rest).substring(0, 200) });
    void notifyUser(record.exporter_id, 'Export Record Updated', `Your export record ${record.consignment_number} has been updated${resubmitted ? ' and resubmitted for review' : ''}.`, 'info', '/dashboard/exports');
    if (resubmitted) void notifySuperAdmins('Export Record Resubmitted', `${record.consignment_number} has been corrected and resubmitted for review.`, 'info', '/admin/reviews');
    return ok();
  }, [supabase, patchState, audit, notifyUser, notifySuperAdmins]);

  const deleteExportRecord = useCallback(async (id: string): Promise<MutationResult> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const record = dataRef.current.exportRecords.find(r => r.id === id);
    if (!record) return fail('Export record was not found.');
    const { error, count } = await supabase.from('export_records').delete({ count: 'exact' }).eq('id', id);
    if (error) return fail(`The export record could not be deleted: ${error.message}`);
    if (count === 0) return fail('You do not have permission to delete this export record.');
    patchState(prev => ({ exportRecords: prev.exportRecords.filter(r => r.id !== id) }));
    void audit({ action: 'Delete Record', module: 'Export Records', record_id: record.consignment_number, new_value: `${record.product} → ${record.destination_country}` });
    return ok();
  }, [supabase, patchState, audit]);

  const reviewExportRecord = useCallback(async (id: string, decision: ReviewDecision, remarks?: string): Promise<MutationResult> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const record = dataRef.current.exportRecords.find(r => r.id === id);
    if (!record) return fail('Export record was not found.');
    const actor = actorRef.current;
    const stage = resolveReviewStage(actor.role, record.tdap_review_status);
    if (!stage) return fail('Your role cannot review export records.');

    const oldStatus = record.status;
    let newStatus: ExportRecord['status'] = oldStatus;
    let tdapReview = record.tdap_review_status || 'pending';
    let nafsaReview = record.nafsa_review_status || 'not_initiated';

    if (decision === 'approve') {
      if (stage === 'tdap') {
        tdapReview = 'reviewed';
        nafsaReview = 'pending';
        newStatus = 'under_nafsa_review';
      } else {
        nafsaReview = 'reviewed';
        newStatus = 'approved';
      }
    } else if (decision === 'reject') {
      newStatus = 'rejected';
      if (stage === 'tdap') tdapReview = 'rejected';
      else nafsaReview = 'rejected';
    } else {
      newStatus = 'additional_info_required';
      if (stage === 'tdap') tdapReview = 'info_requested';
      else nafsaReview = 'info_requested';
    }

    const reviewerField = stage === 'tdap' ? 'tdap_reviewer_id' : 'nafsa_reviewer_id';
    const reviewDateField = stage === 'tdap' ? 'tdap_review_date' : 'nafsa_review_date';
    const remarksField = stage === 'tdap' ? 'tdap_remarks' : 'nafsa_remarks';
    const { error } = await supabase.from('export_records').update({
      status: newStatus,
      tdap_review_status: tdapReview,
      nafsa_review_status: nafsaReview,
      [reviewerField]: actor.id,
      [reviewDateField]: nowISO(),
      ...(remarks ? { [remarksField]: remarks } : {}),
      updated_by: actor.id,
      updated_at: nowISO(),
    }).eq('id', id);
    if (error) return fail(`The decision could not be saved: ${error.message}`);

    patchState(prev => ({
      exportRecords: prev.exportRecords.map(r => r.id === id ? {
        ...r, status: newStatus, tdap_review_status: tdapReview, nafsa_review_status: nafsaReview, updated_at: nowISO(),
      } : r),
    }));

    const stageLabel = stage === 'tdap' ? 'TDAP' : 'NAFSA';
    void audit({
      action: `${decision === 'approve' ? 'Approve' : decision === 'reject' ? 'Reject' : 'Request Info'} (${stageLabel})`,
      module: 'Export Records', record_id: record.consignment_number,
      previous_value: oldStatus, new_value: remarks ? `${newStatus} — ${remarks}` : newStatus,
    });

    const notifType: Notification['type'] = decision === 'approve' ? 'success' : decision === 'reject' ? 'error' : 'warning';
    let notifTitle: string;
    let notifMsg: string;
    if (decision === 'approve' && stage === 'tdap') {
      notifTitle = 'TDAP Review Passed';
      notifMsg = `Export record ${record.consignment_number} passed TDAP review and moved to NAFSA review.`;
    } else if (decision === 'approve') {
      notifTitle = 'Export Record Approved';
      notifMsg = `Export record ${record.consignment_number} (${record.product}) has been fully approved and is ready for shipment.`;
    } else if (decision === 'reject') {
      notifTitle = `Export Rejected (${stageLabel})`;
      notifMsg = `Export record ${record.consignment_number} has been rejected by ${stageLabel}.${remarks ? ` Reason: ${remarks}` : ''}`;
    } else {
      notifTitle = `Additional Information Required (${stageLabel})`;
      notifMsg = `${stageLabel} requires additional information for export record ${record.consignment_number}.${remarks ? ` Details: ${remarks}` : ''}`;
    }
    void notifyUser(record.exporter_id, notifTitle, notifMsg, notifType, '/dashboard/exports');
    return ok();
  }, [supabase, patchState, audit, notifyUser]);

  // -------------------------------------------------------------------------
  // Complaints
  // -------------------------------------------------------------------------
  const addComplaint = useCallback(async (input: Partial<Complaint> & { tracking_number: string }): Promise<MutationResult<Complaint>> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const created: Complaint = {
      id: localId('comp'),
      tracking_number: input.tracking_number,
      complainant_type: input.complainant_type || 'Buyer',
      full_name: input.full_name || '',
      email: input.email || '',
      phone: input.phone || '',
      company_name: input.company_name,
      country: input.country || '',
      address: input.address,
      tic: input.tic,
      exporter_company: input.exporter_company,
      export_registration_number: input.export_registration_number,
      export_record_number: input.export_record_number,
      product: input.product,
      category: input.category || 'Other',
      subject: input.subject || '',
      description: input.description || '',
      incident_date: input.incident_date || '',
      preferred_contact: input.preferred_contact || 'Email',
      priority: input.priority || 'medium',
      status: 'submitted',
      sla_deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      days_pending: 0,
      escalation_level: 0,
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    // RPC inserts the complaint + super-admin notification + audit log atomically
    const { data: result, error } = await supabase.rpc('submit_public_complaint', {
      payload: {
        tracking_number: created.tracking_number,
        complainant_type: created.complainant_type,
        full_name: created.full_name,
        email: created.email,
        phone: created.phone,
        company_name: created.company_name ?? null,
        country: created.country,
        exporter_company: created.exporter_company ?? null,
        export_registration_number: created.export_registration_number ?? null,
        export_record_number: created.export_record_number ?? null,
        product: created.product ?? null,
        category: created.category,
        subject: created.subject,
        description: created.description,
        incident_date: created.incident_date || null,
        preferred_contact: created.preferred_contact,
        priority: created.priority,
      },
    });
    if (error) {
      console.error('[addComplaint]', error.message);
      return fail(`The complaint could not be submitted: ${error.message}`);
    }
    const persistedId = (result as { id?: string } | null)?.id;
    const persisted = { ...created, id: persistedId || created.id };
    patchState(prev => ({ complaints: [persisted, ...prev.complaints] }));
    void loadComplaints();
    return ok(persisted);
  }, [supabase, patchState, loadComplaints]);

  const updateComplaint = useCallback(async (id: string, patch: Partial<Complaint>): Promise<MutationResult> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const complaint = dataRef.current.complaints.find(c => c.id === id);
    if (!complaint) return fail('Complaint was not found.');
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = patch;
    if (!Object.keys(rest).length) return ok();
    const { error } = await supabase.from('complaints').update({ ...rest, updated_by: actorRef.current.id, updated_at: nowISO() }).eq('id', id);
    if (error) return fail(`The complaint could not be updated: ${error.message}`);
    patchState(prev => ({ complaints: prev.complaints.map(c => c.id === id ? { ...c, ...patch, updated_at: nowISO() } : c) }));
    void audit({ action: 'Update Complaint', module: 'Complaints', record_id: complaint.tracking_number, new_value: JSON.stringify(rest).substring(0, 200) });
    return ok();
  }, [supabase, patchState, audit]);

  const resolveComplaint = useCallback(async (id: string, resolutionSummary: string): Promise<MutationResult> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const complaint = dataRef.current.complaints.find(c => c.id === id);
    if (!complaint) return fail('Complaint was not found.');
    const resolvedAt = nowISO();
    const { error } = await supabase.from('complaints').update({
      status: 'resolved', resolution_summary: resolutionSummary, resolved_at: resolvedAt, updated_by: actorRef.current.id, updated_at: resolvedAt,
    }).eq('id', id);
    if (error) return fail(`The complaint could not be resolved: ${error.message}`);
    patchState(prev => ({
      complaints: prev.complaints.map(c => c.id === id ? {
        ...c, status: 'resolved', resolution_summary: resolutionSummary, resolved_at: resolvedAt, updated_at: resolvedAt,
      } : c),
    }));
    void audit({ action: 'Resolve Complaint', module: 'Complaints', record_id: complaint.tracking_number, previous_value: complaint.status, new_value: 'resolved' });
    void notifySuperAdmins('Complaint Resolved', `Complaint ${complaint.tracking_number} has been resolved.`, 'success', '/admin/reviews');
    const complainant = dataRef.current.users.find(u => u.email.toLowerCase() === complaint.email.toLowerCase());
    if (complainant) void notifyUser(complainant.id, 'Complaint Resolved', `Your complaint ${complaint.tracking_number} has been resolved. ${resolutionSummary}`, 'success', '/dashboard/complaints');
    return ok();
  }, [supabase, patchState, audit, notifySuperAdmins, notifyUser]);

  const escalateComplaint = useCallback(async (id: string): Promise<MutationResult> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const complaint = dataRef.current.complaints.find(c => c.id === id);
    if (!complaint) return fail('Complaint was not found.');
    const newLevel = (complaint.escalation_level || 0) + 1;
    const { error } = await supabase.from('complaints').update({ status: 'escalated', escalation_level: newLevel, updated_by: actorRef.current.id, updated_at: nowISO() }).eq('id', id);
    if (error) return fail(`The complaint could not be escalated: ${error.message}`);
    patchState(prev => ({
      complaints: prev.complaints.map(c => c.id === id ? { ...c, status: 'escalated', escalation_level: newLevel, updated_at: nowISO() } : c),
    }));
    void audit({ action: 'Escalate Complaint', module: 'Complaints', record_id: complaint.tracking_number, previous_value: complaint.status, new_value: 'escalated' });
    void notifySuperAdmins('Complaint Escalated', `Complaint ${complaint.tracking_number} has been escalated to level ${newLevel}.`, 'warning', '/admin/reviews');
    return ok();
  }, [supabase, patchState, audit, notifySuperAdmins]);

  const addComplaintNote = useCallback(async (id: string, note: string): Promise<MutationResult> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const complaint = dataRef.current.complaints.find(c => c.id === id);
    if (!complaint) return fail('Complaint was not found.');
    const actor = actorRef.current;
    const entry = `[${new Date().toLocaleString()}] ${actor.name}: ${note}`;
    const newNotes = complaint.internal_notes ? `${complaint.internal_notes}\n${entry}` : entry;
    const { error } = await supabase.from('complaints').update({ internal_notes: newNotes, updated_by: actor.id, updated_at: nowISO() }).eq('id', id);
    if (error) return fail(`The note could not be saved: ${error.message}`);
    patchState(prev => ({
      complaints: prev.complaints.map(c => c.id === id ? { ...c, internal_notes: newNotes, updated_at: nowISO() } : c),
    }));
    void audit({ action: 'Add Note', module: 'Complaints', record_id: complaint.tracking_number, new_value: note });
    return ok();
  }, [supabase, patchState, audit]);

  // -------------------------------------------------------------------------
  // Master data
  // -------------------------------------------------------------------------
  const addMasterItem = useCallback(async (category: MasterCategory, value: string): Promise<MutationResult> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const trimmed = value.trim();
    if (!trimmed) return fail('Enter a value.');
    const sortOrder = (dataRef.current.masterItems[category]?.length ?? 0) + 1;
    const { error } = await supabase.from('master_data').insert({ category, name: trimmed, sort_order: sortOrder });
    if (error) return fail(`The item could not be added: ${error.message}`);
    patchState(prev => ({ masterItems: { ...prev.masterItems, [category]: [...(prev.masterItems[category] || []), trimmed] } }));
    void audit({ action: 'Add Master Data Item', module: 'Master Data', record_id: category, new_value: trimmed });
    return ok();
  }, [supabase, patchState, audit]);

  const updateMasterItem = useCallback(async (category: MasterCategory, index: number, value: string): Promise<MutationResult> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const old = dataRef.current.masterItems[category]?.[index];
    if (old === undefined) return fail('Master-data item was not found.');
    const trimmed = value.trim();
    if (!trimmed) return fail('Enter a value.');
    const { error } = await supabase.from('master_data').update({ name: trimmed, updated_at: nowISO() }).eq('category', category).eq('name', old);
    if (error) return fail(`The item could not be updated: ${error.message}`);
    patchState(prev => ({
      masterItems: { ...prev.masterItems, [category]: (prev.masterItems[category] || []).map((item, i) => i === index ? trimmed : item) },
    }));
    void audit({ action: 'Update Master Data Item', module: 'Master Data', record_id: category, previous_value: old, new_value: trimmed });
    return ok();
  }, [supabase, patchState, audit]);

  const deleteMasterItem = useCallback(async (category: MasterCategory, index: number): Promise<MutationResult> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const old = dataRef.current.masterItems[category]?.[index];
    if (old === undefined) return fail('Master-data item was not found.');
    const { error } = await supabase.from('master_data').delete().eq('category', category).eq('name', old);
    if (error) return fail(`The item could not be deleted: ${error.message}`);
    patchState(prev => ({
      masterItems: { ...prev.masterItems, [category]: (prev.masterItems[category] || []).filter((_, i) => i !== index) },
    }));
    void audit({ action: 'Delete Master Data Item', module: 'Master Data', record_id: category, previous_value: old });
    return ok();
  }, [supabase, patchState, audit]);

  // -------------------------------------------------------------------------
  // Misc
  // -------------------------------------------------------------------------
  const markAllNotificationsRead = useCallback(async (): Promise<MutationResult> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const actor = actorRef.current;
    const ids = dataRef.current.notifications.filter(n => !n.is_read && n.user_id === actor.id).map(n => n.id);
    if (!ids.length) return ok();
    const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    if (error) return fail(`Notifications could not be updated: ${error.message}`);
    patchState(prev => ({ notifications: prev.notifications.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n) }));
    return ok();
  }, [supabase, patchState]);

  const resetData = useCallback(async (): Promise<MutationResult> => {
    try {
      const res = await fetchWithAuth('/api/reset-demo', { method: 'POST' });
      if (!res.ok) return fail(await readError(res, 'The demo reset could not be completed'));
      await loadAll();
      return ok();
    } catch (err) {
      console.error('[resetData]', err);
      return fail('The demo reset service is unavailable.');
    }
  }, [loadAll, fetchWithAuth]);

  const refresh = useCallback(async () => {
    await loadAll();
  }, [loadAll]);

  // -------------------------------------------------------------------------
  // Province API sources
  // -------------------------------------------------------------------------
  const addProvinceApiSource = useCallback(async (input: Partial<ProvinceApiSource>): Promise<MutationResult<ProvinceApiSource>> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    if (!input.name?.trim() || !input.api_url?.trim()) return fail('Source name and API URL are required.');
    const row = {
      name: input.name.trim(),
      province: input.province || 'Punjab',
      system_name: input.system_name || '',
      api_url: input.api_url.trim(),
      api_key: input.api_key || null,
      cron_interval: input.cron_interval || 'daily',
      cron_expression: input.cron_expression || null,
      is_active: input.is_active ?? true,
      total_records_pulled: 0,
      created_by: actorRef.current.id,
    };
    const { data: inserted, error } = await supabase.from('province_api_sources').insert(row).select().single();
    if (error || !inserted) return fail(`The API source could not be saved: ${error?.message ?? 'unknown error'}`);
    const created = inserted as unknown as ProvinceApiSource;
    patchState(prev => ({ provinceApiSources: [...prev.provinceApiSources.filter(s => s.id !== created.id), created] }));
    void audit({ action: 'Create API Source', module: 'Province Integrations', record_id: created.id, new_value: `${created.name} (${created.province}) — ${created.api_url}` });
    return ok(created);
  }, [supabase, patchState, audit]);

  const updateProvinceApiSource = useCallback(async (id: string, patch: Partial<ProvinceApiSource>): Promise<MutationResult> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const { id: _id, created_at: _c, created_by: _cb, total_records_pulled: _t, last_sync_at: _l, last_sync_status: _ls, last_sync_records: _lr, last_sync_error: _le, ...rest } = patch as Record<string, unknown>;
    if (!Object.keys(rest).length) return ok();
    const { error } = await supabase.from('province_api_sources').update({ ...rest, updated_at: nowISO() }).eq('id', id);
    if (error) return fail(`The API source could not be updated: ${error.message}`);
    patchState(prev => ({
      provinceApiSources: prev.provinceApiSources.map(s => s.id === id ? { ...s, ...patch, updated_at: nowISO() } : s),
    }));
    void audit({ action: 'Update API Source', module: 'Province Integrations', record_id: id, new_value: JSON.stringify(patch).substring(0, 200) });
    return ok();
  }, [supabase, patchState, audit]);

  const deleteProvinceApiSource = useCallback(async (id: string): Promise<MutationResult> => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const source = dataRef.current.provinceApiSources.find(s => s.id === id);
    const { error } = await supabase.from('province_api_sources').delete().eq('id', id);
    if (error) return fail(`The API source could not be deleted: ${error.message}`);
    patchState(prev => ({
      provinceApiSources: prev.provinceApiSources.filter(s => s.id !== id),
      provinceSyncLogs: prev.provinceSyncLogs.filter(l => l.source_id !== id),
      provinceDataRecords: prev.provinceDataRecords.filter(r => r.source_id !== id),
    }));
    if (source) void audit({ action: 'Delete API Source', module: 'Province Integrations', record_id: id, previous_value: source.name });
    return ok();
  }, [supabase, patchState, audit]);

  const triggerProvinceSync = useCallback(async (sourceId: string): Promise<MutationResult> => {
    // Mark as running optimistically; the API route performs the real HTTP call
    // and persists results — realtime then refetches the true state.
    patchState(prev => ({
      provinceApiSources: prev.provinceApiSources.map(s => s.id === sourceId ? { ...s, last_sync_status: 'running' as SyncStatus } : s),
    }));
    const source = dataRef.current.provinceApiSources.find(s => s.id === sourceId);
    if (source) void audit({ action: 'Trigger Sync', module: 'Province Integrations', record_id: source.id, new_value: `Manual sync requested for ${source.name}` });
    try {
      const response = await fetchWithAuth('/api/province-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      });
      const message = response.ok ? undefined : await readError(response, 'The sync failed');
      await Promise.all([loadProvinceSources(), loadProvinceSyncLogs(), loadProvinceDataRecords()]);
      return message ? fail(message) : ok();
    } catch (err) {
      console.error('[triggerProvinceSync]', err);
      void loadProvinceSources();
      void loadProvinceSyncLogs();
      return fail('The provincial sync service is unavailable.');
    }
  }, [patchState, loadProvinceSources, loadProvinceSyncLogs, loadProvinceDataRecords, audit, fetchWithAuth]);

  const value: DataStoreContextType = {
    isLoaded,
    users: data.users,
    companies: data.companies,
    exportRecords: data.exportRecords,
    complaints: data.complaints,
    masterItems: data.masterItems,
    auditLogs: data.auditLogs,
    notifications: data.notifications,
    provinceApiSources: data.provinceApiSources,
    provinceSyncLogs: data.provinceSyncLogs,
    provinceDataRecords: data.provinceDataRecords,
    addUser, updateUser, deleteUser,
    submitRegistration, reviewRegistration, resubmitRegistration,
    addExportRecord, updateExportRecord, deleteExportRecord, reviewExportRecord,
    addComplaint, updateComplaint, resolveComplaint, escalateComplaint, addComplaintNote,
    addMasterItem, updateMasterItem, deleteMasterItem,
    addProvinceApiSource, updateProvinceApiSource, deleteProvinceApiSource, triggerProvinceSync,
    markAllNotificationsRead, resetData, refresh,
  };

  return <DataStoreContext.Provider value={value}>{children}</DataStoreContext.Provider>;
}
