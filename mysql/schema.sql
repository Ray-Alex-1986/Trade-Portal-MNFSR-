-- ============================================================================
-- Trade Portal MySQL 8 schema
-- Apply to an empty MySQL 8.0+ database after approval of the Vercel/Supabase
-- deployment. Authorization is enforced by the Next.js server API; MySQL has
-- no PostgreSQL-style RLS equivalent.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE institutions (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(64) NOT NULL UNIQUE,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roles (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  institution_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_roles_institution FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permissions (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(128) NOT NULL UNIQUE,
  description TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_permissions (
  role_id CHAR(36) NOT NULL,
  permission_id CHAR(36) NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- password_hash is intentionally MySQL-native. Supabase Auth users and hashes
-- are not copied; users set or receive new credentials during cutover.
CREATE TABLE profiles (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  role_id CHAR(36) NOT NULL,
  institution_id CHAR(36) NULL,
  avatar_url TEXT NULL,
  phone VARCHAR(64) NULL,
  designation VARCHAR(255) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  INDEX idx_profiles_role (role_id),
  CONSTRAINT fk_profiles_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_profiles_institution FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE companies (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  legal_name VARCHAR(255) NOT NULL,
  trading_name VARCHAR(255) NULL,
  company_type VARCHAR(128) NOT NULL,
  ntn VARCHAR(128) NOT NULL,
  secp_number VARCHAR(128) NOT NULL,
  registration_date DATE NULL,
  address TEXT NOT NULL,
  province VARCHAR(128) NOT NULL,
  district VARCHAR(128) NOT NULL,
  city VARCHAR(128) NOT NULL,
  website VARCHAR(2048) NULL,
  email VARCHAR(320) NOT NULL,
  phone VARCHAR(64) NOT NULL,
  nature_of_business VARCHAR(255) NULL,
  main_export_categories JSON NOT NULL,
  registration_number VARCHAR(128) NOT NULL UNIQUE,
  status VARCHAR(64) NOT NULL DEFAULT 'draft',
  tdap_review_status VARCHAR(64) NOT NULL DEFAULT 'not_initiated',
  nafsa_review_status VARCHAR(64) NOT NULL DEFAULT 'not_initiated',
  nadra_status VARCHAR(64) NOT NULL DEFAULT 'not_initiated',
  secp_status VARCHAR(64) NOT NULL DEFAULT 'not_initiated',
  ntn_status VARCHAR(64) NOT NULL DEFAULT 'not_initiated',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  mobile_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  INDEX idx_companies_owner (owner_id),
  INDEX idx_companies_status (status),
  CONSTRAINT fk_companies_owner FOREIGN KEY (owner_id) REFERENCES profiles(id),
  CONSTRAINT fk_companies_created_by FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_companies_updated_by FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE export_records (
  id CHAR(36) PRIMARY KEY,
  consignment_number VARCHAR(128) NOT NULL UNIQUE,
  exporter_id CHAR(36) NOT NULL,
  company_id CHAR(36) NOT NULL,
  product VARCHAR(255) NOT NULL,
  product_category VARCHAR(128) NULL,
  hs_code VARCHAR(64) NULL,
  description TEXT NULL,
  quantity DECIMAL(18,3) NULL,
  unit VARCHAR(64) NULL,
  estimated_value DECIMAL(18,2) NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  country_of_origin VARCHAR(128) NOT NULL DEFAULT 'Pakistan',
  province_of_production VARCHAR(128) NULL,
  district_of_production VARCHAR(128) NULL,
  crop_year INT NULL,
  batch_number VARCHAR(128) NULL,
  packaging_type VARCHAR(128) NULL,
  num_packages INT NULL,
  intended_shipment_date DATE NULL,
  buyer_name VARCHAR(255) NULL,
  buyer_company VARCHAR(255) NULL,
  buyer_country VARCHAR(128) NULL,
  buyer_address TEXT NULL,
  buyer_contact VARCHAR(255) NULL,
  buyer_email VARCHAR(320) NULL,
  buyer_phone VARCHAR(64) NULL,
  purchase_order VARCHAR(128) NULL,
  destination_country VARCHAR(128) NULL,
  destination_port VARCHAR(128) NULL,
  port_of_departure VARCHAR(128) NULL,
  transport_mode VARCHAR(64) NULL,
  shipping_company VARCHAR(255) NULL,
  container_number VARCHAR(128) NULL,
  bill_of_lading VARCHAR(128) NULL,
  expected_departure DATE NULL,
  expected_arrival DATE NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'draft',
  tdap_review_status VARCHAR(64) NULL,
  nafsa_review_status VARCHAR(64) NULL,
  tdap_reviewer_id CHAR(36) NULL,
  nafsa_reviewer_id CHAR(36) NULL,
  tdap_review_date DATETIME(3) NULL,
  nafsa_review_date DATETIME(3) NULL,
  tdap_remarks TEXT NULL,
  nafsa_remarks TEXT NULL,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  INDEX idx_exports_exporter (exporter_id),
  INDEX idx_exports_company (company_id),
  INDEX idx_exports_status (status),
  INDEX idx_exports_created (created_at),
  CONSTRAINT fk_exports_exporter FOREIGN KEY (exporter_id) REFERENCES profiles(id),
  CONSTRAINT fk_exports_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_exports_tdap_reviewer FOREIGN KEY (tdap_reviewer_id) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_exports_nafsa_reviewer FOREIGN KEY (nafsa_reviewer_id) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_exports_created_by FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_exports_updated_by FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE documents (
  id CHAR(36) PRIMARY KEY,
  record_id CHAR(36) NOT NULL,
  company_id CHAR(36) NOT NULL,
  document_type VARCHAR(255) NOT NULL,
  file_name VARCHAR(512) NOT NULL,
  file_size INT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT NULL,
  upload_date DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  uploaded_by CHAR(36) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  verification_status VARCHAR(64) NOT NULL DEFAULT 'pending',
  review_remarks TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_documents_record (record_id),
  CONSTRAINT fk_documents_record FOREIGN KEY (record_id) REFERENCES export_records(id) ON DELETE CASCADE,
  CONSTRAINT fk_documents_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_documents_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE complaints (
  id CHAR(36) PRIMARY KEY,
  tracking_number VARCHAR(128) NOT NULL UNIQUE,
  complainant_type VARCHAR(64) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(320) NOT NULL,
  phone VARCHAR(64) NOT NULL,
  company_name VARCHAR(255) NULL,
  country VARCHAR(128) NOT NULL,
  address TEXT NULL,
  tic VARCHAR(255) NULL,
  exporter_company VARCHAR(255) NULL,
  export_registration_number VARCHAR(128) NULL,
  export_record_number VARCHAR(128) NULL,
  product VARCHAR(255) NULL,
  category VARCHAR(128) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  incident_date DATE NULL,
  preferred_contact VARCHAR(64) NOT NULL DEFAULT 'Email',
  priority VARCHAR(32) NOT NULL DEFAULT 'medium',
  status VARCHAR(64) NOT NULL DEFAULT 'submitted',
  sla_deadline DATETIME(3) NULL,
  days_pending INT NOT NULL DEFAULT 0,
  escalation_level INT NOT NULL DEFAULT 0,
  assigned_officer_id CHAR(36) NULL,
  internal_notes TEXT NULL,
  public_response TEXT NULL,
  resolution_summary TEXT NULL,
  satisfaction_rating TINYINT NULL,
  resolved_at DATETIME(3) NULL,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  INDEX idx_complaints_status (status),
  INDEX idx_complaints_created (created_at),
  CONSTRAINT fk_complaints_assigned FOREIGN KEY (assigned_officer_id) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_complaints_created_by FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_complaints_updated_by FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_satisfaction_rating CHECK (satisfaction_rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE complaint_comments (
  id CHAR(36) PRIMARY KEY,
  complaint_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  comment TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_comment_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE complaint_attachments (
  id CHAR(36) PRIMARY KEY,
  complaint_id CHAR(36) NOT NULL,
  file_name VARCHAR(512) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT NULL,
  uploaded_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_attachment_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  CONSTRAINT fk_attachment_user FOREIGN KEY (uploaded_by) REFERENCES profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  link VARCHAR(2048) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_notifications_user (user_id, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL,
  user_name VARCHAR(255) NULL,
  user_role VARCHAR(64) NULL,
  action VARCHAR(255) NOT NULL,
  module VARCHAR(255) NOT NULL,
  record_id VARCHAR(255) NULL,
  previous_value TEXT NULL,
  new_value TEXT NULL,
  ip_address VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE master_data (
  id CHAR(36) PRIMARY KEY,
  category VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(128) NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_master_data_category_name (category, name),
  INDEX idx_master_category_sort (category, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE system_settings (
  id CHAR(36) PRIMARY KEY,
  `key` VARCHAR(128) NOT NULL UNIQUE,
  value TEXT NULL,
  description TEXT NULL,
  updated_by CHAR(36) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_settings_updated_by FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE province_api_sources (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  province VARCHAR(128) NOT NULL,
  system_name VARCHAR(255) NULL,
  api_url VARCHAR(2048) NOT NULL,
  api_key TEXT NULL,
  cron_interval VARCHAR(32) NOT NULL DEFAULT 'daily',
  cron_expression VARCHAR(255) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at DATETIME(3) NULL,
  last_sync_status VARCHAR(32) NULL,
  last_sync_records INT NULL,
  last_sync_error TEXT NULL,
  total_records_pulled INT NOT NULL DEFAULT 0,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_province_sources_created_by FOREIGN KEY (created_by) REFERENCES profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE province_sync_logs (
  id CHAR(36) PRIMARY KEY,
  source_id CHAR(36) NOT NULL,
  source_name VARCHAR(255) NULL,
  province VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL,
  records_pulled INT NOT NULL DEFAULT 0,
  started_at DATETIME(3) NOT NULL,
  completed_at DATETIME(3) NULL,
  duration_ms INT NULL,
  error_message TEXT NULL,
  triggered_by VARCHAR(255) NOT NULL DEFAULT 'manual',
  INDEX idx_sync_logs_source (source_id),
  CONSTRAINT fk_sync_logs_source FOREIGN KEY (source_id) REFERENCES province_api_sources(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE province_data_records (
  id CHAR(36) PRIMARY KEY,
  source_id CHAR(36) NOT NULL,
  source_name VARCHAR(255) NULL,
  province VARCHAR(128) NULL,
  record_type VARCHAR(128) NULL,
  data JSON NOT NULL,
  external_id VARCHAR(255) NULL,
  synced_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_province_records_source (source_id),
  CONSTRAINT fk_province_records_source FOREIGN KEY (source_id) REFERENCES province_api_sources(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO institutions (id, name, code) VALUES
  (UUID(), 'Ministry of National Food Security & Research', 'MNFSR'),
  (UUID(), 'Ministry of Commerce', 'MoC'),
  (UUID(), 'Trade Development Authority of Pakistan', 'TDAP'),
  (UUID(), 'National Agri-trade and Food Safety Authority', 'NAFSA');

INSERT INTO roles (id, name, display_name) VALUES
  (UUID(), 'super_admin', 'MNFSR Super Admin'),
  (UUID(), 'moc_admin', 'MoC Admin'),
  (UUID(), 'tdap_admin', 'TDAP Admin'),
  (UUID(), 'tdap_officer', 'TDAP Officer'),
  (UUID(), 'nafsa_admin', 'NAFSA Admin'),
  (UUID(), 'nafsa_officer', 'NAFSA Officer'),
  (UUID(), 'tic', 'Trade and Investment Counsellor'),
  (UUID(), 'exporter', 'Exporter/Trader'),
  (UUID(), 'buyer', 'Buyer/Importer'),
  (UUID(), 'auditor', 'Auditor/Viewer');
