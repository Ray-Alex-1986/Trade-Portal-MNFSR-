export type UserRole = 'super_admin' | 'moc_admin' | 'tdap_admin' | 'tdap_officer' | 'nafsa_admin' | 'nafsa_officer' | 'tic' | 'exporter' | 'buyer' | 'auditor';

export type VerificationStatus = 'not_initiated' | 'pending' | 'verified' | 'failed' | 'additional_info_required' | 'rejected';

export type RegistrationStatus = 'draft' | 'submitted' | 'under_tdap_review' | 'under_nafsa_review' | 'additional_info_required' | 'verified' | 'approved' | 'rejected';

export type ExportStatus = 'draft' | 'submitted' | 'under_tdap_review' | 'under_nafsa_review' | 'additional_info_required' | 'verified' | 'approved' | 'rejected' | 'ready_for_shipment' | 'shipped' | 'delivered' | 'closed' | 'cancelled';

export type ComplaintStatus = 'submitted' | 'acknowledged' | 'under_review' | 'assigned' | 'info_required' | 'investigation' | 'escalated' | 'resolved' | 'closed' | 'reopened' | 'rejected';

export type ComplaintPriority = 'low' | 'medium' | 'high' | 'critical';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  institution?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface Company {
  id: string;
  legal_name: string;
  trading_name?: string;
  company_type: string;
  ntn: string;
  secp_number: string;
  registration_date: string;
  address: string;
  province: string;
  district: string;
  city: string;
  website?: string;
  email: string;
  phone: string;
  nature_of_business: string;
  main_export_categories: string[];
  registration_number: string;
  status: RegistrationStatus;
  nadra_status: VerificationStatus;
  secp_status: VerificationStatus;
  ntn_status: VerificationStatus;
  created_at: string;
  updated_at: string;
  owner_id: string;
}

export interface ExportRecord {
  id: string;
  consignment_number: string;
  exporter_id: string;
  company_id: string;
  product: string;
  product_category: string;
  hs_code: string;
  description: string;
  quantity: number;
  unit: string;
  estimated_value: number;
  currency: string;
  country_of_origin: string;
  province_of_production: string;
  district_of_production: string;
  crop_year?: number;
  batch_number: string;
  packaging_type: string;
  num_packages: number;
  intended_shipment_date: string;
  buyer_name: string;
  buyer_company: string;
  buyer_country: string;
  buyer_address: string;
  buyer_contact: string;
  buyer_email: string;
  buyer_phone: string;
  purchase_order: string;
  destination_country: string;
  destination_port: string;
  port_of_departure: string;
  transport_mode: string;
  shipping_company: string;
  container_number: string;
  bill_of_lading: string;
  expected_departure: string;
  expected_arrival: string;
  status: ExportStatus;
  tdap_review_status?: string;
  nafsa_review_status?: string;
  documents: Document[];
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  record_id: string;
  document_type: string;
  file_name: string;
  file_size: number;
  upload_date: string;
  uploaded_by: string;
  version: number;
  verification_status: string;
  review_remarks?: string;
  file_url: string;
}

export interface Complaint {
  id: string;
  tracking_number: string;
  complainant_type: string;
  full_name: string;
  email: string;
  phone: string;
  company_name?: string;
  country: string;
  address?: string;
  tic?: string;
  exporter_company?: string;
  export_registration_number?: string;
  export_record_number?: string;
  product?: string;
  category: string;
  subject: string;
  description: string;
  incident_date: string;
  preferred_contact: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  sla_deadline: string;
  days_pending: number;
  escalation_level: number;
  assigned_officer?: string;
  internal_notes?: string;
  public_response?: string;
  resolution_summary?: string;
  satisfaction_rating?: number;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  link?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  action: string;
  module: string;
  record_id: string;
  previous_value?: string;
  new_value?: string;
  ip_address: string;
  created_at: string;
}

export interface DashboardStats {
  registeredExporters: number;
  activeUsers: number;
  totalConsignments: number;
  totalQuantity: number;
  countriesServed: number;
  pendingVerifications: number;
  complaintsReceived: number;
  complaintsResolved: number;
}

// ---------- Province API Integration ----------

export type CronInterval = 'every_5m' | 'every_15m' | 'every_30m' | 'hourly' | 'every_6h' | 'daily' | 'weekly' | 'custom';

export type SyncStatus = 'idle' | 'running' | 'success' | 'failed' | 'partial';

export interface ProvinceApiSource {
  id: string;
  name: string;
  province: string;
  system_name: string;
  api_url: string;
  api_key?: string;
  cron_interval: CronInterval;
  cron_expression?: string;
  is_active: boolean;
  last_sync_at?: string;
  last_sync_status?: SyncStatus;
  last_sync_records?: number;
  last_sync_error?: string;
  total_records_pulled: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface ProvinceSyncLog {
  id: string;
  source_id: string;
  source_name: string;
  province: string;
  status: SyncStatus;
  records_pulled: number;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  error_message?: string;
  triggered_by: string;
}

export interface ProvinceDataRecord {
  id: string;
  source_id: string;
  source_name: string;
  province: string;
  record_type: string;
  data: Record<string, unknown>;
  external_id?: string;
  synced_at: string;
}
