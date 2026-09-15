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
