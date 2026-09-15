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
