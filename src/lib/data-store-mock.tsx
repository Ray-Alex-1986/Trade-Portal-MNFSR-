'use client';

import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { User, Company, ExportRecord, Complaint, AuditLog, Notification, UserRole, StageReviewStatus, ProvinceApiSource, ProvinceSyncLog, ProvinceDataRecord, SyncStatus } from './types';
import {
  mockUsers, mockCompanies, mockExportRecords, mockComplaints, mockAuditLogs, mockNotifications,
  PRODUCTS, COUNTRIES, PROVINCES, PORTS, COMPLAINT_CATEGORIES,
  mockProvinceApiSources, mockProvinceSyncLogs, mockProvinceDataRecords,
} from './mock-data';
import { useAuth } from './auth';
import { resolveReviewStage } from './permissions';
import {
  DataStoreContext, DataStoreContextType, MasterCategory, MutationResult, NewUserInput, RegistrationInput, ReviewDecision,
} from './data-store';
import { clearMockPasswords, removeMockPassword, renameMockPassword, setMockPassword } from './mock-passwords';

const STORAGE_KEY = 'export_portal_data_v3';

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

const DOCUMENT_TYPES = [
  "Buyer's Quality Requirement Sheet", "DDP SPS Certificate", "Pre-Shipment Inspection (PSI) Report",
  "Purchase Order / Export Contract", "Commercial Invoice", "Packing List",
  "Certificate of Origin", "Phytosanitary Certificate", "Laboratory Test Report",
  "Bill of Lading / Airway Bill", "Additional Supporting Documents",
];

const ROLE_ITEMS = ['MNFSR Super Admin', 'MoC Admin', 'TDAP Admin', 'TDAP Officer', 'NAFSA Admin', 'NAFSA Officer', 'Trade & Investment Counsellor', 'Exporter/Trader', 'Buyer/Importer', 'Auditor/Viewer'];
const INSTITUTION_ITEMS = ['MNFSR', 'Ministry of Commerce', 'TDAP', 'NAFSA', 'TIC Beijing', 'TIC Dubai', 'TIC Riyadh', 'TIC London', 'TIC Kuala Lumpur'];

const VALID_ROLES: UserRole[] = ['super_admin', 'moc_admin', 'tdap_admin', 'tdap_officer', 'nafsa_admin', 'nafsa_officer', 'tic', 'exporter', 'buyer', 'auditor'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function seedData(): PortalData {
  return {
    users: mockUsers.map(u => ({ ...u })),
    companies: mockCompanies.map(c => ({ ...c })),
    exportRecords: mockExportRecords.map(r => ({ ...r, documents: [...r.documents] })),
    complaints: mockComplaints.map(c => ({ ...c })),
    masterItems: {
      products: [...PRODUCTS],
      countries: [...COUNTRIES],
      provinces: [...PROVINCES],
      ports: [...PORTS],
      complaint_categories: [...COMPLAINT_CATEGORIES],
      document_types: [...DOCUMENT_TYPES],
      roles: [...ROLE_ITEMS],
      institutions: [...INSTITUTION_ITEMS],
    },
    auditLogs: mockAuditLogs.map(l => ({ ...l })),
    notifications: mockNotifications.map(n => ({ ...n })),
    provinceApiSources: mockProvinceApiSources.map(s => ({ ...s })),
    provinceSyncLogs: mockProvinceSyncLogs.map(l => ({ ...l })),
    provinceDataRecords: mockProvinceDataRecords.map(r => ({ ...r })),
  };
}

function loadData(): PortalData {
  if (typeof window === 'undefined') return seedData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const defaults = seedData();
    if (raw) {
      const parsed = JSON.parse(raw) as PortalData;
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.companies)) {
        // Merge with seed defaults so newly added categories keep working
        return {
          ...defaults,
          ...parsed,
          masterItems: { ...defaults.masterItems, ...parsed.masterItems },
        };
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  } catch {
    return seedData();
  }
}

interface Actor {
  id: string;
  name: string;
  role: UserRole;
}

const EMPTY_MASTER: Record<MasterCategory, string[]> = {
  products: [], countries: [], provinces: [], ports: [],
  complaint_categories: [], document_types: [], roles: [], institutions: [],
};

const nowISO = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const ok = <T,>(data?: T): MutationResult<T> => ({ data });
const fail = <T,>(error: string): MutationResult<T> => ({ error });

const notify = (userId: string, title: string, message: string, type: Notification['type'], link?: string): Notification => ({
  id: uid('n'), user_id: userId, title, message, type, is_read: false, link, created_at: nowISO(),
});

/** One notification per active super admin (the MNFSR review inbox). */
const notifySuperAdmins = (prev: PortalData, title: string, message: string, type: Notification['type'], link?: string): Notification[] =>
  prev.users
    .filter(u => u.role === 'super_admin' && u.is_active)
    .map(u => notify(u.id, title, message, type, link));

/** Original demo-mode provider: seeds from mock-data.ts and persists to localStorage. */
export function MockDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
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

  // Hydrate from localStorage (client-only) to avoid SSR mismatches
  useEffect(() => {
    const loaded = loadData();
    dataRef.current = loaded;
    setData(loaded);
    setIsLoaded(true);
  }, []);

  // Persist on every change once loaded
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* storage full or unavailable */ }
  }, [data, isLoaded]);

  // Cross-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as PortalData;
        if (parsed && Array.isArray(parsed.users)) setData(parsed);
      } catch { /* ignore malformed */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const makeLog = useCallback((audit: { action: string; module: string; record_id: string; previous_value?: string; new_value?: string }): AuditLog => {
    const actor = actorRef.current;
    return {
      id: uid('al'),
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: audit.action,
      module: audit.module,
      record_id: audit.record_id,
      previous_value: audit.previous_value,
      new_value: audit.new_value,
      ip_address: '127.0.0.1',
      created_at: nowISO(),
    };
  }, []);

  /**
   * Apply a mutation synchronously against the latest data and persist it.
   * The updater returns a partial patch; audit entries are prepended when given.
   */
  const mutate = useCallback((
    audit: { action: string; module: string; record_id: string; previous_value?: string; new_value?: string } | null,
    updater: (prev: PortalData) => Partial<PortalData>,
  ) => {
    const prev = dataRef.current;
    const patch = updater(prev);
    const next: PortalData = audit
      ? { ...prev, ...patch, auditLogs: [makeLog(audit), ...(patch.auditLogs ?? prev.auditLogs)] }
      : { ...prev, ...patch };
    dataRef.current = next;
    setData(next);
  }, [makeLog]);

  // ---------- Users ----------
  const addUser = useCallback(async (input: NewUserInput): Promise<MutationResult<User>> => {
    const email = input.email.trim().toLowerCase();
    const fullName = input.full_name.trim();
    if (!fullName || !email) return fail('Full name and email are required.');
    if (!EMAIL_PATTERN.test(email)) return fail('Please enter a valid email address.');
    if (!VALID_ROLES.includes(input.role as UserRole)) return fail('The selected role is invalid.');
    if (dataRef.current.users.some(u => u.email.toLowerCase() === email)) return fail('A user with this email already exists.');
    if (input.password && input.password.length < 8) return fail('Passwords must contain at least 8 characters.');

    const created: User = {
      id: uid('u'),
      email,
      full_name: fullName,
      role: input.role as UserRole,
      institution: input.institution?.trim() || undefined,
      is_active: true,
      created_at: nowISO(),
      last_login: undefined,
    };
    if (input.password) await setMockPassword(email, input.password);
    mutate(
      { action: 'Create User', module: 'User Management', record_id: created.email, new_value: `${created.full_name} (${created.role})` },
      prev => ({ users: [...prev.users, created] }),
    );
    return ok(created);
  }, [mutate]);

  const updateUser = useCallback(async (id: string, patch: Partial<User>): Promise<MutationResult> => {
    const target = dataRef.current.users.find(u => u.id === id);
    if (!target) return fail('User was not found.');
    const actor = actorRef.current;
    if (id === actor.id && patch.is_active === false) return fail('You cannot deactivate your own account.');
    if (patch.email !== undefined) {
      const email = patch.email.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(email)) return fail('Please enter a valid email address.');
      if (dataRef.current.users.some(u => u.id !== id && u.email.toLowerCase() === email)) return fail('Another user with this email already exists.');
      patch = { ...patch, email };
      if (email !== target.email.toLowerCase()) renameMockPassword(target.email, email);
    }
    if (patch.full_name !== undefined && !patch.full_name.trim()) return fail('Full name is required.');
    if (patch.role !== undefined && !VALID_ROLES.includes(patch.role)) return fail('The selected role is invalid.');

    const changed = Object.keys(patch).filter(k => String((target as never)[k] ?? '') !== String(patch[k as keyof User] ?? ''));
    if (changed.length === 0) return ok();
    mutate(
      {
        action: 'Update User', module: 'User Management', record_id: target.email,
        previous_value: changed.map(k => `${k}: ${(target as never)[k] ?? ''}`).join(', '),
        new_value: changed.map(k => `${k}: ${patch[k as keyof User] ?? ''}`).join(', '),
      },
      prev => ({ users: prev.users.map(u => (u.id === id ? { ...u, ...patch } : u)) }),
    );
    return ok();
  }, [mutate]);

  const deleteUser = useCallback(async (id: string): Promise<MutationResult> => {
    const target = dataRef.current.users.find(u => u.id === id);
    if (!target) return fail('User was not found.');
    if (id === actorRef.current.id) return fail('You cannot delete your own account.');
    removeMockPassword(target.email);
    mutate(
      { action: 'Delete User', module: 'User Management', record_id: target.email, new_value: target.full_name },
      prev => ({ users: prev.users.filter(u => u.id !== id) }),
    );
    return ok();
  }, [mutate]);

  // ---------- Registrations (companies) ----------
  const submitRegistration = useCallback(async (input: RegistrationInput): Promise<MutationResult<{ user: User; company: Company }>> => {
    const email = input.representative.email.trim().toLowerCase();
    const fullName = input.representative.full_name.trim();
    if (!fullName || !input.company.legal_name?.trim()) return fail('Representative name and company legal name are required.');
    if (!EMAIL_PATTERN.test(email)) return fail('Please enter a valid email address for the representative.');
    const password = input.representative.password?.trim();
    if (!password || password.length < 8) return fail('Use a password with at least 8 characters.');
    if (dataRef.current.users.some(u => u.email.toLowerCase() === email)) return fail('An account with this email already exists. Please sign in instead.');

    const newUser: User = {
      id: uid('u'),
      email,
      full_name: fullName,
      role: 'exporter',
      is_active: true,
      created_at: nowISO(),
      last_login: undefined,
    };
    const newCompany: Company = {
      id: uid('c'),
      legal_name: input.company.legal_name.trim(),
      trading_name: input.company.trading_name?.trim() || undefined,
      company_type: input.company.company_type || 'Private Limited',
      ntn: input.company.ntn?.trim() || '',
      secp_number: input.company.secp_number?.trim() || '',
      registration_date: input.company.registration_date || nowISO().slice(0, 10),
      address: input.company.address?.trim() || '',
      province: input.company.province || 'Punjab',
      district: input.company.district?.trim() || '',
      city: input.company.city?.trim() || '',
      website: input.company.website?.trim() || undefined,
      email: input.company.email?.trim() || email,
      phone: input.company.phone?.trim() || input.representative.mobile,
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
      owner_id: newUser.id,
    };
    await setMockPassword(email, password);
    mutate(
      { action: 'Submit Registration', module: 'Registration', record_id: input.registration_number, new_value: `${newCompany.legal_name} — ${fullName}` },
      prev => ({
        users: [...prev.users, newUser],
        companies: [...prev.companies, newCompany],
        notifications: [
          ...notifySuperAdmins(prev, 'New Registration Submitted', `${newCompany.legal_name} (${input.registration_number}) has submitted a registration request.`, 'info', '/admin/reviews'),
          notify(newUser.id, 'Registration Received', `Your registration ${input.registration_number} has been received and is awaiting TDAP review.`, 'info', '/dashboard'),
          ...prev.notifications,
        ],
      }),
    );
    return ok({ user: newUser, company: newCompany });
  }, [mutate]);

  const reviewRegistration = useCallback(async (id: string, decision: ReviewDecision, remarks?: string): Promise<MutationResult> => {
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

    const stageLabel = stage === 'tdap' ? 'TDAP' : 'NAFSA';
    const actionLabel = `${decision === 'approve' ? 'Approve' : decision === 'reject' ? 'Reject' : 'Request Info'} (${stageLabel})`;
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

    mutate(
      { action: actionLabel, module: 'Registration', record_id: company.registration_number, previous_value: oldStatus, new_value: remarks ? `${newStatus} — ${remarks}` : newStatus },
      prev => ({
        companies: prev.companies.map(c => c.id === id ? {
          ...c,
          status: newStatus,
          tdap_review_status: tdapReview,
          nafsa_review_status: nafsaReview,
          nadra_status: nadraStatus,
          secp_status: secpStatus,
          ntn_status: ntnStatus,
          updated_at: nowISO(),
        } : c),
        notifications: [notify(company.owner_id, notifTitle, notifMsg, notifType, '/dashboard'), ...prev.notifications],
      }),
    );
    return ok();
  }, [mutate]);

  const resubmitRegistration = useCallback(async (id: string, patch?: Partial<Company>): Promise<MutationResult> => {
    const company = dataRef.current.companies.find(c => c.id === id);
    if (!company) return fail('Registration was not found.');
    const actor = actorRef.current;
    if (company.owner_id !== actor.id && actor.role !== 'super_admin') return fail('Only the company owner can resubmit this registration.');
    if (!['additional_info_required', 'rejected', 'draft'].includes(company.status)) return fail('Only returned or draft registrations can be resubmitted.');
    const { id: _id, owner_id: _owner, status: _status, created_at: _c, ...safePatch } = patch ?? {};
    mutate(
      { action: 'Resubmit Registration', module: 'Registration', record_id: company.registration_number, previous_value: company.status, new_value: 'submitted' },
      prev => ({
        companies: prev.companies.map(c => c.id === id ? {
          ...c,
          ...safePatch,
          status: 'submitted',
          tdap_review_status: 'pending',
          nafsa_review_status: 'not_initiated',
          updated_at: nowISO(),
        } : c),
        notifications: [
          ...notifySuperAdmins(prev, 'Registration Resubmitted', `${company.legal_name} (${company.registration_number}) has resubmitted its registration for review.`, 'info', '/admin/reviews'),
          ...prev.notifications,
        ],
      }),
    );
    return ok();
  }, [mutate]);

  // ---------- Export records ----------
  const addExportRecord = useCallback(async (input: Partial<ExportRecord>): Promise<MutationResult<ExportRecord>> => {
    const actor = actorRef.current;
    const state = dataRef.current;
    if (!input.product?.trim()) return fail('Product is required.');
    const exporterId = input.exporter_id || actor.id;
    const company = state.companies.find(c => c.id === input.company_id) ?? state.companies.find(c => c.owner_id === exporterId && c.status === 'approved');
    if (!company) return fail('An approved company registration is required before adding export records.');
    const maxNum = state.exportRecords.reduce((max, r) => {
      const m = r.consignment_number.match(/(\d+)$/);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 2025000);
    const created: ExportRecord = {
      id: uid('exp'),
      consignment_number: `EXP-${maxNum + 1}`,
      exporter_id: exporterId,
      company_id: company.id,
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
      tdap_review_status: 'pending',
      nafsa_review_status: 'not_initiated',
      documents: (input.documents || []).map(d => ({ ...d, record_id: 'pending' })),
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    created.documents = created.documents.map(d => ({ ...d, record_id: created.id }));
    mutate(
      { action: 'Create Record', module: 'Export Records', record_id: created.consignment_number, new_value: `${created.product} → ${created.destination_country} (${created.status})` },
      prev => ({
        exportRecords: [created, ...prev.exportRecords],
        notifications: [
          notify(created.exporter_id, 'Export Record Submitted', `Your export record ${created.consignment_number} has been submitted and is pending review.`, 'info', '/dashboard/exports'),
          ...notifySuperAdmins(prev, 'New Export Record', `${company.legal_name} submitted ${created.consignment_number} (${created.product} → ${created.destination_country}).`, 'info', '/admin/reviews'),
          ...prev.notifications,
        ],
      }),
    );
    return ok(created);
  }, [mutate]);

  const updateExportRecord = useCallback(async (id: string, patch: Partial<ExportRecord>): Promise<MutationResult> => {
    const record = dataRef.current.exportRecords.find(r => r.id === id);
    if (!record) return fail('Export record was not found.');
    const actor = actorRef.current;
    if (actor.role === 'exporter' && record.exporter_id !== actor.id) return fail('You can only modify your own export records.');
    const changed = Object.keys(patch).filter(k => k !== 'documents' && String((record as never)[k] ?? '') !== String(patch[k as keyof ExportRecord] ?? ''));
    const resubmitted = patch.status === 'submitted' && record.status !== 'submitted';
    mutate(
      changed.length ? {
        action: resubmitted ? 'Resubmit Record' : 'Update Record', module: 'Export Records', record_id: record.consignment_number,
        previous_value: changed.map(k => `${k}: ${(record as never)[k] ?? ''}`).join(', '),
        new_value: changed.map(k => `${k}: ${patch[k as keyof ExportRecord] ?? ''}`).join(', '),
      } : null,
      prev => ({
        exportRecords: prev.exportRecords.map(r => r.id === id ? {
          ...r, ...patch,
          ...(resubmitted ? { tdap_review_status: 'pending', nafsa_review_status: 'not_initiated' } : {}),
          updated_at: nowISO(),
        } : r),
        notifications: [
          notify(record.exporter_id, 'Export Record Updated', `Your export record ${record.consignment_number} has been updated${resubmitted ? ' and resubmitted for review' : ''}.`, 'info', '/dashboard/exports'),
          ...(resubmitted ? notifySuperAdmins(prev, 'Export Record Resubmitted', `${record.consignment_number} has been corrected and resubmitted for review.`, 'info', '/admin/reviews') : []),
          ...prev.notifications,
        ],
      }),
    );
    return ok();
  }, [mutate]);

  const deleteExportRecord = useCallback(async (id: string): Promise<MutationResult> => {
    const record = dataRef.current.exportRecords.find(r => r.id === id);
    if (!record) return fail('Export record was not found.');
    const actor = actorRef.current;
    if (actor.role === 'exporter' && record.exporter_id !== actor.id) return fail('You can only delete your own export records.');
    mutate(
      { action: 'Delete Record', module: 'Export Records', record_id: record.consignment_number, new_value: `${record.product} → ${record.destination_country}` },
      prev => ({ exportRecords: prev.exportRecords.filter(r => r.id !== id) }),
    );
    return ok();
  }, [mutate]);

  const reviewExportRecord = useCallback(async (id: string, decision: ReviewDecision, remarks?: string): Promise<MutationResult> => {
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

    const stageLabel = stage === 'tdap' ? 'TDAP' : 'NAFSA';
    const actionLabel = `${decision === 'approve' ? 'Approve' : decision === 'reject' ? 'Reject' : 'Request Info'} (${stageLabel})`;
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

    mutate(
      { action: actionLabel, module: 'Export Records', record_id: record.consignment_number, previous_value: oldStatus, new_value: remarks ? `${newStatus} — ${remarks}` : newStatus },
      prev => ({
        exportRecords: prev.exportRecords.map(r => r.id === id ? {
          ...r,
          status: newStatus,
          tdap_review_status: tdapReview,
          nafsa_review_status: nafsaReview,
          updated_at: nowISO(),
        } : r),
        notifications: [notify(record.exporter_id, notifTitle, notifMsg, notifType, '/dashboard/exports'), ...prev.notifications],
      }),
    );
    return ok();
  }, [mutate]);

  // ---------- Complaints ----------
  const addComplaint = useCallback(async (input: Partial<Complaint> & { tracking_number: string }): Promise<MutationResult<Complaint>> => {
    if (!input.full_name?.trim() || !input.email?.trim() || !input.subject?.trim() || !input.description?.trim()) {
      return fail('Complete all required complaint fields before submitting.');
    }
    if (dataRef.current.complaints.some(c => c.tracking_number === input.tracking_number)) return fail('This tracking number already exists.');
    const sla = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const created: Complaint = {
      id: uid('comp'),
      tracking_number: input.tracking_number,
      complainant_type: input.complainant_type || 'Buyer',
      full_name: input.full_name.trim(),
      email: input.email.trim().toLowerCase(),
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
      subject: input.subject.trim(),
      description: input.description.trim(),
      incident_date: input.incident_date || '',
      preferred_contact: input.preferred_contact || 'Email',
      priority: input.priority || 'medium',
      status: 'submitted',
      sla_deadline: sla,
      days_pending: 0,
      escalation_level: 0,
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    mutate(
      { action: 'Create Complaint', module: 'Complaints', record_id: created.tracking_number, new_value: `${created.category} — ${created.subject}` },
      prev => ({
        complaints: [created, ...prev.complaints],
        notifications: [
          ...notifySuperAdmins(prev, 'New Complaint Received', `Complaint ${created.tracking_number} submitted by ${created.full_name} (${created.country}).`, 'warning', '/admin/reviews'),
          ...prev.notifications,
        ],
      }),
    );
    return ok(created);
  }, [mutate]);

  const updateComplaint = useCallback(async (id: string, patch: Partial<Complaint>): Promise<MutationResult> => {
    const complaint = dataRef.current.complaints.find(c => c.id === id);
    if (!complaint) return fail('Complaint was not found.');
    mutate(
      { action: 'Update Complaint', module: 'Complaints', record_id: complaint.tracking_number, new_value: JSON.stringify(patch).substring(0, 200) },
      prev => ({ complaints: prev.complaints.map(c => c.id === id ? { ...c, ...patch, updated_at: nowISO() } : c) }),
    );
    return ok();
  }, [mutate]);

  const resolveComplaint = useCallback(async (id: string, resolutionSummary: string): Promise<MutationResult> => {
    const complaint = dataRef.current.complaints.find(c => c.id === id);
    if (!complaint) return fail('Complaint was not found.');
    if (!resolutionSummary.trim()) return fail('A resolution summary is required.');
    const resolvedAt = nowISO();
    mutate(
      { action: 'Resolve Complaint', module: 'Complaints', record_id: complaint.tracking_number, previous_value: complaint.status, new_value: 'resolved' },
      prev => ({
        complaints: prev.complaints.map(c => c.id === id ? {
          ...c, status: 'resolved', resolution_summary: resolutionSummary.trim(), resolved_at: resolvedAt, updated_at: resolvedAt,
        } : c),
        notifications: [
          ...notifySuperAdmins(prev, 'Complaint Resolved', `Complaint ${complaint.tracking_number} has been resolved.`, 'success', '/admin/reviews'),
          ...prev.users.filter(u => u.email.toLowerCase() === complaint.email.toLowerCase()).map(u => notify(u.id, 'Complaint Resolved', `Your complaint ${complaint.tracking_number} has been resolved. ${resolutionSummary.trim()}`, 'success', '/dashboard/complaints')),
          ...prev.notifications,
        ],
      }),
    );
    return ok();
  }, [mutate]);

  const escalateComplaint = useCallback(async (id: string): Promise<MutationResult> => {
    const complaint = dataRef.current.complaints.find(c => c.id === id);
    if (!complaint) return fail('Complaint was not found.');
    const level = (complaint.escalation_level || 0) + 1;
    mutate(
      { action: 'Escalate Complaint', module: 'Complaints', record_id: complaint.tracking_number, previous_value: complaint.status, new_value: `escalated (level ${level})` },
      prev => ({
        complaints: prev.complaints.map(c => c.id === id ? {
          ...c, status: 'escalated', escalation_level: level, updated_at: nowISO(),
        } : c),
        notifications: [
          ...notifySuperAdmins(prev, 'Complaint Escalated', `Complaint ${complaint.tracking_number} has been escalated to level ${level}.`, 'warning', '/admin/reviews'),
          ...prev.notifications,
        ],
      }),
    );
    return ok();
  }, [mutate]);

  const addComplaintNote = useCallback(async (id: string, note: string): Promise<MutationResult> => {
    const complaint = dataRef.current.complaints.find(c => c.id === id);
    if (!complaint) return fail('Complaint was not found.');
    if (!note.trim()) return fail('Enter a note before saving.');
    const actor = actorRef.current;
    const entry = `[${new Date().toLocaleString()}] ${actor.name}: ${note.trim()}`;
    mutate(
      { action: 'Add Note', module: 'Complaints', record_id: complaint.tracking_number, new_value: note.trim() },
      prev => ({
        complaints: prev.complaints.map(c => c.id === id ? {
          ...c,
          internal_notes: c.internal_notes ? `${c.internal_notes}\n${entry}` : entry,
          updated_at: nowISO(),
        } : c),
      }),
    );
    return ok();
  }, [mutate]);

  // ---------- Master data ----------
  const addMasterItem = useCallback(async (category: MasterCategory, value: string): Promise<MutationResult> => {
    const trimmed = value.trim();
    if (!trimmed) return fail('Enter a value.');
    if ((dataRef.current.masterItems[category] || []).some(i => i.toLowerCase() === trimmed.toLowerCase())) return fail('This item already exists in the category.');
    mutate(
      { action: 'Add Master Data Item', module: 'Master Data', record_id: category, new_value: trimmed },
      prev => ({ masterItems: { ...prev.masterItems, [category]: [...(prev.masterItems[category] || []), trimmed] } }),
    );
    return ok();
  }, [mutate]);

  const updateMasterItem = useCallback(async (category: MasterCategory, index: number, value: string): Promise<MutationResult> => {
    const old = dataRef.current.masterItems[category]?.[index];
    if (old === undefined) return fail('Master-data item was not found.');
    const trimmed = value.trim();
    if (!trimmed) return fail('Enter a value.');
    mutate(
      { action: 'Update Master Data Item', module: 'Master Data', record_id: category, previous_value: old, new_value: trimmed },
      prev => ({ masterItems: { ...prev.masterItems, [category]: (prev.masterItems[category] || []).map((item, i) => i === index ? trimmed : item) } }),
    );
    return ok();
  }, [mutate]);

  const deleteMasterItem = useCallback(async (category: MasterCategory, index: number): Promise<MutationResult> => {
    const old = dataRef.current.masterItems[category]?.[index];
    if (old === undefined) return fail('Master-data item was not found.');
    mutate(
      { action: 'Delete Master Data Item', module: 'Master Data', record_id: category, previous_value: old },
      prev => ({ masterItems: { ...prev.masterItems, [category]: (prev.masterItems[category] || []).filter((_, i) => i !== index) } }),
    );
    return ok();
  }, [mutate]);

  // ---------- Misc ----------
  const markAllNotificationsRead = useCallback(async (): Promise<MutationResult> => {
    const actor = actorRef.current;
    mutate(null, prev => ({
      notifications: prev.notifications.map(n => n.user_id === actor.id ? { ...n, is_read: true } : n),
    }));
    return ok();
  }, [mutate]);

  const resetData = useCallback(async (): Promise<MutationResult> => {
    const seeded = seedData();
    dataRef.current = seeded;
    setData(seeded);
    clearMockPasswords();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    } catch { /* ignore */ }
    return ok();
  }, []);

  const refresh = useCallback(async () => {
    const loaded = loadData();
    dataRef.current = loaded;
    setData(loaded);
  }, []);

  // ---------- Province API Sources ----------
  const addProvinceApiSource = useCallback(async (input: Partial<ProvinceApiSource>): Promise<MutationResult<ProvinceApiSource>> => {
    if (!input.name?.trim() || !input.api_url?.trim()) return fail('Source name and API URL are required.');
    const created: ProvinceApiSource = {
      id: uid('pas'),
      name: input.name.trim(),
      province: input.province || 'Punjab',
      system_name: input.system_name || '',
      api_url: input.api_url.trim(),
      api_key: input.api_key,
      cron_interval: input.cron_interval || 'daily',
      cron_expression: input.cron_expression,
      is_active: input.is_active ?? true,
      total_records_pulled: 0,
      created_at: nowISO(),
      updated_at: nowISO(),
      created_by: actorRef.current.id,
    };
    mutate(
      { action: 'Create API Source', module: 'Province Integrations', record_id: created.id, new_value: `${created.name} (${created.province}) — ${created.api_url}` },
      prev => ({ provinceApiSources: [...prev.provinceApiSources, created] }),
    );
    return ok(created);
  }, [mutate]);

  const updateProvinceApiSource = useCallback(async (id: string, patch: Partial<ProvinceApiSource>): Promise<MutationResult> => {
    const source = dataRef.current.provinceApiSources.find(s => s.id === id);
    if (!source) return fail('Province API source was not found.');
    mutate(
      { action: 'Update API Source', module: 'Province Integrations', record_id: source.id, new_value: JSON.stringify(patch).substring(0, 200) },
      prev => ({ provinceApiSources: prev.provinceApiSources.map(s => s.id === id ? { ...s, ...patch, updated_at: nowISO() } : s) }),
    );
    return ok();
  }, [mutate]);

  const deleteProvinceApiSource = useCallback(async (id: string): Promise<MutationResult> => {
    const source = dataRef.current.provinceApiSources.find(s => s.id === id);
    if (!source) return fail('Province API source was not found.');
    mutate(
      { action: 'Delete API Source', module: 'Province Integrations', record_id: source.id, previous_value: source.name },
      prev => ({
        provinceApiSources: prev.provinceApiSources.filter(s => s.id !== id),
        provinceSyncLogs: prev.provinceSyncLogs.filter(l => l.source_id !== id),
        provinceDataRecords: prev.provinceDataRecords.filter(r => r.source_id !== id),
      }),
    );
    return ok();
  }, [mutate]);

  const triggerProvinceSync = useCallback(async (sourceId: string): Promise<MutationResult> => {
    const source = dataRef.current.provinceApiSources.find(s => s.id === sourceId);
    if (!source) return fail('Province API source was not found.');
    if (!source.is_active) return fail('Activate the source before running a sync.');

    // Simulate a sync: generate deterministic-looking records and a sync log
    const syncStart = nowISO();
    const recordCount = Math.floor(Math.random() * 30) + 3;
    const syncDuration = Math.floor(Math.random() * 50000) + 5000;
    const syncStatus: SyncStatus = Math.random() > 0.15 ? 'success' : 'partial';

    const syncLog: ProvinceSyncLog = {
      id: uid('psl'),
      source_id: source.id,
      source_name: source.name,
      province: source.province,
      status: syncStatus,
      records_pulled: syncStatus === 'partial' ? Math.floor(recordCount / 2) : recordCount,
      started_at: syncStart,
      completed_at: new Date(Date.now() + syncDuration).toISOString(),
      duration_ms: syncDuration,
      error_message: syncStatus === 'partial' ? 'Partial sync — some records timed out' : undefined,
      triggered_by: 'manual',
    };

    const newRecords: ProvinceDataRecord[] = Array.from({ length: syncLog.records_pulled }, (_, i) => ({
      id: uid('pdr'),
      source_id: source.id,
      source_name: source.name,
      province: source.province,
      record_type: ['export_permit', 'phyto_certificate', 'quality_inspection', 'trade_license', 'origin_certificate'][i % 5],
      data: {
        reference_number: `REF-${source.province.substring(0, 2).toUpperCase()}-${Date.now()}-${i}`,
        product: ['Basmati Rice', 'Mango (Chaunsa)', 'Kinnow', 'Dates (Aseel)', 'Sesame Seeds'][i % 5],
        quantity: Math.floor(Math.random() * 400) + 10,
        unit: 'Metric Tons',
        exporter_name: `Exporter ${i + 1}`,
        destination: ['China', 'UAE', 'Saudi Arabia', 'UK', 'Malaysia'][i % 5],
        status: 'synced',
        issue_date: new Date().toISOString(),
      },
      external_id: `EXT-${Date.now()}-${i}`,
      synced_at: syncStart,
    }));

    mutate(
      { action: 'Trigger Sync', module: 'Province Integrations', record_id: source.id, new_value: `${syncLog.records_pulled} records synced (${syncStatus})` },
      prev => ({
        provinceApiSources: prev.provinceApiSources.map(s => s.id === sourceId ? {
          ...s,
          last_sync_at: syncStart,
          last_sync_status: syncStatus,
          last_sync_records: syncLog.records_pulled,
          last_sync_error: syncStatus === 'partial' ? 'Partial sync — some records timed out' : undefined,
          total_records_pulled: s.total_records_pulled + syncLog.records_pulled,
          updated_at: nowISO(),
        } : s),
        provinceSyncLogs: [syncLog, ...prev.provinceSyncLogs],
        provinceDataRecords: [...newRecords, ...prev.provinceDataRecords],
        notifications: [
          ...notifySuperAdmins(prev, syncStatus === 'success' ? 'Sync Completed' : 'Sync Partially Completed', `${source.name}: ${syncLog.records_pulled} records pulled from ${source.province} API.`, syncStatus === 'success' ? 'success' : 'warning', '/admin/province-integrations'),
          ...prev.notifications,
        ],
      }),
    );
    return syncStatus === 'partial' ? fail(`Sync completed partially: ${syncLog.records_pulled} records pulled, some records timed out.`) : ok();
  }, [mutate]);

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
