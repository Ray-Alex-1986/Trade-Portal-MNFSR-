'use client';

import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { User, Company, ExportRecord, Complaint, AuditLog, Notification, UserRole, StageReviewStatus, ProvinceApiSource, ProvinceSyncLog, ProvinceDataRecord, CronInterval, SyncStatus } from './types';
import {
  mockUsers, mockCompanies, mockExportRecords, mockComplaints, mockAuditLogs, mockNotifications,
  PRODUCTS, COUNTRIES, PROVINCES, PORTS, COMPLAINT_CATEGORIES,
  mockProvinceApiSources, mockProvinceSyncLogs, mockProvinceDataRecords,
} from './mock-data';
import { useAuth } from './auth';
import { getReviewStage, hasPermission } from './permissions';
import { DataStoreContext, MasterCategory, ReviewDecision } from './data-store';

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

  useEffect(() => {
    actorRef.current = user
      ? { id: user.id, name: user.full_name, role: user.role }
      : { id: 'system', name: 'System', role: 'super_admin' };
  }, [user]);

  // Hydrate from localStorage (client-only) to avoid SSR mismatches
  useEffect(() => {
    setData(loadData());
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

  /** Apply a mutation and append an audit log entry in a single state update */
  const mutate = useCallback((
    audit: { action: string; module: string; record_id: string; previous_value?: string; new_value?: string } | null,
    updater: (prev: PortalData) => Partial<PortalData>,
  ) => {
    setData(prev => {
      const patch = updater(prev);
      if (audit) {
        const actor = actorRef.current;
        const log: AuditLog = {
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
        return { ...prev, ...patch, auditLogs: [log, ...(patch.auditLogs ?? prev.auditLogs)] };
      }
      return { ...prev, ...patch };
    });
  }, []);

  const notify = (userId: string, title: string, message: string, type: Notification['type'], link?: string): Notification => ({
    id: uid('n'), user_id: userId, title, message, type, is_read: false, link, created_at: nowISO(),
  });

  // ---------- Users ----------
  const addUser = useCallback((input: { full_name: string; email: string; role: string; institution?: string; password?: string }): User => {
    const created: User = {
      id: uid('u'),
      email: input.email,
      full_name: input.full_name,
      role: input.role as UserRole,
      institution: input.institution || undefined,
      is_active: true,
      created_at: nowISO(),
      last_login: undefined,
    };
    mutate(
      { action: 'Create User', module: 'User Management', record_id: created.email, new_value: `${created.full_name} (${created.role})` },
      prev => ({ users: [...prev.users, created] }),
    );
    return created;
  }, [mutate]);

  const updateUser = useCallback((id: string, patch: Partial<User>) => {
    mutate(null, prev => {
      const target = prev.users.find(u => u.id === id);
      if (!target) return {};
      const changed = Object.keys(patch).filter(k => String((target as never)[k]) !== String(patch[k as keyof User]));
      if (changed.length === 0) return {};
      const actor = actorRef.current;
      const log: AuditLog = {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: 'Update User', module: 'User Management', record_id: target.email,
        previous_value: changed.map(k => `${k}: ${(target as never)[k]}`).join(', '),
        new_value: changed.map(k => `${k}: ${patch[k as keyof User]}`).join(', '),
        ip_address: '127.0.0.1', created_at: nowISO(),
      };
      return {
        users: prev.users.map(u => (u.id === id ? { ...u, ...patch } : u)),
        auditLogs: [log, ...prev.auditLogs],
      };
    });
  }, [mutate]);

  const deleteUser = useCallback((id: string) => {
    mutate(null, prev => {
      const target = prev.users.find(u => u.id === id);
      const actor = actorRef.current;
      const log: AuditLog | null = target ? {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: 'Delete User', module: 'User Management', record_id: target.email,
        new_value: target.full_name, ip_address: '127.0.0.1', created_at: nowISO(),
      } : null;
      return {
        users: prev.users.filter(u => u.id !== id),
        auditLogs: log ? [log, ...prev.auditLogs] : prev.auditLogs,
      };
    });
  }, [mutate]);

  // ---------- Registrations (companies) ----------
  const submitRegistration = useCallback((input: {
    company: Partial<Company>;
    representative: { full_name: string; email: string; username: string; password?: string; cnic: string; designation: string; mobile: string };
    registration_number: string;
  }): { user: User; company: Company } => {
    const newUser: User = {
      id: uid('u'),
      email: input.representative.email,
      full_name: input.representative.full_name,
      role: 'exporter',
      is_active: true,
      created_at: nowISO(),
      last_login: undefined,
    };
    const newCompany: Company = {
      id: uid('c'),
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
      email: input.company.email || input.representative.email,
      phone: input.company.phone || input.representative.mobile,
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
    mutate(
      { action: 'Submit Registration', module: 'Registration', record_id: input.registration_number, new_value: `${input.company.legal_name} — ${input.representative.full_name}` },
      prev => ({
        users: [...prev.users, newUser],
        companies: [...prev.companies, newCompany],
        notifications: [
          notify('system', 'New Registration Submitted', `${input.company.legal_name} (${input.registration_number}) has submitted a registration request.`, 'info', '/admin/reviews'),
          ...prev.notifications,
        ],
      }),
    );
    return { user: newUser, company: newCompany };
  }, [mutate]);

  const reviewRegistration = useCallback((id: string, decision: ReviewDecision, remarks?: string) => {
    mutate(null, prev => {
      const company = prev.companies.find(c => c.id === id);
      if (!company) return {};
      const actor = actorRef.current;
      const stage = getReviewStage(actor.role);
      if (!stage) return {}; // role not allowed to review

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
        } else if (stage === 'nafsa') {
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
      const log: AuditLog = {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: actionLabel, module: 'Registration', record_id: company.registration_number,
        previous_value: oldStatus, new_value: newStatus, ip_address: '127.0.0.1', created_at: nowISO(),
      };

      const notifType: Notification['type'] = decision === 'approve' ? 'success' : decision === 'reject' ? 'error' : 'warning';
      let notifTitle: string;
      let notifMsg: string;
      if (decision === 'approve' && stage === 'tdap') {
        notifTitle = 'TDAP Review Passed';
        notifMsg = `Your registration ${company.registration_number} has passed TDAP review and moved to NAFSA review.`;
      } else if (decision === 'approve' && stage === 'nafsa') {
        notifTitle = 'Registration Approved';
        notifMsg = `Your registration ${company.registration_number} (${company.legal_name}) has been fully approved. You are now a verified exporter.`;
      } else if (decision === 'reject') {
        notifTitle = `Registration Rejected (${stageLabel})`;
        notifMsg = `Your registration ${company.registration_number} has been rejected by ${stageLabel}.${remarks ? ` Reason: ${remarks}` : ''}`;
      } else {
        notifTitle = `Additional Information Required (${stageLabel})`;
        notifMsg = `${stageLabel} requires additional information for registration ${company.registration_number}.${remarks ? ` Details: ${remarks}` : ''}`;
      }
      const notification = notify(company.owner_id, notifTitle, notifMsg, notifType, '/dashboard');

      return {
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
        auditLogs: [log, ...prev.auditLogs],
        notifications: [notification, ...prev.notifications],
      };
    });
  }, [mutate]);

  // ---------- Export records ----------
  const addExportRecord = useCallback((input: Partial<ExportRecord>): ExportRecord => {
    let created!: ExportRecord;
    mutate(null, prev => {
      const maxNum = prev.exportRecords.reduce((max, r) => {
        const m = r.consignment_number.match(/(\d+)$/);
        return m ? Math.max(max, Number(m[1])) : max;
      }, 2025000);
      created = {
        id: uid('exp'),
        consignment_number: `EXP-${maxNum + 1}`,
        exporter_id: input.exporter_id || 'u8',
        company_id: input.company_id || 'c1',
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
      const actor = actorRef.current;
      const log: AuditLog = {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: 'Create Record', module: 'Export Records', record_id: created.consignment_number,
        new_value: `${created.product} → ${created.destination_country} (${created.status})`,
        ip_address: '127.0.0.1', created_at: nowISO(),
      };
      const notification = notify(created.exporter_id, 'Export Record Submitted',
        `Your export record ${created.consignment_number} has been submitted and is pending review.`, 'info', '/dashboard/exports');
      return {
        exportRecords: [created, ...prev.exportRecords],
        auditLogs: [log, ...prev.auditLogs],
        notifications: [notification, ...prev.notifications],
      };
    });
    return created;
  }, [mutate]);

  const updateExportRecord = useCallback((id: string, patch: Partial<ExportRecord>) => {
    mutate(null, prev => {
      const record = prev.exportRecords.find(r => r.id === id);
      if (!record) return {};
      const actor = actorRef.current;
      const changed = Object.keys(patch).filter(k => String((record as never)[k]) !== String(patch[k as keyof ExportRecord]));
      const log: AuditLog | null = changed.length ? {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: 'Update Record', module: 'Export Records', record_id: record.consignment_number,
        previous_value: changed.map(k => `${k}: ${(record as never)[k]}`).join(', '),
        new_value: changed.map(k => `${k}: ${patch[k as keyof ExportRecord]}`).join(', '),
        ip_address: '127.0.0.1', created_at: nowISO(),
      } : null;
      const notification = notify(record.exporter_id, 'Export Record Updated',
        `Your export record ${record.consignment_number} has been updated${patch.status === 'submitted' ? ' and resubmitted for review' : ''}.`,
        'info', '/dashboard/exports');
      return {
        exportRecords: prev.exportRecords.map(r => r.id === id ? { ...r, ...patch, updated_at: nowISO() } : r),
        auditLogs: log ? [log, ...prev.auditLogs] : prev.auditLogs,
        notifications: [notification, ...prev.notifications],
      };
    });
  }, [mutate]);

  const deleteExportRecord = useCallback((id: string) => {
    mutate(null, prev => {
      const record = prev.exportRecords.find(r => r.id === id);
      const actor = actorRef.current;
      const log: AuditLog | null = record ? {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: 'Delete Record', module: 'Export Records', record_id: record.consignment_number,
        new_value: `${record.product} → ${record.destination_country}`,
        ip_address: '127.0.0.1', created_at: nowISO(),
      } : null;
      return {
        exportRecords: prev.exportRecords.filter(r => r.id !== id),
        auditLogs: log ? [log, ...prev.auditLogs] : prev.auditLogs,
      };
    });
  }, [mutate]);

  const reviewExportRecord = useCallback((id: string, decision: ReviewDecision, remarks?: string) => {
    mutate(null, prev => {
      const record = prev.exportRecords.find(r => r.id === id);
      if (!record) return {};
      const actor = actorRef.current;
      const stage = getReviewStage(actor.role);
      if (!stage) return {};

      const oldStatus = record.status;
      let newStatus: ExportRecord['status'] = oldStatus;
      let tdapReview = record.tdap_review_status || 'pending';
      let nafsaReview = record.nafsa_review_status || 'not_initiated';

      if (decision === 'approve') {
        if (stage === 'tdap') {
          tdapReview = 'reviewed';
          nafsaReview = 'pending';
          newStatus = 'under_nafsa_review';
        } else if (stage === 'nafsa') {
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
      const log: AuditLog = {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: actionLabel, module: 'Export Records', record_id: record.consignment_number,
        previous_value: oldStatus, new_value: newStatus, ip_address: '127.0.0.1', created_at: nowISO(),
      };

      const notifType: Notification['type'] = decision === 'approve' ? 'success' : decision === 'reject' ? 'error' : 'warning';
      let notifTitle: string;
      let notifMsg: string;
      if (decision === 'approve' && stage === 'tdap') {
        notifTitle = 'TDAP Review Passed';
        notifMsg = `Export record ${record.consignment_number} passed TDAP review and moved to NAFSA review.`;
      } else if (decision === 'approve' && stage === 'nafsa') {
        notifTitle = 'Export Record Approved';
        notifMsg = `Export record ${record.consignment_number} (${record.product}) has been fully approved and is ready for shipment.`;
      } else if (decision === 'reject') {
        notifTitle = `Export Rejected (${stageLabel})`;
        notifMsg = `Export record ${record.consignment_number} has been rejected by ${stageLabel}.${remarks ? ` Reason: ${remarks}` : ''}`;
      } else {
        notifTitle = `Additional Information Required (${stageLabel})`;
        notifMsg = `${stageLabel} requires additional information for export record ${record.consignment_number}.${remarks ? ` Details: ${remarks}` : ''}`;
      }
      const notification = notify(record.exporter_id, notifTitle, notifMsg, notifType, '/dashboard/exports');

      return {
        exportRecords: prev.exportRecords.map(r => r.id === id ? {
          ...r,
          status: newStatus,
          tdap_review_status: tdapReview,
          nafsa_review_status: nafsaReview,
          updated_at: nowISO(),
        } : r),
        auditLogs: [log, ...prev.auditLogs],
        notifications: [notification, ...prev.notifications],
      };
    });
  }, [mutate]);

  // ---------- Complaints ----------
  const addComplaint = useCallback((input: Partial<Complaint> & { tracking_number: string }): Complaint => {
    let created!: Complaint;
    mutate(null, prev => {
      const sla = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      created = {
        id: uid('comp'),
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
        sla_deadline: sla,
        days_pending: 0,
        escalation_level: 0,
        created_at: nowISO(),
        updated_at: nowISO(),
      };
      const actor = actorRef.current;
      const log: AuditLog = {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: 'Create Complaint', module: 'Complaints', record_id: created.tracking_number,
        new_value: `${created.category} — ${created.subject}`,
        ip_address: '127.0.0.1', created_at: nowISO(),
      };
      const notification = notify('u1', 'New Complaint Received',
        `Complaint ${created.tracking_number} submitted by ${created.full_name} (${created.country}).`, 'warning', '/admin/reviews');
      return {
        complaints: [created, ...prev.complaints],
        auditLogs: [log, ...prev.auditLogs],
        notifications: [notification, ...prev.notifications],
      };
    });
    return created;
  }, [mutate]);

  const updateComplaint = useCallback((id: string, patch: Partial<Complaint>) => {
    mutate(null, prev => ({
      complaints: prev.complaints.map(c => c.id === id ? { ...c, ...patch, updated_at: nowISO() } : c),
    }));
  }, [mutate]);

  const resolveComplaint = useCallback((id: string, resolutionSummary: string) => {
    mutate(null, prev => {
      const complaint = prev.complaints.find(c => c.id === id);
      if (!complaint) return {};
      const actor = actorRef.current;
      const log: AuditLog = {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: 'Resolve Complaint', module: 'Complaints', record_id: complaint.tracking_number,
        previous_value: complaint.status, new_value: 'resolved',
        ip_address: '127.0.0.1', created_at: nowISO(),
      };
      const notification = notify('u1', 'Complaint Resolved',
        `Complaint ${complaint.tracking_number} has been resolved.`, 'success', '/admin/reviews');
      return {
        complaints: prev.complaints.map(c => c.id === id ? {
          ...c, status: 'resolved', resolution_summary: resolutionSummary, updated_at: nowISO(),
        } : c),
        auditLogs: [log, ...prev.auditLogs],
        notifications: [notification, ...prev.notifications],
      };
    });
  }, [mutate]);

  const escalateComplaint = useCallback((id: string) => {
    mutate(null, prev => {
      const complaint = prev.complaints.find(c => c.id === id);
      if (!complaint) return {};
      const actor = actorRef.current;
      const log: AuditLog = {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: 'Escalate Complaint', module: 'Complaints', record_id: complaint.tracking_number,
        previous_value: complaint.status, new_value: 'escalated',
        ip_address: '127.0.0.1', created_at: nowISO(),
      };
      const notification = notify('u1', 'Complaint Escalated',
        `Complaint ${complaint.tracking_number} has been escalated to level ${(complaint.escalation_level || 0) + 1}.`, 'warning', '/admin/reviews');
      return {
        complaints: prev.complaints.map(c => c.id === id ? {
          ...c, status: 'escalated', escalation_level: (c.escalation_level || 0) + 1, updated_at: nowISO(),
        } : c),
        auditLogs: [log, ...prev.auditLogs],
        notifications: [notification, ...prev.notifications],
      };
    });
  }, [mutate]);

  const addComplaintNote = useCallback((id: string, note: string) => {
    mutate(null, prev => {
      const complaint = prev.complaints.find(c => c.id === id);
      if (!complaint) return {};
      const actor = actorRef.current;
      const entry = `[${new Date().toLocaleString()}] ${actor.name}: ${note}`;
      const log: AuditLog = {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: 'Add Note', module: 'Complaints', record_id: complaint.tracking_number,
        new_value: note, ip_address: '127.0.0.1', created_at: nowISO(),
      };
      return {
        complaints: prev.complaints.map(c => c.id === id ? {
          ...c,
          internal_notes: c.internal_notes ? `${c.internal_notes}\n${entry}` : entry,
          updated_at: nowISO(),
        } : c),
        auditLogs: [log, ...prev.auditLogs],
      };
    });
  }, [mutate]);

  // ---------- Master data ----------
  const addMasterItem = useCallback((category: MasterCategory, value: string) => {
    mutate(null, prev => {
      const actor = actorRef.current;
      const log: AuditLog = {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: 'Add Master Data Item', module: 'Master Data', record_id: category,
        new_value: value, ip_address: '127.0.0.1', created_at: nowISO(),
      };
      return {
        masterItems: {
          ...prev.masterItems,
          [category]: [...(prev.masterItems[category] || []), value],
        },
        auditLogs: [log, ...prev.auditLogs],
      };
    });
  }, [mutate]);

  const updateMasterItem = useCallback((category: MasterCategory, index: number, value: string) => {
    mutate(null, prev => {
      const actor = actorRef.current;
      const old = prev.masterItems[category]?.[index];
      const log: AuditLog = {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: 'Update Master Data Item', module: 'Master Data', record_id: category,
        previous_value: old, new_value: value, ip_address: '127.0.0.1', created_at: nowISO(),
      };
      return {
        masterItems: {
          ...prev.masterItems,
          [category]: (prev.masterItems[category] || []).map((item, i) => i === index ? value : item),
        },
        auditLogs: [log, ...prev.auditLogs],
      };
    });
  }, [mutate]);

  const deleteMasterItem = useCallback((category: MasterCategory, index: number) => {
    mutate(null, prev => {
      const actor = actorRef.current;
      const old = prev.masterItems[category]?.[index];
      const log: AuditLog = {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: 'Delete Master Data Item', module: 'Master Data', record_id: category,
        previous_value: old, ip_address: '127.0.0.1', created_at: nowISO(),
      };
      return {
        masterItems: {
          ...prev.masterItems,
          [category]: (prev.masterItems[category] || []).filter((_, i) => i !== index),
        },
        auditLogs: [log, ...prev.auditLogs],
      };
    });
  }, [mutate]);

  // ---------- Misc ----------
  const markAllNotificationsRead = useCallback(() => {
    mutate(null, prev => ({
      notifications: prev.notifications.map(n => ({ ...n, is_read: true })),
    }));
  }, [mutate]);

  const resetData = useCallback(() => {
    const seeded = seedData();
    setData(seeded);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    } catch { /* ignore */ }
  }, []);

  // ---------- Province API Sources ----------
  const addProvinceApiSource = useCallback((input: Partial<ProvinceApiSource>): ProvinceApiSource => {
    let created!: ProvinceApiSource;
    mutate(null, prev => {
      created = {
        id: uid('pas'),
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
      const actor = actorRef.current;
      const log: AuditLog = {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: 'Create API Source', module: 'Province Integrations', record_id: created.id,
        new_value: `${created.name} (${created.province}) — ${created.api_url}`,
        ip_address: '127.0.0.1', created_at: nowISO(),
      };
      return {
        provinceApiSources: [...prev.provinceApiSources, created],
        auditLogs: [log, ...prev.auditLogs],
      };
    });
    return created;
  }, [mutate]);

  const updateProvinceApiSource = useCallback((id: string, patch: Partial<ProvinceApiSource>) => {
    mutate(null, prev => {
      const source = prev.provinceApiSources.find(s => s.id === id);
      if (!source) return {};
      const actor = actorRef.current;
      const log: AuditLog = {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: 'Update API Source', module: 'Province Integrations', record_id: source.id,
        new_value: JSON.stringify(patch).substring(0, 200),
        ip_address: '127.0.0.1', created_at: nowISO(),
      };
      return {
        provinceApiSources: prev.provinceApiSources.map(s => s.id === id ? { ...s, ...patch, updated_at: nowISO() } : s),
        auditLogs: [log, ...prev.auditLogs],
      };
    });
  }, [mutate]);

  const deleteProvinceApiSource = useCallback((id: string) => {
    mutate(null, prev => {
      const source = prev.provinceApiSources.find(s => s.id === id);
      const actor = actorRef.current;
      const log: AuditLog | null = source ? {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: 'Delete API Source', module: 'Province Integrations', record_id: source.id,
        previous_value: source.name, ip_address: '127.0.0.1', created_at: nowISO(),
      } : null;
      return {
        provinceApiSources: prev.provinceApiSources.filter(s => s.id !== id),
        provinceSyncLogs: prev.provinceSyncLogs.filter(l => l.source_id !== id),
        provinceDataRecords: prev.provinceDataRecords.filter(r => r.source_id !== id),
        auditLogs: log ? [log, ...prev.auditLogs] : prev.auditLogs,
      };
    });
  }, [mutate]);

  const triggerProvinceSync = useCallback((sourceId: string) => {
    mutate(null, prev => {
      const source = prev.provinceApiSources.find(s => s.id === sourceId);
      if (!source) return {};
      const actor = actorRef.current;

      // Simulate a sync: generate random records and a sync log
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

      // Generate pulled records
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

      const log: AuditLog = {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: 'Trigger Sync', module: 'Province Integrations', record_id: source.id,
        new_value: `${syncLog.records_pulled} records synced (${syncStatus})`,
        ip_address: '127.0.0.1', created_at: nowISO(),
      };

      const notification: Notification = {
        id: uid('n'), user_id: 'u1',
        title: syncStatus === 'success' ? 'Sync Completed' : 'Sync Partially Completed',
        message: `${source.name}: ${syncLog.records_pulled} records pulled from ${source.province} API.`,
        type: syncStatus === 'success' ? 'success' : 'warning',
        is_read: false, link: '/admin/province-integrations', created_at: nowISO(),
      };

      return {
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
        auditLogs: [log, ...prev.auditLogs],
        notifications: [notification, ...prev.notifications],
      };
    });
  }, [mutate]);

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
