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
  addUser: (input: { full_name: string; email: string; role: string; institution?: string; password?: string }) => User;
  updateUser: (id: string, patch: Partial<User>) => void;
  deleteUser: (id: string) => void;
  // Registrations
  submitRegistration: (input: {
    company: Partial<Company>;
    representative: { full_name: string; email: string; username: string; password?: string; cnic: string; designation: string; mobile: string };
    registration_number: string;
  }) => { user: User; company: Company };
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
  // Province API integrations
  addProvinceApiSource: (input: Partial<ProvinceApiSource>) => ProvinceApiSource;
  updateProvinceApiSource: (id: string, patch: Partial<ProvinceApiSource>) => void;
  deleteProvinceApiSource: (id: string) => void;
  triggerProvinceSync: (sourceId: string) => void;
  // Misc
  markAllNotificationsRead: () => void;
  resetData: () => void;
}

const EMPTY_MASTER: Record<MasterCategory, string[]> = {
  products: [], countries: [], provinces: [], ports: [],
  complaint_categories: [], document_types: [], roles: [], institutions: [],
};

const missing = (name: string) => (): never => { throw new Error(`${name} called outside DataProvider`); };

export const DataStoreContext = createContext<DataStoreContextType>({
  isLoaded: false,
  users: [], companies: [], exportRecords: [], complaints: [],
  masterItems: EMPTY_MASTER, auditLogs: [], notifications: [],
  provinceApiSources: [], provinceSyncLogs: [], provinceDataRecords: [],
  addUser: missing('addUser'), updateUser: missing('updateUser'), deleteUser: missing('deleteUser'),
  submitRegistration: missing('submitRegistration'), reviewRegistration: missing('reviewRegistration'),
  addExportRecord: missing('addExportRecord'), updateExportRecord: missing('updateExportRecord'),
  deleteExportRecord: missing('deleteExportRecord'), reviewExportRecord: missing('reviewExportRecord'),
  addComplaint: missing('addComplaint'), updateComplaint: missing('updateComplaint'),
  resolveComplaint: missing('resolveComplaint'), escalateComplaint: missing('escalateComplaint'),
  addComplaintNote: missing('addComplaintNote'),
  addMasterItem: missing('addMasterItem'), updateMasterItem: missing('updateMasterItem'), deleteMasterItem: missing('deleteMasterItem'),
  addProvinceApiSource: missing('addProvinceApiSource'), updateProvinceApiSource: missing('updateProvinceApiSource'),
  deleteProvinceApiSource: missing('deleteProvinceApiSource'), triggerProvinceSync: missing('triggerProvinceSync'),
  markAllNotificationsRead: missing('markAllNotificationsRead'), resetData: missing('resetData'),
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
