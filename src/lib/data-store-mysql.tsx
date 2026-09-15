'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  AuditLog, Company, Complaint, ExportRecord, Notification, ProvinceApiSource,
  ProvinceDataRecord, ProvinceSyncLog, User, UserRole,
} from './types';
import { useAuth } from './auth';
import {
  DataStoreContext, DataStoreContextType, MasterCategory, ReviewDecision,
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

const emptySnapshot = (): PortalSnapshot => ({
  users: [], companies: [], exportRecords: [], complaints: [],
  masterItems: {
    products: [], countries: [], provinces: [], ports: [], complaint_categories: [],
    document_types: [], roles: [], institutions: [],
  },
  auditLogs: [], notifications: [], provinceApiSources: [], provinceSyncLogs: [], provinceDataRecords: [],
});

function localCompany(input: { company: Partial<Company>; representative: { full_name: string; email: string; mobile: string }; registration_number: string }, ownerId: string): Company {
  const { company, representative } = input;
  return {
    id: localId('company'), owner_id: ownerId, legal_name: company.legal_name || '', trading_name: company.trading_name,
    company_type: company.company_type || 'Private Limited', ntn: company.ntn || '', secp_number: company.secp_number || '',
    registration_date: company.registration_date || nowISO().slice(0, 10), address: company.address || '', province: company.province || 'Punjab',
    district: company.district || '', city: company.city || '', website: company.website, email: company.email || representative.email,
    phone: company.phone || representative.mobile, nature_of_business: company.nature_of_business || 'Agricultural Export',
    main_export_categories: company.main_export_categories || [], registration_number: input.registration_number,
    status: 'submitted', tdap_review_status: 'pending', nafsa_review_status: 'not_initiated',
    nadra_status: 'pending', secp_status: 'pending', ntn_status: 'pending', created_at: nowISO(), updated_at: nowISO(),
  };
}

function localExportRecord(input: Partial<ExportRecord>, actor: User | null, companies: Company[], records: ExportRecord[]): ExportRecord {
  const maxNumber = records.reduce((max, record) => {
    const match = record.consignment_number.match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 2025000);
  const company = companies.find(item => item.owner_id === actor?.id) ?? companies[0];
  return {
    id: localId('export'), consignment_number: `EXP-${maxNumber + 1}`, exporter_id: actor?.id || '', company_id: company?.id || '',
    product: input.product || '', product_category: input.product_category || 'Other Agricultural', hs_code: input.hs_code || '9999.99',
    description: input.description || '', quantity: input.quantity ?? 0, unit: input.unit || 'Metric Tons', estimated_value: input.estimated_value ?? 0,
    currency: input.currency || 'USD', country_of_origin: 'Pakistan', province_of_production: input.province_of_production || 'Punjab',
    district_of_production: input.district_of_production || '', crop_year: input.crop_year, batch_number: input.batch_number || '',
    packaging_type: input.packaging_type || 'Carton Boxes', num_packages: input.num_packages ?? 0,
    intended_shipment_date: input.intended_shipment_date || '', buyer_name: input.buyer_name || '', buyer_company: input.buyer_company || '',
    buyer_country: input.buyer_country || '', buyer_address: input.buyer_address || '', buyer_contact: input.buyer_contact || '',
    buyer_email: input.buyer_email || '', buyer_phone: input.buyer_phone || '', purchase_order: input.purchase_order || '',
    destination_country: input.destination_country || '', destination_port: input.destination_port || '', port_of_departure: input.port_of_departure || 'Karachi Port',
    transport_mode: input.transport_mode || 'Sea', shipping_company: input.shipping_company || '', container_number: input.container_number || '',
    bill_of_lading: input.bill_of_lading || '', expected_departure: input.expected_departure || '', expected_arrival: input.expected_arrival || '',
    status: input.status || 'submitted', tdap_review_status: input.tdap_review_status, nafsa_review_status: input.nafsa_review_status,
    documents: input.documents || [], created_at: nowISO(), updated_at: nowISO(),
  };
}

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

async function responseSnapshot(response: Response): Promise<PortalSnapshot> {
  const body = await response.json().catch(() => ({})) as PortalSnapshot & { error?: string };
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

/** MySQL transport that retains the existing synchronous useDataStore contract. */
export function MySqlDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<PortalSnapshot>(emptySnapshot);
  const [isLoaded, setIsLoaded] = useState(false);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const reload = useCallback(async () => {
    const response = await fetch('/api/mysql/portal', { cache: 'no-store', credentials: 'same-origin' });
    const next = await responseSnapshot(response);
    if (mounted.current) setSnapshot(next);
  }, []);

  const run = useCallback(async (operation: string, payload?: unknown) => {
    const response = await fetch('/api/mysql/portal', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation, payload }),
    });
    const next = await responseSnapshot(response);
    if (mounted.current) setSnapshot(next);
  }, []);

  const dispatch = useCallback((operation: string, payload?: unknown) => {
    void run(operation, payload).catch(error => {
      console.error(`[mysql-data-store:${operation}]`, error);
      void reload().catch(reloadError => console.error('[mysql-data-store:reload]', reloadError));
    });
  }, [reload, run]);

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

  const addUser = useCallback((input: { full_name: string; email: string; role: string; institution?: string; password?: string }): User => {
    const created: User = {
      id: localId('user'), email: input.email, full_name: input.full_name, role: input.role as UserRole,
      institution: input.institution, is_active: true, created_at: nowISO(),
    };
    setSnapshot(previous => ({ ...previous, users: [created, ...previous.users] }));
    dispatch('create_user', input);
    return created;
  }, [dispatch]);

  const updateUser = useCallback((id: string, patch: Partial<User>) => {
    setSnapshot(previous => ({ ...previous, users: previous.users.map(item => item.id === id ? { ...item, ...patch } : item) }));
    dispatch('update_user', { id, ...patch });
  }, [dispatch]);

  const deleteUser = useCallback((id: string) => {
    setSnapshot(previous => ({ ...previous, users: previous.users.filter(item => item.id !== id) }));
    dispatch('delete_user', { id });
  }, [dispatch]);

  const submitRegistration = useCallback((input: {
    company: Partial<Company>;
    representative: { full_name: string; email: string; username: string; password?: string; cnic: string; designation: string; mobile: string };
    registration_number: string;
  }) => {
    const createdUser: User = { id: localId('user'), email: input.representative.email, full_name: input.representative.full_name, role: 'exporter', is_active: true, created_at: nowISO() };
    const createdCompany = localCompany(input, createdUser.id);
    void fetch('/api/mysql/auth/register', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return reload();
    }).catch(error => console.error('[mysql-data-store:register]', error));
    return { user: createdUser, company: createdCompany };
  }, [reload]);

  const reviewRegistration = useCallback((id: string, decision: ReviewDecision, remarks?: string) => {
    dispatch('review_registration', { id, decision, remarks });
  }, [dispatch]);

  const addExportRecord = useCallback((input: Partial<ExportRecord>): ExportRecord => {
    const created = localExportRecord(input, user, snapshot.companies, snapshot.exportRecords);
    setSnapshot(previous => ({ ...previous, exportRecords: [created, ...previous.exportRecords] }));
    dispatch('create_export_record', input);
    return created;
  }, [dispatch, snapshot.companies, snapshot.exportRecords, user]);

  const updateExportRecord = useCallback((id: string, patch: Partial<ExportRecord>) => {
    setSnapshot(previous => ({ ...previous, exportRecords: previous.exportRecords.map(item => item.id === id ? { ...item, ...patch, updated_at: nowISO() } : item) }));
    dispatch('update_export_record', { id, patch });
  }, [dispatch]);

  const deleteExportRecord = useCallback((id: string) => {
    setSnapshot(previous => ({ ...previous, exportRecords: previous.exportRecords.filter(item => item.id !== id) }));
    dispatch('delete_export_record', { id });
  }, [dispatch]);

  const reviewExportRecord = useCallback((id: string, decision: ReviewDecision, remarks?: string) => {
    dispatch('review_export_record', { id, decision, remarks });
  }, [dispatch]);

  const addComplaint = useCallback((input: Partial<Complaint> & { tracking_number: string }): Complaint => {
    const created = localComplaint(input);
    setSnapshot(previous => ({ ...previous, complaints: [created, ...previous.complaints] }));
    void fetch('/api/mysql/complaints', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return reload();
    }).catch(error => {
      console.error('[mysql-data-store:add-complaint]', error);
      setSnapshot(previous => ({ ...previous, complaints: previous.complaints.filter(item => item.id !== created.id) }));
    });
    return created;
  }, [reload]);

  const updateComplaint = useCallback((id: string, patch: Partial<Complaint>) => {
    setSnapshot(previous => ({ ...previous, complaints: previous.complaints.map(item => item.id === id ? { ...item, ...patch, updated_at: nowISO() } : item) }));
    dispatch('update_complaint', { id, patch });
  }, [dispatch]);

  const resolveComplaint = useCallback((id: string, resolutionSummary: string) => {
    dispatch('resolve_complaint', { id, resolution_summary: resolutionSummary });
  }, [dispatch]);

  const escalateComplaint = useCallback((id: string) => {
    dispatch('escalate_complaint', { id });
  }, [dispatch]);

  const addComplaintNote = useCallback((id: string, note: string) => {
    dispatch('add_complaint_note', { id, note });
  }, [dispatch]);

  const addMasterItem = useCallback((category: MasterCategory, value: string) => {
    setSnapshot(previous => ({ ...previous, masterItems: { ...previous.masterItems, [category]: [...previous.masterItems[category], value] } }));
    dispatch('create_master_item', { category, value });
  }, [dispatch]);

  const updateMasterItem = useCallback((category: MasterCategory, index: number, value: string) => {
    const oldValue = snapshot.masterItems[category][index];
    if (oldValue === undefined) return;
    setSnapshot(previous => ({ ...previous, masterItems: { ...previous.masterItems, [category]: previous.masterItems[category].map((item, itemIndex) => itemIndex === index ? value : item) } }));
    dispatch('update_master_item', { category, old_value: oldValue, value });
  }, [dispatch, snapshot.masterItems]);

  const deleteMasterItem = useCallback((category: MasterCategory, index: number) => {
    const oldValue = snapshot.masterItems[category][index];
    if (oldValue === undefined) return;
    setSnapshot(previous => ({ ...previous, masterItems: { ...previous.masterItems, [category]: previous.masterItems[category].filter((_, itemIndex) => itemIndex !== index) } }));
    dispatch('delete_master_item', { category, old_value: oldValue, value: oldValue });
  }, [dispatch, snapshot.masterItems]);

  const addProvinceApiSource = useCallback((input: Partial<ProvinceApiSource>): ProvinceApiSource => {
    const created: ProvinceApiSource = {
      id: localId('source'), name: input.name || 'New API Source', province: input.province || 'Punjab', system_name: input.system_name || '',
      api_url: input.api_url || '', api_key: input.api_key, cron_interval: input.cron_interval || 'daily', cron_expression: input.cron_expression,
      is_active: input.is_active ?? true, total_records_pulled: 0, created_at: nowISO(), updated_at: nowISO(), created_by: user?.id || '',
    };
    setSnapshot(previous => ({ ...previous, provinceApiSources: [...previous.provinceApiSources, created] }));
    dispatch('create_province_source', input);
    return created;
  }, [dispatch, user?.id]);

  const updateProvinceApiSource = useCallback((id: string, patch: Partial<ProvinceApiSource>) => {
    setSnapshot(previous => ({ ...previous, provinceApiSources: previous.provinceApiSources.map(item => item.id === id ? { ...item, ...patch, updated_at: nowISO() } : item) }));
    dispatch('update_province_source', { id, patch });
  }, [dispatch]);

  const deleteProvinceApiSource = useCallback((id: string) => {
    setSnapshot(previous => ({
      ...previous,
      provinceApiSources: previous.provinceApiSources.filter(item => item.id !== id),
      provinceSyncLogs: previous.provinceSyncLogs.filter(item => item.source_id !== id),
      provinceDataRecords: previous.provinceDataRecords.filter(item => item.source_id !== id),
    }));
    dispatch('delete_province_source', { id });
  }, [dispatch]);

  const triggerProvinceSync = useCallback((sourceId: string) => {
    setSnapshot(previous => ({ ...previous, provinceApiSources: previous.provinceApiSources.map(item => item.id === sourceId ? { ...item, last_sync_status: 'running' } : item) }));
    void fetch('/api/mysql/province-sync', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId }),
    }).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return reload();
    }).catch(error => {
      console.error('[mysql-data-store:province-sync]', error);
      void reload().catch(reloadError => console.error('[mysql-data-store:reload]', reloadError));
    });
  }, [reload]);

  const markAllNotificationsRead = useCallback(() => {
    setSnapshot(previous => ({ ...previous, notifications: previous.notifications.map(item => ({ ...item, is_read: true })) }));
    dispatch('mark_notifications_read');
  }, [dispatch]);

  const resetData = useCallback(() => {
    console.warn('[mysql-data-store:reset] Demo reset is unavailable for the MySQL production backend.');
  }, []);

  const value: DataStoreContextType = {
    isLoaded, ...snapshot,
    addUser, updateUser, deleteUser, submitRegistration, reviewRegistration,
    addExportRecord, updateExportRecord, deleteExportRecord, reviewExportRecord,
    addComplaint, updateComplaint, resolveComplaint, escalateComplaint, addComplaintNote,
    addMasterItem, updateMasterItem, deleteMasterItem,
    addProvinceApiSource, updateProvinceApiSource, deleteProvinceApiSource, triggerProvinceSync,
    markAllNotificationsRead, resetData,
  };

  return <DataStoreContext.Provider value={value}>{children}</DataStoreContext.Provider>;
}
