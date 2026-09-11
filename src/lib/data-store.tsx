'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { User, Company, ExportRecord, Complaint, AuditLog, Notification, UserRole } from './types';
import {
  mockUsers, mockCompanies, mockExportRecords, mockComplaints, mockAuditLogs, mockNotifications,
  PRODUCTS, COUNTRIES, PROVINCES, PORTS, COMPLAINT_CATEGORIES,
} from './mock-data';
import { useAuth } from './auth';

const STORAGE_KEY = 'export_portal_data_v1';

export type MasterCategory =
  | 'products' | 'countries' | 'provinces' | 'ports'
  | 'complaint_categories' | 'document_types' | 'roles' | 'institutions';

export type ReviewDecision = 'approve' | 'reject' | 'request_info';

interface PortalData {
  users: User[];
  companies: Company[];
  exportRecords: ExportRecord[];
  complaints: Complaint[];
  masterItems: Record<MasterCategory, string[]>;
  auditLogs: AuditLog[];
  notifications: Notification[];
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

interface DataStoreContextType {
  isLoaded: boolean;
  users: User[];
  companies: Company[];
  exportRecords: ExportRecord[];
  complaints: Complaint[];
  masterItems: Record<MasterCategory, string[]>;
  auditLogs: AuditLog[];
  notifications: Notification[];
  // Users
  addUser: (input: { full_name: string; email: string; role: string; institution?: string }) => User;
  updateUser: (id: string, patch: Partial<User>) => void;
  deleteUser: (id: string) => void;
  // Registrations
  reviewRegistration: (id: string, decision: ReviewDecision, remarks?: string) => void;
  // Export records
  addExportRecord: (input: Partial<ExportRecord>) => ExportRecord;
  updateExportRecord: (id: string, patch: Partial<ExportRecord>) => void;
  deleteExportRecord: (id: string) => void;
  reviewExportRecord: (id: string, decision: ReviewDecision, remarks?: string) => void;
  // Complaints
  addComplaint: (input: Partial<Complaint> & { tracking_number: string }) => Complaint;
  updateComplaint: (id: string, patch: Partial<Complaint>) => void;
  resolveComplaint: (id: string, resolutionSummary: string) => void;
  escalateComplaint: (id: string) => void;
  addComplaintNote: (id: string, note: string) => void;
  // Master data
  addMasterItem: (category: MasterCategory, value: string) => void;
  updateMasterItem: (category: MasterCategory, index: number, value: string) => void;
  deleteMasterItem: (category: MasterCategory, index: number) => void;
  // Misc
  markAllNotificationsRead: () => void;
  resetData: () => void;
}

const EMPTY_MASTER: Record<MasterCategory, string[]> = {
  products: [], countries: [], provinces: [], ports: [],
  complaint_categories: [], document_types: [], roles: [], institutions: [],
};

const DataStoreContext = createContext<DataStoreContextType>({
  isLoaded: false,
  users: [], companies: [], exportRecords: [], complaints: [],
  masterItems: EMPTY_MASTER, auditLogs: [], notifications: [],
  addUser: () => { throw new Error('DataProvider missing'); },
  updateUser: () => {}, deleteUser: () => {},
  reviewRegistration: () => {},
  addExportRecord: () => { throw new Error('DataProvider missing'); },
  updateExportRecord: () => {}, deleteExportRecord: () => {}, reviewExportRecord: () => {},
  addComplaint: () => { throw new Error('DataProvider missing'); },
  updateComplaint: () => {}, resolveComplaint: () => {}, escalateComplaint: () => {}, addComplaintNote: () => {},
  addMasterItem: () => {}, updateMasterItem: () => {}, deleteMasterItem: () => {},
  markAllNotificationsRead: () => {}, resetData: () => {},
});

const nowISO = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<PortalData>({
    users: [], companies: [], exportRecords: [], complaints: [],
    masterItems: EMPTY_MASTER, auditLogs: [], notifications: [],
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
  const addUser = useCallback((input: { full_name: string; email: string; role: string; institution?: string }): User => {
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
  const reviewRegistration = useCallback((id: string, decision: ReviewDecision, remarks?: string) => {
    mutate(null, prev => {
      const company = prev.companies.find(c => c.id === id);
      if (!company) return {};
      const oldStatus = company.status;
      let newStatus: Company['status'];
      if (decision === 'approve') newStatus = 'approved';
      else if (decision === 'reject') newStatus = 'rejected';
      else newStatus = 'additional_info_required';

      const actor = actorRef.current;
      const actionLabel = decision === 'approve' ? 'Approve Registration' : decision === 'reject' ? 'Reject Registration' : 'Request Info (Registration)';
      const log: AuditLog = {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: actionLabel, module: 'Registration', record_id: company.registration_number,
        previous_value: oldStatus, new_value: newStatus, ip_address: '127.0.0.1', created_at: nowISO(),
      };

      const notifType: Notification['type'] = decision === 'approve' ? 'success' : decision === 'reject' ? 'error' : 'warning';
      const notifTitle = decision === 'approve' ? 'Registration Approved' : decision === 'reject' ? 'Registration Rejected' : 'Additional Information Required';
      const notifMsg = decision === 'approve'
        ? `Your registration ${company.registration_number} (${company.legal_name}) has been approved. You are now a verified exporter.`
        : decision === 'reject'
          ? `Your registration ${company.registration_number} (${company.legal_name}) has been rejected.${remarks ? ` Reason: ${remarks}` : ''}`
          : `Additional information is required for registration ${company.registration_number}.${remarks ? ` Details: ${remarks}` : ''}`;
      const notification = notify(company.owner_id, notifTitle, notifMsg, notifType, '/dashboard');

      return {
        companies: prev.companies.map(c => c.id === id ? {
          ...c,
          status: newStatus,
          nadra_status: decision === 'approve' ? 'verified' : c.nadra_status,
          secp_status: decision === 'approve' ? 'verified' : c.secp_status,
          ntn_status: decision === 'approve' ? 'verified' : c.ntn_status,
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
      const oldStatus = record.status;
      const newStatus: ExportRecord['status'] =
        decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'additional_info_required';
      const actor = actorRef.current;
      const actionLabel = decision === 'approve' ? 'Approve Export Record' : decision === 'reject' ? 'Reject Export Record' : 'Request Info (Export Record)';
      const log: AuditLog = {
        id: uid('al'), user_id: actor.id, user_name: actor.name, user_role: actor.role,
        action: actionLabel, module: 'Export Records', record_id: record.consignment_number,
        previous_value: oldStatus, new_value: newStatus, ip_address: '127.0.0.1', created_at: nowISO(),
      };
      const notifType: Notification['type'] = decision === 'approve' ? 'success' : decision === 'reject' ? 'error' : 'warning';
      const notifTitle = decision === 'approve' ? 'Export Record Approved' : decision === 'reject' ? 'Export Record Rejected' : 'Additional Information Required';
      const notifMsg = decision === 'approve'
        ? `Your export record ${record.consignment_number} (${record.product}) has been approved and is ready for shipment.`
        : decision === 'reject'
          ? `Your export record ${record.consignment_number} (${record.product}) has been rejected.${remarks ? ` Reason: ${remarks}` : ''}`
          : `Additional information is required for export record ${record.consignment_number}.${remarks ? ` Details: ${remarks}` : ''}`;
      const notification = notify(record.exporter_id, notifTitle, notifMsg, notifType, '/dashboard/exports');
      return {
        exportRecords: prev.exportRecords.map(r => r.id === id ? {
          ...r,
          status: newStatus,
          tdap_review_status: decision === 'reject' ? 'rejected' : decision === 'approve' ? 'reviewed' : r.tdap_review_status,
          nafsa_review_status: decision === 'approve' ? 'reviewed' : r.nafsa_review_status,
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

  const value: DataStoreContextType = {
    isLoaded,
    users: data.users,
    companies: data.companies,
    exportRecords: data.exportRecords,
    complaints: data.complaints,
    masterItems: data.masterItems,
    auditLogs: data.auditLogs,
    notifications: data.notifications,
    addUser, updateUser, deleteUser,
    reviewRegistration,
    addExportRecord, updateExportRecord, deleteExportRecord, reviewExportRecord,
    addComplaint, updateComplaint, resolveComplaint, escalateComplaint, addComplaintNote,
    addMasterItem, updateMasterItem, deleteMasterItem,
    markAllNotificationsRead, resetData,
  };

  return <DataStoreContext.Provider value={value}>{children}</DataStoreContext.Provider>;
}

export function useDataStore() {
  return useContext(DataStoreContext);
}
