'use client';

import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  User, Company, ExportRecord, Complaint, AuditLog, Notification,
  UserRole, StageReviewStatus, ProvinceApiSource, ProvinceSyncLog, ProvinceDataRecord,
  SyncStatus,
} from './types';
import { useAuth } from './auth';
import { getReviewStage } from './permissions';
import { getSupabaseBrowserClient } from './supabase/client';
import { subscribeToPortalChanges, PortalTable } from './supabase/realtime';
import { DataStoreContext, MasterCategory, ReviewDecision } from './data-store';

const nowISO = () => new Date().toISOString();
const localId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const nullableDate = (value: string | undefined) => value?.trim() || null;

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
  const grouped: Record<MasterCategory, string[]> = { ...EMPTY_MASTER };
  for (const row of rows) {
    const cat = row.category as MasterCategory;
    if (cat in grouped) grouped[cat].push(row.name);
  }
  return grouped;
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
  const roleIdsRef = useRef<Record<string, string>>({});
  const institutionIdsRef = useRef<Record<string, string>>({});

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
  const loadLookups = useCallback(async () => {
    if (!supabase) return;
    const [{ data: roles }, { data: institutions }] = await Promise.all([
      supabase.from('roles').select('id, name'),
      supabase.from('institutions').select('id, name'),
    ]);
    roleIdsRef.current = Object.fromEntries((roles ?? []).map(r => [r.name as string, r.id as string]));
    institutionIdsRef.current = Object.fromEntries((institutions ?? []).map(i => [i.name as string, i.id as string]));
  }, [supabase]);

  const loadUsers = useCallback(async () => {
    if (!supabase) return;
    const { data: rows, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_active, last_login, created_at, role:roles(name), institution:institutions(name)');
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
    await loadLookups();
    await Promise.all([
      loadUsers(), loadCompanies(), loadExportRecords(), loadComplaints(), loadMasterData(),
      loadAuditLogs(), loadNotifications(), loadProvinceSources(), loadProvinceSyncLogs(),
      loadProvinceDataRecords(),
    ]);
  }, [loadLookups, loadUsers, loadCompanies, loadExportRecords, loadComplaints, loadMasterData,
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
    if (!supabase) return;
    return subscribeToPortalChanges(supabase, (table) => {
      void tableLoaders[table]?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // -------------------------------------------------------------------------
  // Shared write helpers
  // -------------------------------------------------------------------------
  const audit = useCallback((entry: { action: string; module: string; record_id: string; previous_value?: string; new_value?: string }) => {
    if (!supabase) return;
    const actor = actorRef.current;
    supabase.from('audit_logs').insert({
      user_id: actor.id === 'system' ? null : actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: entry.action,
      module: entry.module,
      record_id: entry.record_id,
      previous_value: entry.previous_value,
      new_value: entry.new_value,
      ip_address: '127.0.0.1',
    }).then(({ error }) => logError('audit', error));
  }, [supabase]);

  const notifyUser = useCallback((userId: string, title: string, message: string, type: Notification['type'], link?: string) => {
    if (!supabase || !userId || userId === 'system') return;
    supabase.from('notifications').insert({ user_id: userId, title, message, type, link }).then(({ error }) => logError('notify', error));
  }, [supabase]);

  const notifySuperAdmins = useCallback((title: string, message: string, type: Notification['type'], link?: string) => {
    if (!supabase) return;
    supabase.rpc('notify_super_admins', { p_title: title, p_message: message, p_type: type, p_link: link }).then(({ error }) => logError('notifySuperAdmins', error));
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
  const addUser = useCallback((input: { full_name: string; email: string; role: string; institution?: string; password?: string }): User => {
    const created: User = {
      id: localId('u'),
      email: input.email,
      full_name: input.full_name,
      role: input.role as UserRole,
      institution: input.institution || undefined,
      is_active: true,
      created_at: nowISO(),
      last_login: undefined,
    };
    patchState(prev => ({ users: [...prev.users, created] }));
    // Auth user creation requires the service role — server-side route
    void fetchWithAuth('/api/admin-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(({ user }: { user: User }) => {
        setData(prev => ({
          ...prev,
          users: prev.users.map(u => (u.id === created.id ? { ...user } : u)),
        }));
      })
      .catch(err => {
        console.error('[addUser]', err);
        setData(prev => ({ ...prev, users: prev.users.filter(u => u.id !== created.id) }));
      });
    audit({ action: 'Create User', module: 'User Management', record_id: created.email, new_value: `${created.full_name} (${created.role})` });
    return created;
  }, [patchState, audit, fetchWithAuth]);

  const updateUser = useCallback((id: string, patch: Partial<User>) => {
    patchState(prev => ({ users: prev.users.map(u => (u.id === id ? { ...u, ...patch } : u)) }));
    void fetchWithAuth('/api/admin-users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }).catch(error => {
      console.error('[updateUser]', error);
      void loadUsers();
    });
    audit({
      action: 'Update User', module: 'User Management', record_id: id,
      previous_value: JSON.stringify(patch).substring(0, 200),
    });
  }, [patchState, audit, fetchWithAuth, loadUsers]);

  const deleteUser = useCallback((id: string) => {
    patchState(prev => ({ users: prev.users.filter(u => u.id !== id) }));
    void fetchWithAuth(`/api/admin-users?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); })
      .catch(err => { console.error('[deleteUser]', err); void loadUsers(); });
    audit({ action: 'Delete User', module: 'User Management', record_id: id });
  }, [patchState, audit, loadUsers, fetchWithAuth]);

  // -------------------------------------------------------------------------
  // Registrations
  // -------------------------------------------------------------------------
  const submitRegistration = useCallback((input: {
    company: Partial<Company>;
    representative: { full_name: string; email: string; username: string; password?: string; cnic: string; designation: string; mobile: string };
    registration_number: string;
  }): { user: User; company: Company } => {
    const rep = input.representative;
    const localUser: User = {
      id: localId('u'),
      email: rep.email,
      full_name: rep.full_name,
      role: 'exporter',
      is_active: true,
      created_at: nowISO(),
      last_login: undefined,
    };
    const localCompany: Company = {
      id: localId('c'),
      legal_name: input.company.legal_name || '',
      trading_name: input.company.trading_name || undefined,
      company_type: input.company.company_type || 'Private Limited',
      ntn: input.company.ntn || '',
      secp_number: input.company.secp_number || '',
      registration_date: input.company.registration_date || nowISO(),
      address: input.company.address || '',
      province: input.company.province || 'Punjab',
      district: input.company.district || '',
      city: input.company.city || '',
      website: input.company.website || undefined,
      email: input.company.email || rep.email,
      phone: input.company.phone || rep.mobile,
      nature_of_business: input.company.nature_of_business || 'Agricultural Export',
      main_export_categories: input.company.main_export_categories || [],
      registration_number: input.registration_number,
      status: 'submitted',
      tdap_review_status: 'pending' as StageReviewStatus,
      nafsa_review_status: 'not_initiated' as StageReviewStatus,
      nadra_status: 'pending',
      secp_status: 'pending',
      ntn_status: 'pending',
      created_at: nowISO(),
      updated_at: nowISO(),
      owner_id: localUser.id,
    };
    // The full flow is async (signUp → profile → company → notify → signOut)
    // and is shared with the register page via registerExporter().
    void import('./registration').then(({ registerExporter }) =>
      registerExporter(input).then(({ error }) => {
        if (error) console.error('[submitRegistration]', error);
      }),
    );
    return { user: localUser, company: localCompany };
  }, []);

  const reviewRegistration = useCallback((id: string, decision: ReviewDecision, remarks?: string) => {
    const company = data.companies.find(c => c.id === id);
    if (!company) return;
    const actor = actorRef.current;
    const stage = getReviewStage(actor.role);
    if (!stage) return;

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

    patchState(prev => ({
      companies: prev.companies.map(c => c.id === id ? {
        ...c, status: newStatus, tdap_review_status: tdapReview, nafsa_review_status: nafsaReview,
        nadra_status: nadraStatus, secp_status: secpStatus, ntn_status: ntnStatus, updated_at: nowISO(),
      } : c),
    }));

    if (supabase) {
      supabase.from('companies').update({
        status: newStatus,
        tdap_review_status: tdapReview,
        nafsa_review_status: nafsaReview,
        nadra_status: nadraStatus,
        secp_status: secpStatus,
        ntn_status: ntnStatus,
        updated_at: nowISO(),
      }).eq('id', id).then(({ error }) => logError('reviewRegistration', error));
    }

    const stageLabel = stage === 'tdap' ? 'TDAP' : 'NAFSA';
    audit({
      action: `${decision === 'approve' ? 'Approve' : decision === 'reject' ? 'Reject' : 'Request Info'} (${stageLabel})`,
      module: 'Registration', record_id: company.registration_number,
      previous_value: oldStatus, new_value: newStatus,
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
    notifyUser(company.owner_id, notifTitle, notifMsg, notifType, '/dashboard');
  }, [data.companies, supabase, patchState, audit, notifyUser]);

  // -------------------------------------------------------------------------
  // Export records
  // -------------------------------------------------------------------------
  const addExportRecord = useCallback((input: Partial<ExportRecord>): ExportRecord => {
    const actor = actorRef.current;
    const state = dataRef.current;
    const maxNum = state.exportRecords.reduce((max, r) => {
      const m = r.consignment_number.match(/(\d+)$/);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 2025000);
    const myCompany = state.companies.find(c => c.owner_id === actor.id) ?? state.companies[0];
    const created: ExportRecord = {
      id: localId('exp'),
      consignment_number: `EXP-${maxNum + 1}`,
      exporter_id: actor.id,
      company_id: myCompany?.id ?? '',
      product: input.product || '',
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
      crop_year: input.crop_year,
      batch_number: input.batch_number || '',
      packaging_type: input.packaging_type || 'Carton Boxes',
      num_packages: input.num_packages ?? 0,
      intended_shipment_date: input.intended_shipment_date || '',
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
      expected_departure: input.expected_departure || '',
      expected_arrival: input.expected_arrival || '',
      status: input.status || 'submitted',
      documents: input.documents || [],
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    patchState(prev => ({ exportRecords: [created, ...prev.exportRecords] }));

    if (supabase) {
      void (async () => {
        const {
          id: _temporaryId,
          documents,
          created_at: _createdAt,
          updated_at: _updatedAt,
          ...row
        } = created;
        const { data: inserted, error } = await supabase
          .from('export_records')
          .insert({
            ...row,
            exporter_id: actor.id,
            intended_shipment_date: nullableDate(row.intended_shipment_date),
            expected_departure: nullableDate(row.expected_departure),
            expected_arrival: nullableDate(row.expected_arrival),
          })
          .select()
          .single();

        if (error || !inserted) {
          console.error('[addExportRecord]', error?.message ?? 'The export record was not created.');
          setData(prev => ({ ...prev, exportRecords: prev.exportRecords.filter(record => record.id !== created.id) }));
          return;
        }

        const persistedRecord: ExportRecord = {
          ...(inserted as unknown as ExportRecord),
          documents: [],
        };
        let persistedDocuments: ExportRecord['documents'] = [];

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
          if (documentsError) {
            console.error('[addExportRecord:documents]', documentsError.message);
          } else {
            persistedDocuments = (documentRows ?? []) as ExportRecord['documents'];
          }
        }

        setData(prev => ({
          ...prev,
          exportRecords: prev.exportRecords.map(record => record.id === created.id
            ? { ...persistedRecord, documents: persistedDocuments }
            : record),
        }));
        audit({
          action: 'Create Record',
          module: 'Export Records',
          record_id: persistedRecord.consignment_number,
          new_value: `${persistedRecord.product} → ${persistedRecord.destination_country} (${persistedRecord.status})`,
        });
        notifyUser(actor.id, 'Export Record Submitted', `Your export record ${persistedRecord.consignment_number} has been submitted and is pending review.`, 'info', '/dashboard/exports');
      })();
    }

    return created;
  }, [supabase, patchState, audit, notifyUser]);

  const updateExportRecord = useCallback((id: string, patch: Partial<ExportRecord>) => {
    patchState(prev => ({
      exportRecords: prev.exportRecords.map(r => r.id === id ? { ...r, ...patch, updated_at: nowISO() } : r),
    }));
    if (!supabase) return;
    const { documents: _docs, id: _id, ...rest } = patch;
    if (Object.keys(rest).length) {
      supabase.from('export_records').update({ ...rest, updated_at: nowISO() }).eq('id', id)
        .then(({ error }) => logError('updateExportRecord', error));
    }
    const record = data.exportRecords.find(r => r.id === id);
    if (record) {
      audit({ action: 'Update Record', module: 'Export Records', record_id: record.consignment_number, new_value: JSON.stringify(patch).substring(0, 200) });
      notifyUser(record.exporter_id, 'Export Record Updated', `Your export record ${record.consignment_number} has been updated${patch.status === 'submitted' ? ' and resubmitted for review' : ''}.`, 'info', '/dashboard/exports');
    }
  }, [supabase, patchState, audit, notifyUser, data.exportRecords]);

  const deleteExportRecord = useCallback((id: string) => {
    const record = data.exportRecords.find(r => r.id === id);
    patchState(prev => ({ exportRecords: prev.exportRecords.filter(r => r.id !== id) }));
    if (!supabase) return;
    supabase.from('export_records').delete().eq('id', id).then(({ error }) => logError('deleteExportRecord', error));
    if (record) audit({ action: 'Delete Record', module: 'Export Records', record_id: record.consignment_number, new_value: `${record.product} → ${record.destination_country}` });
  }, [supabase, patchState, audit, data.exportRecords]);

  const reviewExportRecord = useCallback((id: string, decision: ReviewDecision, remarks?: string) => {
    const record = data.exportRecords.find(r => r.id === id);
    if (!record) return;
    const actor = actorRef.current;
    const stage = getReviewStage(actor.role);
    if (!stage) return;

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

    patchState(prev => ({
      exportRecords: prev.exportRecords.map(r => r.id === id ? {
        ...r, status: newStatus, tdap_review_status: tdapReview, nafsa_review_status: nafsaReview, updated_at: nowISO(),
      } : r),
    }));

    if (supabase) {
      const reviewerField = stage === 'tdap' ? 'tdap_reviewer_id' : 'nafsa_reviewer_id';
      const reviewDateField = stage === 'tdap' ? 'tdap_review_date' : 'nafsa_review_date';
      const remarksField = stage === 'tdap' ? 'tdap_remarks' : 'nafsa_remarks';
      supabase.from('export_records').update({
        status: newStatus,
        tdap_review_status: tdapReview,
        nafsa_review_status: nafsaReview,
        [reviewerField]: actor.id,
        [reviewDateField]: nowISO(),
        ...(remarks ? { [remarksField]: remarks } : {}),
        updated_at: nowISO(),
      }).eq('id', id).then(({ error }) => logError('reviewExportRecord', error));
    }

    const stageLabel = stage === 'tdap' ? 'TDAP' : 'NAFSA';
    audit({
      action: `${decision === 'approve' ? 'Approve' : decision === 'reject' ? 'Reject' : 'Request Info'} (${stageLabel})`,
      module: 'Export Records', record_id: record.consignment_number,
      previous_value: oldStatus, new_value: newStatus,
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
    notifyUser(record.exporter_id, notifTitle, notifMsg, notifType, '/dashboard/exports');
  }, [data.exportRecords, supabase, patchState, audit, notifyUser]);

  // -------------------------------------------------------------------------
  // Complaints
  // -------------------------------------------------------------------------
  const addComplaint = useCallback((input: Partial<Complaint> & { tracking_number: string }): Complaint => {
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
    patchState(prev => ({ complaints: [created, ...prev.complaints] }));
    if (supabase) {
      // RPC inserts the complaint + super-admin notification + audit log atomically
      supabase.rpc('submit_public_complaint', {
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
      }).then(({ error }) => {
        if (error) {
          console.error('[addComplaint]', error.message);
          setData(prev => ({ ...prev, complaints: prev.complaints.filter(c => c.id !== created.id) }));
        }
      });
    }
    return created;
  }, [supabase, patchState]);

  const updateComplaint = useCallback((id: string, patch: Partial<Complaint>) => {
    patchState(prev => ({
      complaints: prev.complaints.map(c => c.id === id ? { ...c, ...patch, updated_at: nowISO() } : c),
    }));
    if (!supabase) return;
    const { id: _id, ...rest } = patch;
    if (Object.keys(rest).length) {
      supabase.from('complaints').update({ ...rest, updated_at: nowISO() }).eq('id', id)
        .then(({ error }) => logError('updateComplaint', error));
    }
  }, [supabase, patchState]);

  const resolveComplaint = useCallback((id: string, resolutionSummary: string) => {
    const complaint = data.complaints.find(c => c.id === id);
    if (!complaint) return;
    const resolvedAt = nowISO();
    patchState(prev => ({
      complaints: prev.complaints.map(c => c.id === id ? {
        ...c, status: 'resolved', resolution_summary: resolutionSummary, resolved_at: resolvedAt, updated_at: resolvedAt,
      } : c),
    }));
    if (supabase) {
      supabase.from('complaints').update({
        status: 'resolved', resolution_summary: resolutionSummary, resolved_at: resolvedAt, updated_at: resolvedAt,
      }).eq('id', id).then(({ error }) => logError('resolveComplaint', error));
    }
    audit({ action: 'Resolve Complaint', module: 'Complaints', record_id: complaint.tracking_number, previous_value: complaint.status, new_value: 'resolved' });
    notifySuperAdmins('Complaint Resolved', `Complaint ${complaint.tracking_number} has been resolved.`, 'success', '/admin/reviews');
  }, [data.complaints, supabase, patchState, audit, notifySuperAdmins]);

  const escalateComplaint = useCallback((id: string) => {
    const complaint = data.complaints.find(c => c.id === id);
    if (!complaint) return;
    const newLevel = (complaint.escalation_level || 0) + 1;
    patchState(prev => ({
      complaints: prev.complaints.map(c => c.id === id ? {
        ...c, status: 'escalated', escalation_level: newLevel, updated_at: nowISO(),
      } : c),
    }));
    if (supabase) {
      supabase.from('complaints').update({ status: 'escalated', escalation_level: newLevel, updated_at: nowISO() })
        .eq('id', id).then(({ error }) => logError('escalateComplaint', error));
    }
    audit({ action: 'Escalate Complaint', module: 'Complaints', record_id: complaint.tracking_number, previous_value: complaint.status, new_value: 'escalated' });
    notifySuperAdmins('Complaint Escalated', `Complaint ${complaint.tracking_number} has been escalated to level ${newLevel}.`, 'warning', '/admin/reviews');
  }, [data.complaints, supabase, patchState, audit, notifySuperAdmins]);

  const addComplaintNote = useCallback((id: string, note: string) => {
    const complaint = data.complaints.find(c => c.id === id);
    if (!complaint) return;
    const actor = actorRef.current;
    const entry = `[${new Date().toLocaleString()}] ${actor.name}: ${note}`;
    const newNotes = complaint.internal_notes ? `${complaint.internal_notes}\n${entry}` : entry;
    patchState(prev => ({
      complaints: prev.complaints.map(c => c.id === id ? { ...c, internal_notes: newNotes, updated_at: nowISO() } : c),
    }));
    if (supabase) {
      supabase.from('complaints').update({ internal_notes: newNotes, updated_at: nowISO() })
        .eq('id', id).then(({ error }) => logError('addComplaintNote', error));
    }
    audit({ action: 'Add Note', module: 'Complaints', record_id: complaint.tracking_number, new_value: note });
  }, [data.complaints, supabase, patchState, audit]);

  // -------------------------------------------------------------------------
  // Master data
  // -------------------------------------------------------------------------
  const addMasterItem = useCallback((category: MasterCategory, value: string) => {
    patchState(prev => ({ masterItems: { ...prev.masterItems, [category]: [...(prev.masterItems[category] || []), value] } }));
    if (supabase) {
      supabase.from('master_data').insert({ category, name: value }).then(({ error }) => logError('addMasterItem', error));
    }
    audit({ action: 'Add Master Data Item', module: 'Master Data', record_id: category, new_value: value });
  }, [supabase, patchState, audit]);

  const updateMasterItem = useCallback((category: MasterCategory, index: number, value: string) => {
    const old = data.masterItems[category]?.[index];
    if (old === undefined) return;
    patchState(prev => ({
      masterItems: { ...prev.masterItems, [category]: (prev.masterItems[category] || []).map((item, i) => i === index ? value : item) },
    }));
    if (supabase) {
      supabase.from('master_data').update({ name: value }).eq('category', category).eq('name', old)
        .then(({ error }) => logError('updateMasterItem', error));
    }
    audit({ action: 'Update Master Data Item', module: 'Master Data', record_id: category, previous_value: old, new_value: value });
  }, [data.masterItems, supabase, patchState, audit]);

  const deleteMasterItem = useCallback((category: MasterCategory, index: number) => {
    const old = data.masterItems[category]?.[index];
    if (old === undefined) return;
    patchState(prev => ({
      masterItems: { ...prev.masterItems, [category]: (prev.masterItems[category] || []).filter((_, i) => i !== index) },
    }));
    if (supabase) {
      supabase.from('master_data').delete().eq('category', category).eq('name', old)
        .then(({ error }) => logError('deleteMasterItem', error));
    }
    audit({ action: 'Delete Master Data Item', module: 'Master Data', record_id: category, previous_value: old });
  }, [data.masterItems, supabase, patchState, audit]);

  // -------------------------------------------------------------------------
  // Misc
  // -------------------------------------------------------------------------
  const markAllNotificationsRead = useCallback(() => {
    const ids = data.notifications.filter(n => !n.is_read).map(n => n.id);
    patchState(prev => ({ notifications: prev.notifications.map(n => ({ ...n, is_read: true })) }));
    if (supabase && ids.length) {
      supabase.from('notifications').update({ is_read: true }).in('id', ids)
        .then(({ error }) => logError('markAllNotificationsRead', error));
    }
  }, [data.notifications, supabase, patchState]);

  const resetData = useCallback(() => {
    void (async () => {
      try {
        const res = await fetchWithAuth('/api/reset-demo', { method: 'POST' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await loadAll();
      } catch (err) {
        console.error('[resetData]', err);
      }
    })();
  }, [loadAll, fetchWithAuth]);

  // -------------------------------------------------------------------------
  // Province API sources
  // -------------------------------------------------------------------------
  const addProvinceApiSource = useCallback((input: Partial<ProvinceApiSource>): ProvinceApiSource => {
    const created: ProvinceApiSource = {
      id: localId('pas'),
      name: input.name || 'New API Source',
      province: input.province || 'Punjab',
      system_name: input.system_name || '',
      api_url: input.api_url || '',
      api_key: input.api_key,
      cron_interval: input.cron_interval || 'daily',
      cron_expression: input.cron_expression,
      is_active: input.is_active ?? true,
      total_records_pulled: 0,
      created_at: nowISO(),
      updated_at: nowISO(),
      created_by: actorRef.current.id,
    };
    patchState(prev => ({ provinceApiSources: [...prev.provinceApiSources, created] }));
    if (supabase) {
      const { id: _id, last_sync_at: _l, last_sync_status: _ls, last_sync_records: _lr, last_sync_error: _le, ...row } = created as unknown as Record<string, unknown>;
      supabase.from('province_api_sources').insert(row).then(({ error }) => {
        if (error) {
          console.error('[addProvinceApiSource]', error.message);
          setData(prev => ({ ...prev, provinceApiSources: prev.provinceApiSources.filter(s => s.id !== created.id) }));
        }
      });
    }
    audit({ action: 'Create API Source', module: 'Province Integrations', record_id: created.id, new_value: `${created.name} (${created.province}) — ${created.api_url}` });
    return created;
  }, [supabase, patchState, audit]);

  const updateProvinceApiSource = useCallback((id: string, patch: Partial<ProvinceApiSource>) => {
    patchState(prev => ({
      provinceApiSources: prev.provinceApiSources.map(s => s.id === id ? { ...s, ...patch, updated_at: nowISO() } : s),
    }));
    if (!supabase) return;
    const { id: _id, created_at: _c, created_by: _cb, total_records_pulled: _t, last_sync_at: _l, last_sync_status: _ls, last_sync_records: _lr, last_sync_error: _le, ...rest } = patch as Record<string, unknown>;
    if (Object.keys(rest).length) {
      supabase.from('province_api_sources').update({ ...rest, updated_at: nowISO() }).eq('id', id)
        .then(({ error }) => logError('updateProvinceApiSource', error));
    }
    audit({ action: 'Update API Source', module: 'Province Integrations', record_id: id, new_value: JSON.stringify(patch).substring(0, 200) });
  }, [supabase, patchState, audit]);

  const deleteProvinceApiSource = useCallback((id: string) => {
    const source = data.provinceApiSources.find(s => s.id === id);
    patchState(prev => ({
      provinceApiSources: prev.provinceApiSources.filter(s => s.id !== id),
      provinceSyncLogs: prev.provinceSyncLogs.filter(l => l.source_id !== id),
      provinceDataRecords: prev.provinceDataRecords.filter(r => r.source_id !== id),
    }));
    if (supabase) {
      supabase.from('province_api_sources').delete().eq('id', id).then(({ error }) => logError('deleteProvinceApiSource', error));
    }
    if (source) audit({ action: 'Delete API Source', module: 'Province Integrations', record_id: id, previous_value: source.name });
  }, [data.provinceApiSources, supabase, patchState, audit]);

  const triggerProvinceSync = useCallback((sourceId: string) => {
    // Mark as running optimistically; the API route performs the real HTTP call
    // and persists results — realtime then refetches the true state.
    patchState(prev => ({
      provinceApiSources: prev.provinceApiSources.map(s => s.id === sourceId ? { ...s, last_sync_status: 'running' as SyncStatus } : s),
    }));
    void fetchWithAuth('/api/province-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId }),
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); })
      .catch(err => {
        console.error('[triggerProvinceSync]', err);
        void loadProvinceSources();
        void loadProvinceSyncLogs();
      });
    const source = data.provinceApiSources.find(s => s.id === sourceId);
    if (source) audit({ action: 'Trigger Sync', module: 'Province Integrations', record_id: source.id, new_value: `Manual sync requested for ${source.name}` });
  }, [data.provinceApiSources, patchState, loadProvinceSources, loadProvinceSyncLogs, audit, fetchWithAuth]);

  // -------------------------------------------------------------------------
  // Keep a live ref of `data` for use inside callbacks that read current state
  // -------------------------------------------------------------------------
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  const value = {
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
    submitRegistration, reviewRegistration,
    addExportRecord, updateExportRecord, deleteExportRecord, reviewExportRecord,
    addComplaint, updateComplaint, resolveComplaint, escalateComplaint, addComplaintNote,
    addMasterItem, updateMasterItem, deleteMasterItem,
    addProvinceApiSource, updateProvinceApiSource, deleteProvinceApiSource, triggerProvinceSync,
    markAllNotificationsRead, resetData,
  };

  return <DataStoreContext.Provider value={value}>{children}</DataStoreContext.Provider>;
}
