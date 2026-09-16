-- ==========================================================================
-- National Export Portal — complete Supabase setup
-- ==========================================================================
--
-- GENERATED FILE. Do not edit by hand.
-- Rebuild with: node scripts/build-supabase-setup.mjs
--
-- Paste this whole file into the Supabase SQL editor and run it once on a
-- NEW, EMPTY project. It creates the schema, row-level security policies,
-- RPC functions, realtime publication, and the demo dataset.
--
-- It is not idempotent: running it twice on the same project will fail on
-- the CREATE TABLE statements. To reload only the demo data afterwards,
-- run: SELECT reset_demo_data();
--
-- Source files, applied in this order:
--   1. supabase-schema.sql
--   2. supabase/migrations/001_portal_updates.sql
--   3. supabase/migrations/002_demo_seed.sql
--   4. supabase/migrations/003_public_portal_stats.sql
--   5. supabase/migrations/004_document_realtime.sql

-- ==========================================================================
-- BEGIN supabase-schema.sql
-- ==========================================================================

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

-- ==========================================================================
-- END supabase-schema.sql
-- ==========================================================================


-- ==========================================================================
-- BEGIN supabase/migrations/001_portal_updates.sql
-- ==========================================================================

-- ============================================================================
-- 001_portal_updates.sql
-- Run AFTER supabase-schema.sql in the Supabase SQL Editor.
-- Adds: resolution tracking, province integration tables, RLS write policies,
--       RPC functions, and realtime publication for live subscriptions.
-- ============================================================================

-- Required by demo account password hashing and UUID generation in this file.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Helper: is the current user an admin/officer/auditor?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid()
      AND r.name IN ('super_admin', 'moc_admin', 'tdap_admin', 'tdap_officer',
                     'nafsa_admin', 'nafsa_officer', 'auditor')
  );
$$;

-- ---------------------------------------------------------------------------
-- Complaints: track actual resolution time (drives Avg Resolution + SLA KPIs)
-- ---------------------------------------------------------------------------
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Companies: two-stage review tracking (mirrors the app model; base schema
-- only had the nadra/secp/ntn verification columns)
-- ---------------------------------------------------------------------------
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tdap_review_status TEXT DEFAULT 'not_initiated';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS nafsa_review_status TEXT DEFAULT 'not_initiated';

-- ---------------------------------------------------------------------------
-- Province API integration tables (new — not in base schema)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS province_api_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  province TEXT NOT NULL,
  system_name TEXT,
  api_url TEXT NOT NULL,
  api_key TEXT,
  cron_interval TEXT DEFAULT 'daily',
  cron_expression TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_records INTEGER,
  last_sync_error TEXT,
  total_records_pulled INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS province_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES province_api_sources(id) ON DELETE CASCADE,
  source_name TEXT,
  province TEXT,
  status TEXT NOT NULL,
  records_pulled INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  triggered_by TEXT DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS province_data_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES province_api_sources(id) ON DELETE CASCADE,
  source_name TEXT,
  province TEXT,
  record_type TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  external_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_province_sync_logs_source ON province_sync_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_province_data_records_source ON province_data_records(source_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — enable on new tables + master_data
-- ---------------------------------------------------------------------------
ALTER TABLE province_api_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE province_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE province_data_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_data ENABLE ROW LEVEL SECURITY;

-- Master data: everyone reads, super admin writes
CREATE POLICY "All read master data" ON master_data FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Super admin writes master data" ON master_data FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'super_admin'));

-- Province sources: super admin manages, admins may read
CREATE POLICY "Admins read province sources" ON province_api_sources FOR SELECT TO authenticated
  USING (is_admin());
CREATE POLICY "Super admins manage province sources" ON province_api_sources FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'super_admin'));

CREATE POLICY "Admins read sync logs" ON province_sync_logs FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Super admins manage sync logs" ON province_sync_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'super_admin'));

CREATE POLICY "Admins read province records" ON province_data_records FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Super admins manage province records" ON province_data_records FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'super_admin'));

-- ---------------------------------------------------------------------------
-- RLS write policies on base tables
-- ---------------------------------------------------------------------------

-- Profiles: users create/update their own row (registration, last_login)
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins update profiles" ON profiles FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Companies: owners create/update their own, admins manage all
CREATE POLICY "Exporters insert own company" ON companies FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update own company" ON companies FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Admins update all companies" ON companies FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Export records: exporters create/update their own, admins manage all
CREATE POLICY "Exporters insert own records" ON export_records FOR INSERT TO authenticated
  WITH CHECK (exporter_id = auth.uid());
CREATE POLICY "Exporters update own records" ON export_records FOR UPDATE TO authenticated
  USING (exporter_id = auth.uid()) WITH CHECK (exporter_id = auth.uid());
CREATE POLICY "Admins update all records" ON export_records FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Documents: owners read their record documents, admins manage all
CREATE POLICY "Exporters read own documents" ON documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM export_records er WHERE er.id = record_id AND er.exporter_id = auth.uid()));
CREATE POLICY "Admins read all documents" ON documents FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Exporters insert own documents" ON documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM export_records er WHERE er.id = record_id AND er.exporter_id = auth.uid()));
CREATE POLICY "Admins update documents" ON documents FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Complaints: public box (anon can file), admins manage, owners read own
CREATE POLICY "Anyone can file a complaint" ON complaints FOR INSERT TO anon, authenticated
  WITH CHECK (TRUE);
CREATE POLICY "Admins read all complaints" ON complaints FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Users read own complaints" ON complaints FOR SELECT TO authenticated
  USING (created_by = auth.uid());
CREATE POLICY "Admins update complaints" ON complaints FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Notifications: users read + mark read their own; admins notify any user
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins insert notifications" ON notifications FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- Audit logs: broader admin read (base policy only allowed super_admin/auditor),
-- authenticated users write their own entries
DROP POLICY IF EXISTS "Admins read audit logs" ON audit_logs;
CREATE POLICY "Admins read audit logs" ON audit_logs FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Users insert own audit entries" ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Complaint comments/attachments (future-proofing)
ALTER TABLE complaint_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage complaint comments" ON complaint_comments FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins manage complaint attachments" ON complaint_attachments FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ---------------------------------------------------------------------------
-- RPC functions (SECURITY DEFINER) for paths RLS cannot express
-- ---------------------------------------------------------------------------

-- Public tracking lookup (no login required)
CREATE OR REPLACE FUNCTION public.get_complaint_by_tracking(p_tracking_number TEXT)
RETURNS SETOF complaints
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM complaints WHERE tracking_number = p_tracking_number;
$$;

-- Atomic public complaint submission: complaint + admin notification + audit log
CREATE OR REPLACE FUNCTION public.submit_public_complaint(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_tracking TEXT;
BEGIN
  v_id := gen_random_uuid();
  v_tracking := payload->>'tracking_number';

  INSERT INTO complaints (
    id, tracking_number, complainant_type, full_name, email, phone, company_name, country,
    address, tic, exporter_company, export_registration_number, export_record_number,
    product, category, subject, description, incident_date, preferred_contact, priority,
    status, sla_deadline, created_at, updated_at
  ) VALUES (
    v_id, v_tracking, COALESCE(payload->>'complainant_type', 'Buyer'),
    payload->>'full_name', payload->>'email', payload->>'phone',
    payload->>'company_name', payload->>'country', payload->>'address', payload->>'tic',
    payload->>'exporter_company', payload->>'export_registration_number',
    payload->>'export_record_number', payload->>'product', payload->>'category',
    payload->>'subject', payload->>'description',
    NULLIF(payload->>'incident_date', '')::date,
    COALESCE(payload->>'preferred_contact', 'Email'),
    COALESCE(payload->>'priority', 'medium'),
    'submitted', NOW() + INTERVAL '14 days', NOW(), NOW()
  );

  INSERT INTO notifications (user_id, title, message, type, link)
  SELECT p.id,
         'New Complaint Received',
         'Complaint ' || v_tracking || ' submitted by ' || payload->>'full_name' || ' (' || payload->>'country' || ').',
         'warning', '/admin/reviews'
  FROM profiles p JOIN roles r ON r.id = p.role_id
  WHERE r.name = 'super_admin';

  INSERT INTO audit_logs (user_name, action, module, record_id, new_value, ip_address)
  VALUES (payload->>'full_name', 'Create Complaint', 'Complaints', v_tracking,
          (payload->>'category') || ' — ' || (payload->>'subject'), 'public');

  RETURN jsonb_build_object('id', v_id, 'tracking_number', v_tracking);
END;
$$;

-- Notify all super admins (used by registration flow and complaint resolution)
CREATE OR REPLACE FUNCTION public.notify_super_admins(p_title TEXT, p_message TEXT, p_type TEXT DEFAULT 'info', p_link TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type, link)
  SELECT p.id, p_title, p_message, p_type, p_link
  FROM profiles p JOIN roles r ON r.id = p.role_id
  WHERE r.name = 'super_admin';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_complaint_by_tracking(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_complaint(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_super_admins(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Realtime publication (idempotent)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'companies', 'export_records', 'complaints', 'notifications',
    'audit_logs', 'master_data', 'province_api_sources', 'province_sync_logs',
    'province_data_records'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ==========================================================================
-- END supabase/migrations/001_portal_updates.sql
-- ==========================================================================


-- ==========================================================================
-- BEGIN supabase/migrations/002_demo_seed.sql
-- ==========================================================================

-- ============================================================================
-- 002_demo_seed.sql
-- Run AFTER 001_portal_updates.sql in the Supabase SQL Editor.
--
-- Creates REAL login accounts for all demo users (password: Demo@12345) and
-- seeds deterministic demo data so every dashboard KPI is genuinely computed.
-- Also defines reset_demo_data() used by the "Reset Demo Data" button
-- (via the /api/reset-demo route).
--
-- Re-runnable: skips existing auth users, wipes and reseeds entity tables.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_demo_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demo RECORD;
  v_exporter_id UUID;
  v_superadmin_id UUID;
BEGIN
  -- -------------------------------------------------------------------------
  -- 1) Wipe demo-owned tables (children before parents)
  -- -------------------------------------------------------------------------
  DELETE FROM province_data_records;
  DELETE FROM province_sync_logs;
  DELETE FROM province_api_sources;
  DELETE FROM documents;
  DELETE FROM complaint_attachments;
  DELETE FROM complaint_comments;
  DELETE FROM complaints;
  DELETE FROM export_records;
  DELETE FROM companies;
  DELETE FROM notifications;
  DELETE FROM audit_logs;
  DELETE FROM master_data;

  -- -------------------------------------------------------------------------
  -- 2) Demo login accounts (real auth.users rows) + profiles
  --    NOTE: auth accounts are created once and never deleted on reset,
  --    so logins keep working after a demo reset.
  -- -------------------------------------------------------------------------
  FOR demo IN
    SELECT * FROM (VALUES
      ('superadmin@mnfsr.gov.pk',   'Dr. Ahmed Raza Khan',      'super_admin',  'Ministry of National Food Security & Research'),
      ('admin@moc.gov.pk',          'Fatima Zahra Sheikh',      'moc_admin',    'Ministry of Commerce'),
      ('tdap.admin@tdap.gov.pk',    'Muhammad Tariq Siddiqui',  'tdap_admin',   'Trade Development Authority of Pakistan'),
      ('officer1@tdap.gov.pk',      'Ayesha Malik',             'tdap_officer', 'Trade Development Authority of Pakistan'),
      ('nafsa.admin@nafsa.gov.pk',  'Dr. Khalid Mahmood',       'nafsa_admin',  'National Agri-trade and Food Safety Authority'),
      ('officer1@nafsa.gov.pk',     'Sana Bukhari',             'nafsa_officer','National Agri-trade and Food Safety Authority'),
      ('tic.china@tdap.gov.pk',     'Imran Hussain',            'tic',          NULL),
      ('exporter1@pakrice.com',     'Hassan Ali Shah',          'exporter',     NULL),
      ('buyer@chinagrain.cn',       'Wei Zhang',                'buyer',        NULL),
      ('auditor@mnfsr.gov.pk',      'Nadia Parveen',            'auditor',      'Ministry of National Food Security & Research')
    ) AS t(email, full_name, role_name, institution_name)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = demo.email) THEN
      DECLARE
        v_id UUID;
      BEGIN
        v_id := gen_random_uuid();
        INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
        VALUES ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
                demo.email, crypt('Demo@12345', gen_salt('bf')), now(),
                now() - interval '200 days', now() - interval '200 days',
                '{"provider":"email","providers":["email"]}'::jsonb,
                jsonb_build_object('full_name', demo.full_name));
        INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
        VALUES (gen_random_uuid(), v_id::text, v_id,
                jsonb_build_object('sub', v_id::text, 'email', demo.email, 'full_name', demo.full_name),
                'email', now() - interval '200 days', now() - interval '200 days');
        INSERT INTO profiles (id, email, full_name, role_id, institution_id, is_active, last_login, created_at)
        VALUES (v_id, demo.email, demo.full_name,
                (SELECT id FROM roles WHERE name = demo.role_name),
                (SELECT id FROM institutions WHERE name = demo.institution_name),
                true, now() - interval '1 day', now() - interval '200 days');
      END;
    END IF;
  END LOOP;

  v_exporter_id := (SELECT id FROM profiles WHERE email = 'exporter1@pakrice.com');
  v_superadmin_id := (SELECT id FROM profiles WHERE email = 'superadmin@mnfsr.gov.pk');

  -- -------------------------------------------------------------------------
  -- 3) Master data
  -- -------------------------------------------------------------------------
  INSERT INTO master_data (category, name, sort_order)
  SELECT 'products', v, ord FROM unnest(ARRAY[
    'Basmati Rice','Mango (Chaunsa)','Mango (Sindhri)','Kinnow','Dates (Aseel)','Sesame Seeds',
    'Maize','Potatoes','Onions','Beef Meat','Seafood (Shrimp)','Olive Oil','Citrus Fruits','Red Chili','Cotton'
  ]) WITH ORDINALITY AS u(v, ord);

  INSERT INTO master_data (category, name, sort_order)
  SELECT 'countries', v, ord FROM unnest(ARRAY[
    'China','United Arab Emirates','Saudi Arabia','United Kingdom','Malaysia','Indonesia','Qatar','Oman',
    'Germany','Kazakhstan','Afghanistan','Turkey','South Africa','United States','Japan'
  ]) WITH ORDINALITY AS u(v, ord);

  INSERT INTO master_data (category, name, sort_order)
  SELECT 'provinces', v, ord FROM unnest(ARRAY[
    'Punjab','Sindh','Khyber Pakhtunkhwa','Balochistan','Gilgit-Baltistan','Islamabad Capital Territory'
  ]) WITH ORDINALITY AS u(v, ord);

  INSERT INTO master_data (category, name, sort_order)
  SELECT 'ports', v, ord FROM unnest(ARRAY[
    'Karachi Port','Port Qasim','Gwadar Port','Lahore Dry Port','Sialkot Dry Port','Islamabad Dry Port'
  ]) WITH ORDINALITY AS u(v, ord);

  INSERT INTO master_data (category, name, sort_order)
  SELECT 'complaint_categories', v, ord FROM unnest(ARRAY[
    'Product quality issue','SPS compliance issue','Quantity discrepancy','Packaging issue',
    'Documentation issue','Shipment delay','Payment dispute','Misrepresentation',
    'Exporter conduct','Inspection issue','Regulatory issue','Other'
  ]) WITH ORDINALITY AS u(v, ord);

  INSERT INTO master_data (category, name, sort_order)
  SELECT 'document_types', v, ord FROM unnest(ARRAY[
    'Buyer''s Quality Requirement Sheet','DDP SPS Certificate','Pre-Shipment Inspection (PSI) Report',
    'Purchase Order / Export Contract','Commercial Invoice','Packing List','Certificate of Origin',
    'Phytosanitary Certificate','Laboratory Test Report','Bill of Lading / Airway Bill','Additional Supporting Documents'
  ]) WITH ORDINALITY AS u(v, ord);

  INSERT INTO master_data (category, name, sort_order)
  SELECT 'roles', v, ord FROM unnest(ARRAY[
    'MNFSR Super Admin','MoC Admin','TDAP Admin','TDAP Officer','NAFSA Admin','NAFSA Officer',
    'Trade & Investment Counsellor','Exporter/Trader','Buyer/Importer','Auditor/Viewer'
  ]) WITH ORDINALITY AS u(v, ord);

  INSERT INTO master_data (category, name, sort_order)
  SELECT 'institutions', v, ord FROM unnest(ARRAY[
    'MNFSR','Ministry of Commerce','TDAP','NAFSA','TIC Beijing','TIC Dubai','TIC Riyadh','TIC London','TIC Kuala Lumpur'
  ]) WITH ORDINALITY AS u(v, ord);

  -- -------------------------------------------------------------------------
  -- 4) Companies (30) — deterministic statuses for meaningful review queues
  -- -------------------------------------------------------------------------
  INSERT INTO companies (
    id, owner_id, legal_name, company_type, ntn, secp_number, registration_date,
    address, province, district, city, email, phone, nature_of_business,
    main_export_categories, registration_number, status,
    nadra_status, secp_status, ntn_status, created_at, updated_at
  )
  SELECT
    gen_random_uuid(), v_exporter_id, n.name,
    (ARRAY['Private Limited','Sole Proprietor','Partnership','Public Limited'])[1 + ((n.ord - 1) % 4)],
    lpad((1000000 + n.ord * 137)::text, 7, '0') || '-' || (1 + n.ord % 9),
    (100000 + n.ord * 37)::text,
    date '2018-01-01' + ((n.ord * 79) % 2500),
    n.ord || ', Main Boulevard, ' || (ARRAY['Lahore','Karachi','Multan','Sialkot'])[1 + (n.ord % 4)],
    (ARRAY['Punjab','Sindh','Khyber Pakhtunkhwa','Balochistan','Gilgit-Baltistan','Islamabad Capital Territory'])[1 + ((n.ord - 1) % 6)],
    (ARRAY['Lahore','Karachi','Multan','Sialkot','Sukkur','Quetta'])[1 + ((n.ord - 1) % 6)],
    (ARRAY['Lahore','Karachi','Multan','Sialkot','Sukkur','Quetta'])[1 + ((n.ord - 1) % 6)],
    'info' || n.ord || '@example.pk',
    '+92-3' || (00 + (n.ord % 50)) || '-' || (1000000 + n.ord * 7919),
    (ARRAY['Agricultural Export','Food Processing & Export','Trading & Export','Agro-Industrial Export'])[1 + ((n.ord - 1) % 4)],
    ARRAY[
      (ARRAY['Basmati Rice','Mango (Chaunsa)','Kinnow','Dates (Aseel)','Sesame Seeds'])[1 + ((n.ord - 1) % 5)],
      (ARRAY['Maize','Potatoes','Onions','Citrus Fruits','Red Chili'])[1 + (n.ord % 5)]
    ],
    'REG-' || (2024000 + n.ord),
    (ARRAY['approved','approved','approved','submitted','under_nafsa_review','additional_info_required','rejected','approved','submitted','under_nafsa_review'])[1 + ((n.ord - 1) % 10)],
    'verified',
    CASE WHEN n.ord % 5 = 0 THEN 'pending' ELSE 'verified' END,
    'verified',
    now() - (((n.ord * 12) % 360) || ' days')::interval,
    now() - (((n.ord * 5) % 120) || ' days')::interval
  FROM (VALUES
    (1,'Pak Rice Exports (Pvt) Ltd'),(2,'Al-Noor Trading Corporation'),(3,'Green Valley Agro Exports'),
    (4,'Sindh Fruit Company'),(5,'Punjab Grain Traders'),(6,'Karachi Seafood International'),
    (7,'Ravi Agro Industries'),(8,'Chenab Exports Pvt Ltd'),(9,'Indus Valley Foods'),
    (10,'Khyber Trade Corporation'),(11,'Balochistan Dates Company'),(12,'Hunza Organic Exports'),
    (13,'National Agri-Trade Pakistan'),(14,'Crescent Foods International'),(15,'Pak-Oman Trading Company'),
    (16,'Heritage Rice Mills'),(17,'Golden Harvest Agro'),(18,'Al-Barakah Exports'),
    (19,'Sialkot Foods & Trading'),(20,'Multan Mango Exports'),(21,'Faisalabad Grain Company'),
    (22,'Lahore Spice Traders'),(23,'Gujranwala Agro Mills'),(24,'Quetta Dry Fruits Co'),
    (25,'Swat Valley Organics'),(26,'Thatta Seafood Exports'),(27,'DG Khan Agro Industries'),
    (28,'Peshawar Spice Company'),(29,'Mirpur Citrus Farms'),(30,'Sukkur Dates Trading')
  ) AS n(ord, name);

  -- Review-stage columns derived from status
  UPDATE companies SET
    tdap_review_status = CASE status
      WHEN 'approved' THEN 'reviewed' WHEN 'under_nafsa_review' THEN 'reviewed'
      WHEN 'submitted' THEN 'pending' WHEN 'additional_info_required' THEN 'info_requested'
      WHEN 'rejected' THEN 'rejected' ELSE 'not_initiated' END,
    nafsa_review_status = CASE status
      WHEN 'approved' THEN 'reviewed' WHEN 'under_nafsa_review' THEN 'pending'
      WHEN 'rejected' THEN 'rejected' ELSE 'not_initiated' END;

  -- -------------------------------------------------------------------------
  -- 5) Export records (60) — ~5 per month over the last 12 months
  -- -------------------------------------------------------------------------
  INSERT INTO export_records (
    id, consignment_number, exporter_id, company_id, product, product_category, hs_code,
    description, quantity, unit, estimated_value, currency, country_of_origin,
    province_of_production, district_of_production, crop_year, batch_number,
    packaging_type, num_packages, intended_shipment_date,
    buyer_name, buyer_company, buyer_country, buyer_address, buyer_contact,
    purchase_order, destination_country, destination_port, port_of_departure,
    transport_mode, shipping_company, container_number, bill_of_lading,
    expected_departure, expected_arrival, status, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    'EXP-' || (2025000 + o.ord),
    v_exporter_id,
    c.id,
    (ARRAY['Basmati Rice','Mango (Chaunsa)','Mango (Sindhri)','Kinnow','Dates (Aseel)','Sesame Seeds','Maize','Potatoes','Onions','Beef Meat','Seafood (Shrimp)','Olive Oil','Citrus Fruits','Red Chili','Cotton'])[1 + ((o.ord - 1) % 15)],
    CASE
      WHEN ((o.ord - 1) % 15) IN (0, 5, 6, 7, 8) THEN 'Cereals'
      WHEN ((o.ord - 1) % 15) IN (1, 2, 3, 12) THEN 'Fruits'
      WHEN ((o.ord - 1) % 15) IN (9, 10) THEN 'Meat & Seafood'
      ELSE 'Other Agricultural' END,
    (ARRAY['1006.30','0804.50','0804.50','0805.10','0804.10','1207.40','1005.90','0701.90','0703.10','0201.30','0306.17','1509.10','0805.90','0904.11','5201.00'])[1 + ((o.ord - 1) % 15)],
    'Export consignment ' || o.ord,
    10 + ((o.ord * 137) % 490),
    'Metric Tons',
    50000 + ((o.ord * 7919) % 4950000),
    (ARRAY['USD','PKR','EUR','GBP'])[1 + ((o.ord - 1) % 4)],
    'Pakistan',
    (ARRAY['Punjab','Sindh','Khyber Pakhtunkhwa','Balochistan'])[1 + ((o.ord - 1) % 4)],
    (ARRAY['Lahore','Karachi','Peshawar','Quetta'])[1 + ((o.ord - 1) % 4)],
    2024 + (o.ord % 3),
    'B' || (1000 + o.ord),
    (ARRAY['Jute Bags','Carton Boxes','Plastic Crates','Vacuum Packed','Bulk Container'])[1 + ((o.ord - 1) % 5)],
    100 + ((o.ord * 211) % 4900),
    date '2026-10-01' + ((o.ord * 3) % 80),
    'Buyer ' || o.ord,
    (ARRAY['China','United Arab Emirates','Saudi Arabia','United Kingdom','Malaysia','Indonesia','Qatar','Oman','Germany','Kazakhstan','Afghanistan','Turkey','South Africa','United States','Japan'])[1 + ((o.ord - 1) % 15)] || ' Imports Ltd',
    (ARRAY['China','United Arab Emirates','Saudi Arabia','United Kingdom','Malaysia','Indonesia','Qatar','Oman','Germany','Kazakhstan','Afghanistan','Turkey','South Africa','United States','Japan'])[1 + ((o.ord - 1) % 15)],
    'Business District, ' || (ARRAY['Shanghai','Dubai','Riyadh','London','Kuala Lumpur'])[1 + ((o.ord - 1) % 5)],
    '+86-21-' || (10000000 + o.ord * 137),
    'PO-' || (10000 + o.ord),
    (ARRAY['China','United Arab Emirates','Saudi Arabia','United Kingdom','Malaysia','Indonesia','Qatar','Oman','Germany','Kazakhstan','Afghanistan','Turkey','South Africa','United States','Japan'])[1 + ((o.ord - 1) % 15)],
    (ARRAY['Shanghai Port','Jebel Ali','King Abdulaziz Port','Southampton','Port Klang'])[1 + ((o.ord - 1) % 5)],
    (ARRAY['Karachi Port','Port Qasim','Gwadar Port'])[1 + ((o.ord - 1) % 3)],
    (ARRAY['Sea','Sea','Air','Road'])[1 + ((o.ord - 1) % 4)],
    (ARRAY['Maersk','MSC','CMA CGM','Hapag-Lloyd'])[1 + ((o.ord - 1) % 4)],
    'MSCU' || (1000000 + o.ord),
    'BL-' || (100000 + o.ord),
    date '2026-10-05' + ((o.ord * 3) % 80),
    date '2026-11-01' + ((o.ord * 3) % 80),
    (ARRAY['submitted','under_nafsa_review','approved','approved','ready_for_shipment','shipped','delivered','rejected','submitted','approved','shipped','draft'])[1 + ((o.ord - 1) % 12)],
    now() - (((o.ord * 6)) || ' days')::interval,
    now() - (((o.ord * 2) % 60) || ' days')::interval
  FROM generate_series(1, 60) AS o(ord)
  JOIN (
    SELECT id, row_number() OVER (ORDER BY registration_number) AS rn
    FROM companies
  ) c ON c.rn = 1 + ((o.ord - 1) % 30);

  UPDATE export_records SET
    tdap_review_status = CASE
      WHEN status IN ('approved','ready_for_shipment','shipped','delivered') THEN 'reviewed'
      WHEN status = 'rejected' THEN 'rejected'
      WHEN status IN ('submitted','under_nafsa_review') THEN 'pending'
      WHEN status = 'draft' THEN 'not_initiated' END,
    nafsa_review_status = CASE
      WHEN status IN ('approved','ready_for_shipment','shipped','delivered') THEN 'reviewed'
      WHEN status = 'rejected' THEN 'rejected'
      WHEN status = 'under_nafsa_review' THEN 'pending'
      WHEN status = 'submitted' THEN 'not_initiated'
      WHEN status = 'draft' THEN 'not_initiated' END;

  -- -------------------------------------------------------------------------
  -- 6) Documents — SPS & PSI certificates (drives compliance KPIs)
  --    SPS: 15 docs, 12 verified (80%) | PSI: 12 docs, 10 verified (83.3%)
  -- -------------------------------------------------------------------------
  INSERT INTO documents (id, record_id, document_type, file_name, file_size, file_url, upload_date, uploaded_by, verification_status)
  SELECT gen_random_uuid(), er.id, 'DDP SPS Certificate',
    'sps-' || er.consignment_number || '.pdf', 245000,
    'https://files.export-portal.gov.pk/demo/sps-' || er.consignment_number || '.pdf',
    er.created_at + interval '1 day', v_exporter_id,
    CASE WHEN er.rn % 5 = 0 THEN 'pending' ELSE 'verified' END
  FROM (
    SELECT id, consignment_number, created_at, row_number() OVER (ORDER BY consignment_number) AS rn
    FROM export_records WHERE status IN ('approved','ready_for_shipment','shipped','delivered')
    ORDER BY consignment_number LIMIT 15
  ) er;

  INSERT INTO documents (id, record_id, document_type, file_name, file_size, file_url, upload_date, uploaded_by, verification_status)
  SELECT gen_random_uuid(), er.id, 'Pre-Shipment Inspection (PSI) Report',
    'psi-' || er.consignment_number || '.pdf', 312000,
    'https://files.export-portal.gov.pk/demo/psi-' || er.consignment_number || '.pdf',
    er.created_at + interval '2 days', v_exporter_id,
    CASE WHEN er.rn % 6 = 0 THEN 'rejected' ELSE 'verified' END
  FROM (
    SELECT id, consignment_number, created_at, row_number() OVER (ORDER BY consignment_number) AS rn
    FROM export_records WHERE status IN ('approved','ready_for_shipment','shipped','delivered')
    ORDER BY consignment_number DESC LIMIT 12
  ) er;

  -- -------------------------------------------------------------------------
  -- 7) Complaints (20) — resolution spread across/against the 14-day SLA
  -- -------------------------------------------------------------------------
  INSERT INTO complaints (
    id, tracking_number, complainant_type, full_name, email, phone, company_name, country,
    exporter_company, export_registration_number, export_record_number, product, category,
    subject, description, incident_date, preferred_contact, priority, status,
    sla_deadline, days_pending, escalation_level, resolution_summary, resolved_at, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    'CMP-' || (2025000 + o.ord),
    (ARRAY['Buyer','Importer','TIC','Exporter'])[1 + ((o.ord - 1) % 4)],
    'Complainant ' || o.ord,
    'complainant' || o.ord || '@example.com',
    '+971-50-' || (1000000 + o.ord * 137),
    (ARRAY['China','United Arab Emirates','Saudi Arabia','United Kingdom','Malaysia'])[1 + ((o.ord - 1) % 5)] || ' Trading Co',
    (ARRAY['China','United Arab Emirates','Saudi Arabia','United Kingdom','Malaysia'])[1 + ((o.ord - 1) % 5)],
    (ARRAY['Pak Rice Exports (Pvt) Ltd','Sindh Fruit Company','Karachi Seafood International','Heritage Rice Mills'])[1 + ((o.ord - 1) % 4)],
    'REG-' || (2024001 + (o.ord % 30)),
    'EXP-' || (2025001 + (o.ord % 60)),
    (ARRAY['Basmati Rice','Mango (Chaunsa)','Kinnow','Dates (Aseel)','Sesame Seeds'])[1 + ((o.ord - 1) % 5)],
    (ARRAY['Product quality issue','SPS compliance issue','Quantity discrepancy','Packaging issue','Documentation issue','Shipment delay','Payment dispute','Misrepresentation','Exporter conduct','Inspection issue','Regulatory issue','Other'])[1 + ((o.ord - 1) % 12)],
    'Complaint regarding order #' || (10000 + o.ord),
    'Detailed complaint description for demonstration record ' || o.ord || '.',
    date '2026-01-01' + ((o.ord * 13) % 240),
    (ARRAY['Email','Phone','Both'])[1 + ((o.ord - 1) % 3)],
    (ARRAY['low','medium','high','critical'])[1 + (o.ord % 4)],
    (ARRAY['submitted','acknowledged','under_review','assigned','investigation','escalated','resolved','closed','resolved','resolved'])[1 + ((o.ord - 1) % 10)],
    (now() - (((o.ord * 15) % 300) || ' days')::interval) + interval '14 days',
    (o.ord * 13) % 90,
    CASE WHEN (ARRAY['submitted','acknowledged','under_review','assigned','investigation','escalated','resolved','closed','resolved','resolved'])[1 + ((o.ord - 1) % 10)] = 'escalated' THEN 1 + (o.ord % 3) ELSE 0 END,
    CASE WHEN (ARRAY['submitted','acknowledged','under_review','assigned','investigation','escalated','resolved','closed','resolved','resolved'])[1 + ((o.ord - 1) % 10)] IN ('resolved','closed') THEN 'Issue investigated and resolved satisfactorily.' END,
    CASE WHEN (ARRAY['submitted','acknowledged','under_review','assigned','investigation','escalated','resolved','closed','resolved','resolved'])[1 + ((o.ord - 1) % 10)] IN ('resolved','closed')
         THEN (now() - (((o.ord * 15) % 300) || ' days')::interval) + ((2 + (o.ord % 17)) || ' days')::interval END,
    now() - (((o.ord * 15) % 300) || ' days')::interval,
    now() - (((o.ord * 3) % 60) || ' days')::interval
  FROM generate_series(1, 20) AS o(ord);

  -- -------------------------------------------------------------------------
  -- 8) Province API integrations: 5 sources, 8 logs, 40 records
  -- -------------------------------------------------------------------------
  INSERT INTO province_api_sources (id, name, province, system_name, api_url, cron_interval, is_active, last_sync_at, last_sync_status, last_sync_records, total_records_pulled, created_by, created_at, updated_at)
  VALUES
    (gen_random_uuid(), 'Punjab Agriculture Export Portal', 'Punjab', 'Punjab Agri-Export System', 'https://api.punjab-agri.gov.pk/v1/exports', 'hourly', true, now() - interval '6 hours', 'success', 24, 1842, v_superadmin_id, now() - interval '180 days', now() - interval '6 hours'),
    (gen_random_uuid(), 'Sindh Trade & Commerce Bureau', 'Sindh', 'Sindh Trade Portal', 'https://api.sindh-commerce.gov.pk/v2/trade-data', 'daily', true, now() - interval '1 day', 'success', 18, 967, v_superadmin_id, now() - interval '160 days', now() - interval '1 day'),
    (gen_random_uuid(), 'KP Export Facilitation Center', 'Khyber Pakhtunkhwa', 'KP Trade Gateway', 'https://api.kp-trade.gov.pk/v1/export-records', 'every_6h', true, now() - interval '12 hours', 'partial', 7, 534, v_superadmin_id, now() - interval '140 days', now() - interval '12 hours'),
    (gen_random_uuid(), 'Balochistan Mineral & Agri Export Board', 'Balochistan', 'Balochistan Export Board', 'https://api.balochistan-export.gov.pk/v1/data', 'daily', false, now() - interval '3 days', 'failed', 0, 215, v_superadmin_id, now() - interval '120 days', now() - interval '3 days'),
    (gen_random_uuid(), 'Gilgit-Baltistan Horticulture Board', 'Gilgit-Baltistan', 'GB Horticulture System', 'https://api.gb-horti.gov.pk/v1/produce', 'weekly', true, now() - interval '2 days', 'success', 5, 128, v_superadmin_id, now() - interval '90 days', now() - interval '2 days');

  INSERT INTO province_sync_logs (id, source_id, source_name, province, status, records_pulled, started_at, completed_at, duration_ms, triggered_by)
  SELECT gen_random_uuid(), s.id, s.name, s.province,
    (ARRAY['success','success','success','partial','failed','success','success','success'])[o.ord],
    CASE (ARRAY['success','success','success','partial','failed','success','success','success'])[o.ord]
      WHEN 'failed' THEN 0
      WHEN 'partial' THEN 3 + (o.ord % 5)
      ELSE 8 + ((o.ord * 7) % 25) END,
    now() - ((o.ord * 5) || ' hours')::interval,
    now() - ((o.ord * 5) || ' hours')::interval + (((o.ord * 3000) % 45000) || ' ms')::interval,
    5000 + ((o.ord * 3000) % 45000),
    CASE WHEN o.ord % 4 = 0 THEN 'manual' ELSE 'cron' END
  FROM generate_series(1, 8) AS o(ord)
  JOIN (
    SELECT id, name, province, row_number() OVER (ORDER BY created_at) AS rn
    FROM province_api_sources
  ) s ON s.rn = 1 + ((o.ord - 1) % 5);

  INSERT INTO province_data_records (id, source_id, source_name, province, record_type, data, external_id, synced_at)
  SELECT gen_random_uuid(), s.id, s.name, s.province,
    (ARRAY['export_permit','phyto_certificate','quality_inspection','trade_license','origin_certificate'])[1 + ((o.ord - 1) % 5)],
    jsonb_build_object(
      'reference_number', 'REF-' || upper(left(s.province, 2)) || '-' || (2026000 + o.ord),
      'product', (ARRAY['Basmati Rice','Mango (Chaunsa)','Kinnow','Dates (Aseel)','Sesame Seeds'])[1 + ((o.ord - 1) % 5)],
      'quantity', 10 + ((o.ord * 61) % 390),
      'unit', 'Metric Tons',
      'exporter_name', 'Exporter ' || o.ord,
      'destination', (ARRAY['China','United Arab Emirates','Saudi Arabia','United Kingdom','Malaysia'])[1 + ((o.ord - 1) % 5)],
      'status', (ARRAY['approved','pending','verified','in_transit'])[1 + (o.ord % 4)],
      'issue_date', (now() - ((o.ord * 2) || ' days')::interval)::date
    ),
    'EXT-' || (2026000 + o.ord),
    now() - ((o.ord * 3) || ' hours')::interval
  FROM generate_series(1, 40) AS o(ord)
  JOIN (
    SELECT id, name, province, row_number() OVER (ORDER BY created_at) AS rn
    FROM province_api_sources
  ) s ON s.rn = 1 + ((o.ord - 1) % 5);

  -- -------------------------------------------------------------------------
  -- 9) Notifications + audit history
  -- -------------------------------------------------------------------------
  INSERT INTO notifications (user_id, title, message, type, link, created_at)
  VALUES
    (v_exporter_id, 'Export Record Approved', 'Your export record EXP-2025003 has been approved by TDAP.', 'success', '/dashboard/exports', now() - interval '8 hours'),
    (v_exporter_id, 'Document Verified', 'SPS Certificate for EXP-2025010 has been verified.', 'success', '/dashboard/exports', now() - interval '2 days'),
    (v_superadmin_id, 'Monthly Report Ready', 'Current month export summary report is available.', 'info', '/admin/reports', now() - interval '3 days'),
    (v_superadmin_id, 'New Registration Pending', 'New exporter registrations await review.', 'warning', '/admin/reviews', now() - interval '5 hours');

  INSERT INTO audit_logs (user_id, user_name, user_role, action, module, record_id, previous_value, new_value, ip_address, created_at)
  SELECT
    v_superadmin_id, 'Dr. Ahmed Raza Khan', 'super_admin',
    (ARRAY['Login','Approve','Update Record','Change Status','Export Report','Review Registration','Resolve Complaint','Upload Document'])[1 + ((o.ord - 1) % 8)],
    (ARRAY['Authentication','Export Records','Export Records','Complaints','Reports','Registration','Complaints','Export Records'])[1 + ((o.ord - 1) % 8)],
    (ARRAY['EXP-2025003','REG-2024012','EXP-2025018','CMP-2025004','RPT-2026-09','REG-2024022','CMP-2025007','EXP-2025021'])[1 + ((o.ord - 1) % 8)],
    CASE WHEN o.ord % 3 = 0 THEN 'submitted' END,
    CASE WHEN o.ord % 3 = 0 THEN 'approved' END,
    '10.1.' || (o.ord % 254) || '.' || (100 + o.ord),
    now() - ((o.ord * 7) || ' hours')::interval
  FROM generate_series(1, 15) AS o(ord);

END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_demo_data() TO authenticated;

-- Run the seed
SELECT public.reset_demo_data();

-- ==========================================================================
-- END supabase/migrations/002_demo_seed.sql
-- ==========================================================================


-- ==========================================================================
-- BEGIN supabase/migrations/003_public_portal_stats.sql
-- ==========================================================================

-- ============================================================================
-- 003_public_portal_stats.sql
-- Run AFTER 001_portal_updates.sql.
-- Exposes only non-identifying aggregate metrics for the public landing page.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_public_portal_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH months AS (
    SELECT date_trunc('month', CURRENT_DATE) - (INTERVAL '1 month' * series) AS month_start
    FROM generate_series(11, 0, -1) AS series
  ),
  monthly AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'month', to_char(month_start, 'Mon'),
          'submissions', submission_count,
          'value', export_value_usd
        ) ORDER BY month_start
      ),
      '[]'::jsonb
    ) AS data
    FROM (
      SELECT
        months.month_start,
        COUNT(export_records.id)::INTEGER AS submission_count,
        COALESCE(SUM(
          export_records.estimated_value * CASE UPPER(COALESCE(export_records.currency, 'USD'))
            WHEN 'PKR' THEN 1.0 / 278
            WHEN 'EUR' THEN 1.08
            WHEN 'GBP' THEN 1.27
            WHEN 'AED' THEN 0.272294
            ELSE 1
          END
        ), 0) AS export_value_usd
      FROM months
      LEFT JOIN export_records
        ON export_records.created_at >= months.month_start
       AND export_records.created_at < months.month_start + INTERVAL '1 month'
      GROUP BY months.month_start
    ) monthly_rows
  ),
  top_products AS (
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object('name', name, 'value', record_count) ORDER BY record_count DESC, name),
      '[]'::jsonb
    ) AS data
    FROM (
      SELECT product AS name, COUNT(*)::INTEGER AS record_count
      FROM export_records
      WHERE COALESCE(product, '') <> ''
      GROUP BY product
      ORDER BY record_count DESC, name
      LIMIT 8
    ) product_rows
  ),
  destination_countries AS (
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object('name', name, 'value', record_count) ORDER BY record_count DESC, name),
      '[]'::jsonb
    ) AS data
    FROM (
      SELECT destination_country AS name, COUNT(*)::INTEGER AS record_count
      FROM export_records
      WHERE COALESCE(destination_country, '') <> ''
      GROUP BY destination_country
      ORDER BY record_count DESC, name
      LIMIT 8
    ) country_rows
  )
  SELECT jsonb_build_object(
    'registered_exporters', (SELECT COUNT(*)::INTEGER FROM companies WHERE status = 'approved'),
    'active_users', (SELECT COUNT(*)::INTEGER FROM profiles WHERE is_active = TRUE),
    'total_consignments', (SELECT COUNT(*)::INTEGER FROM export_records),
    'total_quantity', (SELECT COALESCE(SUM(quantity), 0) FROM export_records),
    'countries_served', (SELECT COUNT(DISTINCT destination_country)::INTEGER FROM export_records WHERE COALESCE(destination_country, '') <> ''),
    'pending_verifications', (SELECT COUNT(*)::INTEGER FROM companies WHERE status IN ('submitted', 'under_tdap_review', 'under_nafsa_review', 'additional_info_required')),
    'complaints_received', (SELECT COUNT(*)::INTEGER FROM complaints),
    'complaints_resolved', (SELECT COUNT(*)::INTEGER FROM complaints WHERE resolved_at IS NOT NULL OR status IN ('resolved', 'closed')),
    'monthly', (SELECT data FROM monthly),
    'products', (SELECT data FROM top_products),
    'countries', (SELECT data FROM destination_countries)
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_portal_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_portal_stats() TO anon, authenticated;

-- ==========================================================================
-- END supabase/migrations/003_public_portal_stats.sql
-- ==========================================================================


-- ==========================================================================
-- BEGIN supabase/migrations/004_document_realtime.sql
-- ==========================================================================

-- ============================================================================
-- 004_document_realtime.sql
-- Run AFTER 001_portal_updates.sql.
-- Publishes document metadata changes so joined export records stay live.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
  END IF;
END $$;

-- ==========================================================================
-- END supabase/migrations/004_document_realtime.sql
-- ==========================================================================
