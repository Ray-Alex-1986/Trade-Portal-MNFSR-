-- National Export Registration, Certification & Complaint Management Portal
-- Supabase Database Schema (PostgreSQL)
-- Run this in the Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- INSTITUTIONS
-- ============================================================
CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROLES & PERMISSIONS
-- ============================================================
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  institution_id UUID REFERENCES institutions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- USER PROFILES
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id UUID REFERENCES roles(id),
  institution_id UUID REFERENCES institutions(id),
  avatar_url TEXT,
  phone TEXT,
  designation TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES profiles(id),
  legal_name TEXT NOT NULL,
  trading_name TEXT,
  company_type TEXT NOT NULL,
  ntn TEXT NOT NULL,
  secp_number TEXT NOT NULL,
  registration_date DATE,
  address TEXT NOT NULL,
  province TEXT NOT NULL,
  district TEXT NOT NULL,
  city TEXT NOT NULL,
  website TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  nature_of_business TEXT,
  main_export_categories TEXT[],
  registration_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft',
  nadra_status TEXT DEFAULT 'not_initiated',
  secp_status TEXT DEFAULT 'not_initiated',
  ntn_status TEXT DEFAULT 'not_initiated',
  email_verified BOOLEAN DEFAULT FALSE,
  mobile_verified BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- EXPORT RECORDS
-- ============================================================
CREATE TABLE export_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consignment_number TEXT UNIQUE NOT NULL,
  exporter_id UUID REFERENCES profiles(id),
  company_id UUID REFERENCES companies(id),
  -- Item Info
  product TEXT NOT NULL,
  product_category TEXT,
  hs_code TEXT,
  description TEXT,
  quantity NUMERIC,
  unit TEXT,
  estimated_value NUMERIC,
  currency TEXT DEFAULT 'USD',
  country_of_origin TEXT DEFAULT 'Pakistan',
  province_of_production TEXT,
  district_of_production TEXT,
  crop_year INTEGER,
  batch_number TEXT,
  packaging_type TEXT,
  num_packages INTEGER,
  intended_shipment_date DATE,
  -- Buyer Info
  buyer_name TEXT,
  buyer_company TEXT,
  buyer_country TEXT,
  buyer_address TEXT,
  buyer_contact TEXT,
  buyer_email TEXT,
  buyer_phone TEXT,
  purchase_order TEXT,
  -- Shipment Info
  destination_country TEXT,
  destination_port TEXT,
  port_of_departure TEXT,
  transport_mode TEXT,
  shipping_company TEXT,
  container_number TEXT,
  bill_of_lading TEXT,
  expected_departure DATE,
  expected_arrival DATE,
  -- Status
  status TEXT DEFAULT 'draft',
  tdap_review_status TEXT,
  nafsa_review_status TEXT,
  tdap_reviewer_id UUID REFERENCES profiles(id),
  nafsa_reviewer_id UUID REFERENCES profiles(id),
  tdap_review_date TIMESTAMPTZ,
  nafsa_review_date TIMESTAMPTZ,
  tdap_remarks TEXT,
  nafsa_remarks TEXT,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id UUID REFERENCES export_records(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_url TEXT NOT NULL,
  storage_path TEXT,
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES profiles(id),
  version INTEGER DEFAULT 1,
  verification_status TEXT DEFAULT 'pending',
  review_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMPLAINTS
-- ============================================================
CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_number TEXT UNIQUE NOT NULL,
  complainant_type TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  company_name TEXT,
  country TEXT NOT NULL,
  address TEXT,
  tic TEXT,
  exporter_company TEXT,
  export_registration_number TEXT,
  export_record_number TEXT,
  product TEXT,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  incident_date DATE,
  preferred_contact TEXT DEFAULT 'Email',
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'submitted',
  sla_deadline TIMESTAMPTZ,
  days_pending INTEGER DEFAULT 0,
  escalation_level INTEGER DEFAULT 0,
  assigned_officer_id UUID REFERENCES profiles(id),
  internal_notes TEXT,
  public_response TEXT,
  resolution_summary TEXT,
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE complaint_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE complaint_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  user_name TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id TEXT,
  previous_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MASTER DATA
-- ============================================================
CREATE TABLE master_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own, admins can read all
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role_id IN (SELECT id FROM roles WHERE name IN ('super_admin', 'moc_admin', 'tdap_admin', 'nafsa_admin')))
);

-- Companies: owners and admins
CREATE POLICY "Owners read own company" ON companies FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Admins read all companies" ON companies FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role_id IN (SELECT id FROM roles WHERE name IN ('super_admin', 'moc_admin', 'tdap_admin', 'tdap_officer', 'nafsa_admin', 'nafsa_officer')))
);

-- Export records: owners and admins
CREATE POLICY "Exporters read own records" ON export_records FOR SELECT USING (exporter_id = auth.uid());
CREATE POLICY "Admins read all export records" ON export_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role_id IN (SELECT id FROM roles WHERE name IN ('super_admin', 'moc_admin', 'tdap_admin', 'tdap_officer', 'nafsa_admin', 'nafsa_officer')))
);

-- Notifications: users read own
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());

-- Audit logs: admins only
CREATE POLICY "Admins read audit logs" ON audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role_id IN (SELECT id FROM roles WHERE name IN ('super_admin', 'auditor')))
);

-- ============================================================
-- SEED ROLES
-- ============================================================
INSERT INTO institutions (name, code) VALUES
  ('Ministry of National Food Security & Research', 'MNFSR'),
  ('Ministry of Commerce', 'MoC'),
  ('Trade Development Authority of Pakistan', 'TDAP'),
  ('National Agri-trade and Food Safety Authority', 'NAFSA');

INSERT INTO roles (name, display_name) VALUES
  ('super_admin', 'MNFSR Super Admin'),
  ('moc_admin', 'MoC Admin'),
  ('tdap_admin', 'TDAP Admin'),
  ('tdap_officer', 'TDAP Officer'),
  ('nafsa_admin', 'NAFSA Admin'),
  ('nafsa_officer', 'NAFSA Officer'),
  ('tic', 'Trade and Investment Counsellor'),
  ('exporter', 'Exporter/Trader'),
  ('buyer', 'Buyer/Importer'),
  ('auditor', 'Auditor/Viewer');

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
-- Create storage buckets for file uploads
-- Run in Supabase Dashboard > Storage or via SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES
--   ('company-documents', 'company-documents', false),
--   ('export-documents', 'export-documents', false),
--   ('complaint-attachments', 'complaint-attachments', false),
--   ('profile-avatars', 'profile-avatars', true);
