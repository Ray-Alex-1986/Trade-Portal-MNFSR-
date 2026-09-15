'use client';

import { createContext, useContext, ReactNode } from 'react';
import {
  User, Company, ExportRecord, Complaint, AuditLog, Notification,
  ProvinceApiSource, ProvinceSyncLog, ProvinceDataRecord,
} from './types';
import { usePortalBackend } from './supabase/use-mock';
import { MockDataProvider } from './data-store-mock';
import { MySqlDataProvider } from './data-store-mysql';
import { SupabaseDataProvider } from './data-store-supabase';

export type MasterCategory =
  | 'products' | 'countries' | 'provinces' | 'ports'
  | 'complaint_categories' | 'document_types' | 'roles' | 'institutions';

export type ReviewDecision = 'approve' | 'reject' | 'request_info';

/**
 * Every mutation resolves to a result object instead of throwing so pages can
 * show a precise success or failure message. `error` is set when the change
 * could not be persisted by the active backend.
 */
export interface MutationResult<T = undefined> {
  error?: string;
  data?: T;
}

export interface NewUserInput {
  full_name: string;
  email: string;
  role: string;
  institution?: string;
  password?: string;
}

export interface RegistrationInput {
  company: Partial<Company>;
  representative: {
    full_name: string;
    email: string;
    username: string;
    password?: string;
    cnic: string;
    designation: string;
    mobile: string;
  };
  registration_number: string;
}

export interface DataStoreContextType {
  isLoaded: boolean;
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
  // Users
  addUser: (input: NewUserInput) => Promise<MutationResult<User>>;
  updateUser: (id: string, patch: Partial<User>) => Promise<MutationResult>;
  deleteUser: (id: string) => Promise<MutationResult>;
  // Registrations
  submitRegistration: (input: RegistrationInput) => Promise<MutationResult<{ user: User; company: Company }>>;
  reviewRegistration: (id: string, decision: ReviewDecision, remarks?: string) => Promise<MutationResult>;
  resubmitRegistration: (id: string, patch?: Partial<Company>) => Promise<MutationResult>;
  // Export records
  addExportRecord: (input: Partial<ExportRecord>) => Promise<MutationResult<ExportRecord>>;
  updateExportRecord: (id: string, patch: Partial<ExportRecord>) => Promise<MutationResult>;
  deleteExportRecord: (id: string) => Promise<MutationResult>;
  reviewExportRecord: (id: string, decision: ReviewDecision, remarks?: string) => Promise<MutationResult>;
  // Complaints
  addComplaint: (input: Partial<Complaint> & { tracking_number: string }) => Promise<MutationResult<Complaint>>;
  updateComplaint: (id: string, patch: Partial<Complaint>) => Promise<MutationResult>;
  resolveComplaint: (id: string, resolutionSummary: string) => Promise<MutationResult>;
  escalateComplaint: (id: string) => Promise<MutationResult>;
  addComplaintNote: (id: string, note: string) => Promise<MutationResult>;
  // Master data
  addMasterItem: (category: MasterCategory, value: string) => Promise<MutationResult>;
  updateMasterItem: (category: MasterCategory, index: number, value: string) => Promise<MutationResult>;
  deleteMasterItem: (category: MasterCategory, index: number) => Promise<MutationResult>;
  // Province API integrations
  addProvinceApiSource: (input: Partial<ProvinceApiSource>) => Promise<MutationResult<ProvinceApiSource>>;
  updateProvinceApiSource: (id: string, patch: Partial<ProvinceApiSource>) => Promise<MutationResult>;
  deleteProvinceApiSource: (id: string) => Promise<MutationResult>;
  triggerProvinceSync: (sourceId: string) => Promise<MutationResult>;
  // Misc
  markAllNotificationsRead: () => Promise<MutationResult>;
  resetData: () => Promise<MutationResult>;
  refresh: () => Promise<void>;
}

const EMPTY_MASTER: Record<MasterCategory, string[]> = {
  products: [], countries: [], provinces: [], ports: [],
  complaint_categories: [], document_types: [], roles: [], institutions: [],
};

const missing = (name: string) => async () => ({ error: `${name} called outside DataProvider` });

export const DataStoreContext = createContext<DataStoreContextType>({
  isLoaded: false,
  users: [], companies: [], exportRecords: [], complaints: [],
  masterItems: EMPTY_MASTER, auditLogs: [], notifications: [],
  provinceApiSources: [], provinceSyncLogs: [], provinceDataRecords: [],
  addUser: missing('addUser'), updateUser: missing('updateUser'), deleteUser: missing('deleteUser'),
  submitRegistration: missing('submitRegistration'), reviewRegistration: missing('reviewRegistration'),
  resubmitRegistration: missing('resubmitRegistration'),
  addExportRecord: missing('addExportRecord'), updateExportRecord: missing('updateExportRecord'),
  deleteExportRecord: missing('deleteExportRecord'), reviewExportRecord: missing('reviewExportRecord'),
  addComplaint: missing('addComplaint'), updateComplaint: missing('updateComplaint'),
  resolveComplaint: missing('resolveComplaint'), escalateComplaint: missing('escalateComplaint'),
  addComplaintNote: missing('addComplaintNote'),
  addMasterItem: missing('addMasterItem'), updateMasterItem: missing('updateMasterItem'), deleteMasterItem: missing('deleteMasterItem'),
  addProvinceApiSource: missing('addProvinceApiSource'), updateProvinceApiSource: missing('updateProvinceApiSource'),
  deleteProvinceApiSource: missing('deleteProvinceApiSource'), triggerProvinceSync: missing('triggerProvinceSync'),
  markAllNotificationsRead: missing('markAllNotificationsRead'), resetData: missing('resetData'),
  refresh: async () => {},
});

/**
 * Data provider dispatcher. MockDataProvider keeps the original localStorage
 * demo behaviour; SupabaseDataProvider and MySqlDataProvider talk to their
 * respective server-authorized backends. All expose the same context.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const backend = usePortalBackend();
  if (backend === 'mock') return <MockDataProvider>{children}</MockDataProvider>;
  if (backend === 'mysql') return <MySqlDataProvider>{children}</MySqlDataProvider>;
  return <SupabaseDataProvider>{children}</SupabaseDataProvider>;
}

export function useDataStore() {
  return useContext(DataStoreContext);
}
