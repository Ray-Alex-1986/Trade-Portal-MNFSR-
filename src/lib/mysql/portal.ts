import 'server-only';

import { randomUUID } from 'node:crypto';
import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { Company, Complaint, User } from '@/lib/types';
import { hashPassword } from './passwords';
import { getMySqlPool, withMySqlTransaction } from './server';

export interface MySqlRegistrationInput {
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

export interface MySqlPublicComplaint {
  tracking_number: string;
  category: string;
  subject: string;
  priority: string;
  status: string;
  sla_deadline: string;
  days_pending: number;
  created_at: string;
  updated_at: string;
  resolution_summary?: string;
}

export interface MySqlPublicPortalStats {
  registeredExporters: number;
  activeUsers: number;
  totalConsignments: number;
  totalQuantity: number;
  countriesServed: number;
  pendingVerifications: number;
  complaintsReceived: number;
  complaintsResolved: number;
  monthly: { month: string; submissions: number; value: number }[];
  products: { name: string; value: number }[];
  countries: { name: string; value: number }[];
}

const FX_TO_USD: Record<string, number> = {
  USD: 1,
  PKR: 1 / 278,
  EUR: 1.08,
  GBP: 1.27,
  AED: 0.272294,
};

const asNumber = (value: unknown) => typeof value === 'number' ? value : Number(value) || 0;
const asDate = (value: unknown) => value instanceof Date ? value : new Date(String(value));
const asIso = (value: unknown) => {
  const date = asDate(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
};

function validateRegistration(input: MySqlRegistrationInput): string | null {
  if (!input.representative.full_name.trim() || !input.company.legal_name?.trim() || !input.registration_number.trim()) {
    return 'Representative name, company legal name, and registration number are required.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.representative.email.trim())) {
    return 'A valid email address is required.';
  }
  if (!input.representative.password || input.representative.password.length < 8) {
    return 'Use a password with at least 8 characters.';
  }
  return null;
}

async function getRoleId(connection: PoolConnection, roleName: string): Promise<string | null> {
  const [rows] = await connection.execute<RowDataPacket[]>('SELECT id FROM roles WHERE name = ? LIMIT 1', [roleName]);
  return rows[0]?.id as string | undefined ?? null;
}

async function addAuditLog(
  connection: PoolConnection,
  values: { userId?: string | null; userName: string; userRole: string; action: string; module: string; recordId?: string; newValue?: string },
) {
  await connection.execute(
    `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, module, record_id, new_value, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'server')`,
    [randomUUID(), values.userId ?? null, values.userName, values.userRole, values.action, values.module, values.recordId ?? null, values.newValue ?? null],
  );
}

async function notifySuperAdmins(connection: PoolConnection, title: string, message: string, type: string, link: string) {
  await connection.execute(
    `INSERT INTO notifications (id, user_id, title, message, type, link)
     SELECT UUID(), p.id, ?, ?, ?, ?
       FROM profiles p
       JOIN roles r ON r.id = p.role_id
      WHERE r.name = 'super_admin' AND p.is_active = TRUE AND p.deleted_at IS NULL`,
    [title, message, type, link],
  );
}

export async function registerMySqlExporter(input: MySqlRegistrationInput): Promise<{ user?: User; company?: Company; error?: string }> {
  const validationError = validateRegistration(input);
  if (validationError) return { error: validationError };

  const email = input.representative.email.trim().toLowerCase();
  const fullName = input.representative.full_name.trim();
  const now = new Date().toISOString();
  const userId = randomUUID();
  const companyId = randomUUID();
  const passwordHash = await hashPassword(input.representative.password!);

  try {
    const result = await withMySqlTransaction(async (connection) => {
      const roleId = await getRoleId(connection, 'exporter');
      if (!roleId) throw new Error('The exporter role is unavailable.');

      await connection.execute(
        `INSERT INTO profiles (id, email, full_name, password_hash, role_id, phone, designation, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [userId, email, fullName, passwordHash, roleId, input.representative.mobile.trim() || null, input.representative.designation.trim() || null],
      );

      const company = input.company;
      await connection.execute(
        `INSERT INTO companies (
          id, owner_id, legal_name, trading_name, company_type, ntn, secp_number, registration_date,
          address, province, district, city, website, email, phone, nature_of_business,
          main_export_categories, registration_number, status, tdap_review_status, nafsa_review_status,
          nadra_status, secp_status, ntn_status, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', 'pending',
                  'not_initiated', 'pending', 'pending', 'pending', ?, ?)`,
        [
          companyId, userId, company.legal_name?.trim() || '', company.trading_name?.trim() || null,
          company.company_type || 'Private Limited', company.ntn?.trim() || '', company.secp_number?.trim() || '',
          company.registration_date || now.slice(0, 10), company.address?.trim() || '', company.province || 'Punjab',
          company.district || '', company.city || '', company.website?.trim() || null, company.email?.trim() || email,
          company.phone?.trim() || input.representative.mobile.trim(), company.nature_of_business || 'Agricultural Export',
          JSON.stringify(company.main_export_categories || []), input.registration_number.trim(), userId, userId,
        ],
      );

      await notifySuperAdmins(
        connection,
        'New Exporter Registration',
        `${fullName} submitted ${company.legal_name?.trim() || 'a company'} (${input.registration_number.trim()}) for review.`,
        'info',
        '/admin/reviews',
      );
      await addAuditLog(connection, {
        userId,
        userName: fullName,
        userRole: 'exporter',
        action: 'Submit Registration',
        module: 'Registration',
        recordId: input.registration_number.trim(),
        newValue: company.legal_name?.trim() || '',
      });

      const user: User = { id: userId, email, full_name: fullName, role: 'exporter', is_active: true, created_at: now };
      const savedCompany: Company = {
        id: companyId,
        owner_id: userId,
        legal_name: company.legal_name?.trim() || '',
        trading_name: company.trading_name?.trim() || undefined,
        company_type: company.company_type || 'Private Limited',
        ntn: company.ntn?.trim() || '',
        secp_number: company.secp_number?.trim() || '',
        registration_date: company.registration_date || now.slice(0, 10),
        address: company.address?.trim() || '',
        province: company.province || 'Punjab',
        district: company.district || '',
        city: company.city || '',
        website: company.website?.trim() || undefined,
        email: company.email?.trim() || email,
        phone: company.phone?.trim() || input.representative.mobile.trim(),
        nature_of_business: company.nature_of_business || 'Agricultural Export',
        main_export_categories: company.main_export_categories || [],
        registration_number: input.registration_number.trim(),
        status: 'submitted',
        tdap_review_status: 'pending',
        nafsa_review_status: 'not_initiated',
        nadra_status: 'pending',
        secp_status: 'pending',
        ntn_status: 'pending',
        created_at: now,
        updated_at: now,
      };
      return { user, company: savedCompany };
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration could not be completed.';
    if (/duplicate|unique/i.test(message)) return { error: 'An account or company registration with these details already exists.' };
    console.error('[mysql-register-exporter]', error);
    return { error: 'Registration could not be completed. Please try again later.' };
  }
}

export async function submitMySqlPublicComplaint(input: Partial<Complaint> & { tracking_number: string }): Promise<{ id?: string; error?: string }> {
  const trackingNumber = input.tracking_number.trim();
  const fullName = input.full_name?.trim();
  const email = input.email?.trim().toLowerCase();
  const phone = input.phone?.trim();
  const country = input.country?.trim();
  const subject = input.subject?.trim();
  const description = input.description?.trim();
  if (!trackingNumber || !fullName || !email || !phone || !country || !subject || !description) {
    return { error: 'Complete all required complaint fields before submitting.' };
  }
  const id = randomUUID();
  try {
    await withMySqlTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO complaints (
          id, tracking_number, complainant_type, full_name, email, phone, company_name, country, address, tic,
          exporter_company, export_registration_number, export_record_number, product, category, subject, description,
          incident_date, preferred_contact, priority, status, sla_deadline
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 14 DAY))`,
        [
          id, trackingNumber, input.complainant_type || 'Buyer', fullName, email,
          phone, input.company_name || null, country, input.address || null, input.tic || null,
          input.exporter_company || null, input.export_registration_number || null, input.export_record_number || null,
          input.product || null, input.category || 'Other', subject, description, input.incident_date || null,
          input.preferred_contact || 'Email', input.priority || 'medium',
        ],
      );
      await notifySuperAdmins(connection, 'New Complaint Received', `Complaint ${trackingNumber} submitted by ${fullName} (${country}).`, 'warning', '/admin/reviews');
      await addAuditLog(connection, {
        userName: fullName, userRole: 'public', action: 'Create Complaint', module: 'Complaints',
        recordId: trackingNumber, newValue: `${input.category || 'Other'} — ${subject}`,
      });
    });
    return { id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Complaint could not be submitted.';
    if (/duplicate|unique/i.test(message)) return { error: 'This tracking number already exists.' };
    console.error('[mysql-public-complaint]', error);
    return { error: 'Complaint could not be submitted. Please try again later.' };
  }
}

export async function findMySqlComplaintByTracking(trackingNumber: string): Promise<MySqlPublicComplaint | null> {
  const [rows] = await getMySqlPool().execute<RowDataPacket[]>(
    `SELECT tracking_number, category, subject, priority, status, sla_deadline, days_pending, created_at, updated_at, resolution_summary
       FROM complaints
      WHERE tracking_number = ? AND deleted_at IS NULL
      LIMIT 1`,
    [trackingNumber],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    tracking_number: String(row.tracking_number),
    category: String(row.category),
    subject: String(row.subject),
    priority: String(row.priority),
    status: String(row.status),
    sla_deadline: asIso(row.sla_deadline),
    days_pending: asNumber(row.days_pending),
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
    resolution_summary: row.resolution_summary ? String(row.resolution_summary) : undefined,
  };
}

export async function getMySqlPublicPortalStats(): Promise<MySqlPublicPortalStats> {
  const pool = getMySqlPool();
  const [countsRows, monthlyRows, productRows, countryRows] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT
        (SELECT COUNT(*) FROM companies WHERE status = 'approved' AND deleted_at IS NULL) AS registered_exporters,
        (SELECT COUNT(*) FROM profiles WHERE is_active = TRUE AND deleted_at IS NULL) AS active_users,
        (SELECT COUNT(*) FROM export_records WHERE deleted_at IS NULL) AS total_consignments,
        (SELECT COALESCE(SUM(quantity), 0) FROM export_records WHERE deleted_at IS NULL) AS total_quantity,
        (SELECT COUNT(DISTINCT destination_country) FROM export_records WHERE deleted_at IS NULL AND destination_country IS NOT NULL AND destination_country <> '') AS countries_served,
        (SELECT COUNT(*) FROM companies WHERE status IN ('submitted', 'under_tdap_review', 'under_nafsa_review', 'additional_info_required') AND deleted_at IS NULL) AS pending_verifications,
        (SELECT COUNT(*) FROM complaints WHERE deleted_at IS NULL) AS complaints_received,
        (SELECT COUNT(*) FROM complaints WHERE deleted_at IS NULL AND (resolved_at IS NOT NULL OR status IN ('resolved', 'closed'))) AS complaints_resolved`,
    ),
    pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-01') AS month_start, COUNT(*) AS submissions,
              COALESCE(SUM(estimated_value * CASE UPPER(COALESCE(currency, 'USD'))
                WHEN 'PKR' THEN ? WHEN 'EUR' THEN ? WHEN 'GBP' THEN ? WHEN 'AED' THEN ? ELSE 1 END), 0) AS value
         FROM export_records
        WHERE deleted_at IS NULL AND created_at >= DATE_SUB(DATE_FORMAT(UTC_DATE(), '%Y-%m-01'), INTERVAL 11 MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m-01')
        ORDER BY month_start`,
      [FX_TO_USD.PKR, FX_TO_USD.EUR, FX_TO_USD.GBP, FX_TO_USD.AED],
    ),
    pool.query<RowDataPacket[]>(
      `SELECT product AS name, COUNT(*) AS value FROM export_records
        WHERE deleted_at IS NULL AND product IS NOT NULL AND product <> ''
        GROUP BY product ORDER BY value DESC, name LIMIT 8`,
    ),
    pool.query<RowDataPacket[]>(
      `SELECT destination_country AS name, COUNT(*) AS value FROM export_records
        WHERE deleted_at IS NULL AND destination_country IS NOT NULL AND destination_country <> ''
        GROUP BY destination_country ORDER BY value DESC, name LIMIT 8`,
    ),
  ]);
  const counts = countsRows[0][0] ?? {};
  const monthlyByKey = new Map(monthlyRows[0].map(row => [String(row.month_start).slice(0, 7), row]));
  const now = new Date();
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index, 1));
    const key = date.toISOString().slice(0, 7);
    const row = monthlyByKey.get(key);
    return { month: date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }), submissions: asNumber(row?.submissions), value: asNumber(row?.value) };
  });

  return {
    registeredExporters: asNumber(counts.registered_exporters),
    activeUsers: asNumber(counts.active_users),
    totalConsignments: asNumber(counts.total_consignments),
    totalQuantity: asNumber(counts.total_quantity),
    countriesServed: asNumber(counts.countries_served),
    pendingVerifications: asNumber(counts.pending_verifications),
    complaintsReceived: asNumber(counts.complaints_received),
    complaintsResolved: asNumber(counts.complaints_resolved),
    monthly,
    products: productRows[0].map(row => ({ name: String(row.name), value: asNumber(row.value) })),
    countries: countryRows[0].map(row => ({ name: String(row.name), value: asNumber(row.value) })),
  };
}
