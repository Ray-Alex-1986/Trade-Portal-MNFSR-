import 'server-only';

import { randomUUID } from 'node:crypto';
import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import {
  AuditLog, Company, Complaint, Document, ExportRecord, Notification,
  ProvinceApiSource, ProvinceDataRecord, ProvinceSyncLog, User, UserRole,
} from '@/lib/types';
import type { MasterCategory, ReviewDecision } from '@/lib/data-store';
import { canReviewStage, getPermissions } from '@/lib/permissions';
import { hashPassword } from './passwords';
import { getMySqlPool, withMySqlTransaction } from './server';
import { getMySqlSessionUser } from './session';

const MASTER_CATEGORIES: MasterCategory[] = [
  'products', 'countries', 'provinces', 'ports',
  'complaint_categories', 'document_types', 'roles', 'institutions',
];

const EMPTY_MASTER = (): Record<MasterCategory, string[]> => ({
  products: [], countries: [], provinces: [], ports: [],
  complaint_categories: [], document_types: [], roles: [], institutions: [],
});

const USER_ROLES = new Set<UserRole>([
  'super_admin', 'moc_admin', 'tdap_admin', 'tdap_officer', 'nafsa_admin',
  'nafsa_officer', 'tic', 'exporter', 'buyer', 'auditor',
]);

export class MySqlPortalError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'MySqlPortalError';
  }
}

export interface MySqlPortalSnapshot {
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
}

type Row = RowDataPacket & Record<string, unknown>;
type Input = Record<string, unknown>;
type SqlValue = string | number | boolean | Date | null;

const sqlValues = (values: unknown[]): SqlValue[] => values.map(value => {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) return value;
  return JSON.stringify(value);
});

const affectedRows = (result: unknown): number => Number((result as { affectedRows?: unknown }).affectedRows) || 0;

const asInput = (value: unknown): Input => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Input : {}
);

const string = (row: Row | Input, name: string, fallback = ''): string => {
  const value = row[name];
  return value === null || value === undefined ? fallback : String(value);
};

const optionalString = (row: Row | Input, name: string): string | undefined => {
  const value = string(row, name).trim();
  return value || undefined;
};

const number = (row: Row | Input, name: string, fallback = 0): number => {
  const value = Number(row[name]);
  return Number.isFinite(value) ? value : fallback;
};

const boolean = (row: Row | Input, name: string, fallback = false): boolean => {
  const value = row[name];
  if (value === null || value === undefined) return fallback;
  return value === true || value === 1 || value === '1';
};

function iso(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  const raw = String(value);
  const date = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw)
    ? new Date(`${raw.replace(' ', 'T')}Z`)
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString();
}

function dateOnly(value: unknown): string {
  if (!value) return '';
  const raw = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : iso(value).slice(0, 10);
}

function jsonStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function mapUser(row: Row): User {
  return {
    id: string(row, 'id'),
    email: string(row, 'email'),
    full_name: string(row, 'full_name'),
    role: (string(row, 'role', 'exporter') as UserRole),
    institution: optionalString(row, 'institution'),
    avatar_url: optionalString(row, 'avatar_url'),
    is_active: boolean(row, 'is_active'),
    created_at: iso(row.created_at),
    last_login: row.last_login ? iso(row.last_login) : undefined,
  };
}

function mapCompany(row: Row): Company {
  return {
    id: string(row, 'id'), owner_id: string(row, 'owner_id'),
    legal_name: string(row, 'legal_name'), trading_name: optionalString(row, 'trading_name'),
    company_type: string(row, 'company_type'), ntn: string(row, 'ntn'), secp_number: string(row, 'secp_number'),
    registration_date: dateOnly(row.registration_date), address: string(row, 'address'),
    province: string(row, 'province'), district: string(row, 'district'), city: string(row, 'city'),
    website: optionalString(row, 'website'), email: string(row, 'email'), phone: string(row, 'phone'),
    nature_of_business: string(row, 'nature_of_business'), main_export_categories: jsonStrings(row.main_export_categories),
    registration_number: string(row, 'registration_number'), status: string(row, 'status') as Company['status'],
    tdap_review_status: string(row, 'tdap_review_status') as Company['tdap_review_status'],
    nafsa_review_status: string(row, 'nafsa_review_status') as Company['nafsa_review_status'],
    nadra_status: string(row, 'nadra_status') as Company['nadra_status'],
    secp_status: string(row, 'secp_status') as Company['secp_status'],
    ntn_status: string(row, 'ntn_status') as Company['ntn_status'],
    created_at: iso(row.created_at), updated_at: iso(row.updated_at),
  };
}

function mapDocument(row: Row): Document {
  return {
    id: string(row, 'id'), record_id: string(row, 'record_id'), document_type: string(row, 'document_type'),
    file_name: string(row, 'file_name'), file_size: number(row, 'file_size'), upload_date: iso(row.upload_date),
    uploaded_by: string(row, 'uploaded_by'), version: number(row, 'version', 1),
    verification_status: string(row, 'verification_status', 'pending'), review_remarks: optionalString(row, 'review_remarks'),
    file_url: string(row, 'file_url'),
  };
}

function mapExportRecord(row: Row, documents: Document[]): ExportRecord {
  return {
    id: string(row, 'id'), consignment_number: string(row, 'consignment_number'),
    exporter_id: string(row, 'exporter_id'), company_id: string(row, 'company_id'), product: string(row, 'product'),
    product_category: string(row, 'product_category'), hs_code: string(row, 'hs_code'), description: string(row, 'description'),
    quantity: number(row, 'quantity'), unit: string(row, 'unit'), estimated_value: number(row, 'estimated_value'),
    currency: string(row, 'currency', 'USD'), country_of_origin: string(row, 'country_of_origin', 'Pakistan'),
    province_of_production: string(row, 'province_of_production'), district_of_production: string(row, 'district_of_production'),
    crop_year: row.crop_year === null || row.crop_year === undefined ? undefined : number(row, 'crop_year'),
    batch_number: string(row, 'batch_number'), packaging_type: string(row, 'packaging_type'), num_packages: number(row, 'num_packages'),
    intended_shipment_date: dateOnly(row.intended_shipment_date), buyer_name: string(row, 'buyer_name'),
    buyer_company: string(row, 'buyer_company'), buyer_country: string(row, 'buyer_country'), buyer_address: string(row, 'buyer_address'),
    buyer_contact: string(row, 'buyer_contact'), buyer_email: string(row, 'buyer_email'), buyer_phone: string(row, 'buyer_phone'),
    purchase_order: string(row, 'purchase_order'), destination_country: string(row, 'destination_country'),
    destination_port: string(row, 'destination_port'), port_of_departure: string(row, 'port_of_departure'),
    transport_mode: string(row, 'transport_mode'), shipping_company: string(row, 'shipping_company'),
    container_number: string(row, 'container_number'), bill_of_lading: string(row, 'bill_of_lading'),
    expected_departure: dateOnly(row.expected_departure), expected_arrival: dateOnly(row.expected_arrival),
    status: string(row, 'status') as ExportRecord['status'],
    tdap_review_status: optionalString(row, 'tdap_review_status'),
    nafsa_review_status: optionalString(row, 'nafsa_review_status'), documents,
    created_at: iso(row.created_at), updated_at: iso(row.updated_at),
  };
}

function mapComplaint(row: Row): Complaint {
  return {
    id: string(row, 'id'), tracking_number: string(row, 'tracking_number'), complainant_type: string(row, 'complainant_type'),
    full_name: string(row, 'full_name'), email: string(row, 'email'), phone: string(row, 'phone'),
    company_name: optionalString(row, 'company_name'), country: string(row, 'country'), address: optionalString(row, 'address'),
    tic: optionalString(row, 'tic'), exporter_company: optionalString(row, 'exporter_company'),
    export_registration_number: optionalString(row, 'export_registration_number'), export_record_number: optionalString(row, 'export_record_number'),
    product: optionalString(row, 'product'), category: string(row, 'category'), subject: string(row, 'subject'),
    description: string(row, 'description'), incident_date: dateOnly(row.incident_date), preferred_contact: string(row, 'preferred_contact'),
    priority: string(row, 'priority', 'medium') as Complaint['priority'], status: string(row, 'status', 'submitted') as Complaint['status'],
    sla_deadline: iso(row.sla_deadline), days_pending: number(row, 'days_pending'), escalation_level: number(row, 'escalation_level'),
    assigned_officer: optionalString(row, 'assigned_officer'), internal_notes: optionalString(row, 'internal_notes'),
    public_response: optionalString(row, 'public_response'), resolution_summary: optionalString(row, 'resolution_summary'),
    satisfaction_rating: row.satisfaction_rating === null || row.satisfaction_rating === undefined ? undefined : number(row, 'satisfaction_rating'),
    resolved_at: row.resolved_at ? iso(row.resolved_at) : undefined,
    created_at: iso(row.created_at), updated_at: iso(row.updated_at),
  };
}

function mapNotification(row: Row): Notification {
  const type = string(row, 'type', 'info');
  return {
    id: string(row, 'id'), user_id: string(row, 'user_id'), title: string(row, 'title'), message: string(row, 'message'),
    type: ['info', 'success', 'warning', 'error'].includes(type) ? type as Notification['type'] : 'info',
    is_read: boolean(row, 'is_read'), link: optionalString(row, 'link'), created_at: iso(row.created_at),
  };
}

function mapAuditLog(row: Row): AuditLog {
  return {
    id: string(row, 'id'), user_id: string(row, 'user_id'), user_name: string(row, 'user_name'),
    user_role: string(row, 'user_role', 'auditor') as UserRole, action: string(row, 'action'), module: string(row, 'module'),
    record_id: string(row, 'record_id'), previous_value: optionalString(row, 'previous_value'),
    new_value: optionalString(row, 'new_value'), ip_address: string(row, 'ip_address', 'server'), created_at: iso(row.created_at),
  };
}

function mapProvinceSource(row: Row): ProvinceApiSource {
  return {
    id: string(row, 'id'), name: string(row, 'name'), province: string(row, 'province'), system_name: string(row, 'system_name'),
    api_url: string(row, 'api_url'), cron_interval: string(row, 'cron_interval', 'daily') as ProvinceApiSource['cron_interval'],
    cron_expression: optionalString(row, 'cron_expression'), is_active: boolean(row, 'is_active'),
    last_sync_at: row.last_sync_at ? iso(row.last_sync_at) : undefined,
    last_sync_status: optionalString(row, 'last_sync_status') as ProvinceApiSource['last_sync_status'],
    last_sync_records: row.last_sync_records === null || row.last_sync_records === undefined ? undefined : number(row, 'last_sync_records'),
    last_sync_error: optionalString(row, 'last_sync_error'), total_records_pulled: number(row, 'total_records_pulled'),
    created_at: iso(row.created_at), updated_at: iso(row.updated_at), created_by: string(row, 'created_by'),
  };
}

function mapProvinceSyncLog(row: Row): ProvinceSyncLog {
  return {
    id: string(row, 'id'), source_id: string(row, 'source_id'), source_name: string(row, 'source_name'),
    province: string(row, 'province'), status: string(row, 'status') as ProvinceSyncLog['status'],
    records_pulled: number(row, 'records_pulled'), started_at: iso(row.started_at),
    completed_at: row.completed_at ? iso(row.completed_at) : undefined,
    duration_ms: row.duration_ms === null || row.duration_ms === undefined ? undefined : number(row, 'duration_ms'),
    error_message: optionalString(row, 'error_message'), triggered_by: string(row, 'triggered_by'),
  };
}

function mapProvinceDataRecord(row: Row): ProvinceDataRecord {
  return {
    id: string(row, 'id'), source_id: string(row, 'source_id'), source_name: string(row, 'source_name'),
    province: string(row, 'province'), record_type: string(row, 'record_type'), data: jsonObject(row.data),
    external_id: optionalString(row, 'external_id'), synced_at: iso(row.synced_at),
  };
}

async function loadMasterItems(): Promise<Record<MasterCategory, string[]>> {
  const pool = getMySqlPool();
  const [masterRows, roleRows, institutionRows] = await Promise.all([
    pool.query<Row[]>('SELECT category, name FROM master_data WHERE is_active = TRUE ORDER BY sort_order, name'),
    pool.query<Row[]>('SELECT name FROM roles ORDER BY display_name'),
    pool.query<Row[]>('SELECT name FROM institutions WHERE is_active = TRUE ORDER BY name'),
  ]);
  const masterItems = EMPTY_MASTER();
  for (const row of masterRows[0]) {
    const category = string(row, 'category') as MasterCategory;
    if (MASTER_CATEGORIES.includes(category)) masterItems[category].push(string(row, 'name'));
  }
  masterItems.roles = roleRows[0].map(row => string(row, 'name'));
  masterItems.institutions = institutionRows[0].map(row => string(row, 'name'));
  return masterItems;
}

function emptySnapshot(masterItems: Record<MasterCategory, string[]>): MySqlPortalSnapshot {
  return {
    users: [], companies: [], exportRecords: [], complaints: [], masterItems, auditLogs: [], notifications: [],
    provinceApiSources: [], provinceSyncLogs: [], provinceDataRecords: [],
  };
}

async function queryDocuments(recordIds: string[]): Promise<Map<string, Document[]>> {
  if (!recordIds.length) return new Map();
  const placeholders = recordIds.map(() => '?').join(', ');
  const [rows] = await getMySqlPool().query<Row[]>(
    `SELECT id, record_id, document_type, file_name, file_size, file_url, upload_date, uploaded_by, version, verification_status, review_remarks
       FROM documents WHERE record_id IN (${placeholders}) ORDER BY upload_date`,
    recordIds,
  );
  return rows.reduce((grouped, row) => {
    const recordId = string(row, 'record_id');
    grouped.set(recordId, [...(grouped.get(recordId) ?? []), mapDocument(row)]);
    return grouped;
  }, new Map<string, Document[]>());
}

/** Reads only the rows allowed by the signed MySQL session and role matrix. */
export async function getMySqlPortalSnapshot(request: Request): Promise<MySqlPortalSnapshot> {
  const masterItems = await loadMasterItems();
  const actor = await getMySqlSessionUser(request);
  if (!actor) return emptySnapshot(masterItems);

  const permissions = getPermissions(actor.role);
  const pool = getMySqlPool();
  const snapshot = emptySnapshot(masterItems);

  if (permissions.manageUsers) {
    const [rows] = await pool.query<Row[]>(
      `SELECT p.id, p.email, p.full_name, p.avatar_url, p.is_active, p.last_login, p.created_at,
              r.name AS role, i.name AS institution
         FROM profiles p JOIN roles r ON r.id = p.role_id LEFT JOIN institutions i ON i.id = p.institution_id
        WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC`,
    );
    snapshot.users = rows.map(mapUser);
  }

  let companyWhere = 'c.deleted_at IS NULL';
  let companyParams: string[] = [];
  if (!permissions.canViewAllExportRecords) {
    if (actor.role === 'exporter') {
      companyWhere += ' AND c.owner_id = ?';
      companyParams = [actor.id];
    } else if (actor.role === 'buyer') {
      companyWhere += " AND c.status = 'approved'";
    } else {
      companyWhere += ' AND 1 = 0';
    }
  }
  const [companyRows] = await pool.query<Row[]>(`SELECT c.* FROM companies c WHERE ${companyWhere} ORDER BY c.created_at DESC`, companyParams);
  snapshot.companies = companyRows.map(mapCompany);

  let exportWhere = 'e.deleted_at IS NULL';
  let exportParams: string[] = [];
  if (!permissions.canViewAllExportRecords) {
    if (permissions.canViewOwnExportRecords) {
      exportWhere += ' AND e.exporter_id = ?';
      exportParams = [actor.id];
    } else {
      exportWhere += ' AND 1 = 0';
    }
  }
  const [exportRows] = await pool.query<Row[]>(`SELECT e.* FROM export_records e WHERE ${exportWhere} ORDER BY e.created_at DESC`, exportParams);
  const documentsByRecord = await queryDocuments(exportRows.map(row => string(row, 'id')));
  snapshot.exportRecords = exportRows.map(row => mapExportRecord(row, documentsByRecord.get(string(row, 'id')) ?? []));

  let complaintWhere = 'c.deleted_at IS NULL';
  let complaintParams: string[] = [];
  if (!permissions.canViewAllComplaints) {
    complaintWhere += ' AND c.email = ?';
    complaintParams = [actor.email];
  }
  const [complaintRows] = await pool.query<Row[]>(
    `SELECT c.*, assignee.full_name AS assigned_officer
       FROM complaints c LEFT JOIN profiles assignee ON assignee.id = c.assigned_officer_id
      WHERE ${complaintWhere} ORDER BY c.created_at DESC`,
    complaintParams,
  );
  snapshot.complaints = complaintRows.map(mapComplaint);

  const [notificationRows] = await pool.query<Row[]>(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [actor.id],
  );
  snapshot.notifications = notificationRows.map(mapNotification);

  if (permissions.viewAuditLogs) {
    const [rows] = await pool.query<Row[]>('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
    snapshot.auditLogs = rows.map(mapAuditLog);
  }

  if (permissions.manageProvinceIntegrations) {
    const [sourceRows, logRows, dataRows] = await Promise.all([
      pool.query<Row[]>('SELECT id, name, province, system_name, api_url, cron_interval, cron_expression, is_active, last_sync_at, last_sync_status, last_sync_records, last_sync_error, total_records_pulled, created_at, updated_at, created_by FROM province_api_sources ORDER BY created_at'),
      pool.query<Row[]>('SELECT * FROM province_sync_logs ORDER BY started_at DESC LIMIT 100'),
      pool.query<Row[]>('SELECT * FROM province_data_records ORDER BY synced_at DESC LIMIT 300'),
    ]);
    snapshot.provinceApiSources = sourceRows[0].map(mapProvinceSource);
    snapshot.provinceSyncLogs = logRows[0].map(mapProvinceSyncLog);
    snapshot.provinceDataRecords = dataRows[0].map(mapProvinceDataRecord);
  }

  return snapshot;
}

async function requireActor(request: Request): Promise<User> {
  const actor = await getMySqlSessionUser(request);
  if (!actor) throw new MySqlPortalError('Authentication is required.', 401);
  return actor;
}

function requirePermission(actor: User, permission: keyof ReturnType<typeof getPermissions>) {
  if (!getPermissions(actor.role)[permission]) throw new MySqlPortalError('You do not have permission to perform this action.', 403);
}

function requiredText(input: Input, field: string): string {
  const value = optionalString(input, field);
  if (!value) throw new MySqlPortalError(`${field} is required.`);
  return value;
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function roleId(connection: PoolConnection, roleName: string): Promise<string> {
  if (!USER_ROLES.has(roleName as UserRole)) throw new MySqlPortalError('The selected role is invalid.');
  const [rows] = await connection.execute<RowDataPacket[]>('SELECT id FROM roles WHERE name = ? LIMIT 1', [roleName]);
  if (!rows[0]?.id) throw new MySqlPortalError('The selected role is unavailable.');
  return String(rows[0].id);
}

async function institutionId(connection: PoolConnection, institutionName: string | undefined): Promise<string | null> {
  if (!institutionName) return null;
  const [rows] = await connection.execute<RowDataPacket[]>('SELECT id FROM institutions WHERE name = ? AND is_active = TRUE LIMIT 1', [institutionName]);
  if (!rows[0]?.id) throw new MySqlPortalError('The selected institution is unavailable.');
  return String(rows[0].id);
}

async function addAudit(
  connection: PoolConnection,
  actor: User,
  action: string,
  module: string,
  recordId: string,
  previousValue?: string,
  newValue?: string,
) {
  await connection.execute(
    `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, module, record_id, previous_value, new_value, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'server')`,
    [randomUUID(), actor.id, actor.full_name, actor.role, action, module, recordId, previousValue ?? null, newValue ?? null],
  );
}

async function notifyUser(connection: PoolConnection, userId: string, title: string, message: string, type: Notification['type'], link: string) {
  await connection.execute(
    'INSERT INTO notifications (id, user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?)',
    [randomUUID(), userId, title, message, type, link],
  );
}

async function notifySuperAdmins(connection: PoolConnection, title: string, message: string, type: Notification['type'], link: string) {
  await connection.execute(
    `INSERT INTO notifications (id, user_id, title, message, type, link)
       SELECT UUID(), p.id, ?, ?, ?, ? FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE r.name = 'super_admin' AND p.is_active = TRUE AND p.deleted_at IS NULL`,
    [title, message, type, link],
  );
}

async function requireOwnedExport(connection: PoolConnection, id: string, actor: User): Promise<Row> {
  const [rows] = await connection.execute<Row[]>('SELECT * FROM export_records WHERE id = ? AND deleted_at IS NULL LIMIT 1', [id]);
  if (!rows[0]) throw new MySqlPortalError('Export record was not found.', 404);
  if (rows[0].exporter_id !== actor.id) throw new MySqlPortalError('You can only modify your own export records.', 403);
  return rows[0];
}

function reviewTransition(status: string, tdap: string, nafsa: string, actor: User, decision: ReviewDecision) {
  const stage = actor.role === 'super_admin'
    ? (tdap !== 'reviewed' && tdap !== 'rejected' ? 'tdap' : 'nafsa')
    : (canReviewStage(actor.role, 'tdap') ? 'tdap' : canReviewStage(actor.role, 'nafsa') ? 'nafsa' : null);
  if (!stage || !canReviewStage(actor.role, stage)) throw new MySqlPortalError('You cannot review this application.', 403);

  let nextStatus = status;
  let nextTdap = tdap;
  let nextNafsa = nafsa;
  if (decision === 'approve') {
    if (stage === 'tdap') {
      nextTdap = 'reviewed'; nextNafsa = 'pending'; nextStatus = 'under_nafsa_review';
    } else {
      nextNafsa = 'reviewed'; nextStatus = 'approved';
    }
  } else if (decision === 'reject') {
    nextStatus = 'rejected';
    if (stage === 'tdap') nextTdap = 'rejected'; else nextNafsa = 'rejected';
  } else {
    nextStatus = 'additional_info_required';
    if (stage === 'tdap') nextTdap = 'info_requested'; else nextNafsa = 'info_requested';
  }
  return { stage, nextStatus, nextTdap, nextNafsa };
}

async function createUser(actor: User, input: Input) {
  requirePermission(actor, 'manageUsers');
  const fullName = requiredText(input, 'full_name');
  const email = requiredText(input, 'email').toLowerCase();
  const role = requiredText(input, 'role');
  const password = requiredText(input, 'password');
  if (!validEmail(email)) throw new MySqlPortalError('A valid email is required.');
  if (password.length < 12) throw new MySqlPortalError('Temporary passwords must contain at least 12 characters.');

  await withMySqlTransaction(async connection => {
    const [duplicate] = await connection.execute<RowDataPacket[]>('SELECT id FROM profiles WHERE email = ? LIMIT 1', [email]);
    if (duplicate.length) throw new MySqlPortalError('An account with this email already exists.');
    const resolvedRoleId = await roleId(connection, role);
    const resolvedInstitutionId = await institutionId(connection, optionalString(input, 'institution'));
    await connection.execute(
      'INSERT INTO profiles (id, email, full_name, password_hash, role_id, institution_id, is_active) VALUES (?, ?, ?, ?, ?, ?, TRUE)',
      [randomUUID(), email, fullName, await hashPassword(password), resolvedRoleId, resolvedInstitutionId],
    );
    await addAudit(connection, actor, 'Create User', 'User Management', email, undefined, `${fullName} (${role})`);
  });
}

async function updateUser(actor: User, input: Input) {
  requirePermission(actor, 'manageUsers');
  const id = requiredText(input, 'id');
  if (id === actor.id && input.is_active === false) throw new MySqlPortalError('You cannot deactivate your own account.');

  await withMySqlTransaction(async connection => {
    const fields: string[] = [];
    const params: unknown[] = [];
    if (input.full_name !== undefined) { fields.push('full_name = ?'); params.push(requiredText(input, 'full_name')); }
    if (input.email !== undefined) {
      const email = requiredText(input, 'email').toLowerCase();
      if (!validEmail(email)) throw new MySqlPortalError('A valid email is required.');
      fields.push('email = ?'); params.push(email);
    }
    if (typeof input.is_active === 'boolean') { fields.push('is_active = ?'); params.push(input.is_active); }
    if (input.role !== undefined) { fields.push('role_id = ?'); params.push(await roleId(connection, requiredText(input, 'role'))); }
    if (input.institution !== undefined) { fields.push('institution_id = ?'); params.push(await institutionId(connection, optionalString(input, 'institution'))); }
    if (!fields.length) throw new MySqlPortalError('No supported profile fields were supplied.');
    const [result] = await connection.execute(`UPDATE profiles SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, sqlValues([...params, id]));
    if (!affectedRows(result)) throw new MySqlPortalError('User was not found.', 404);
    await addAudit(connection, actor, 'Update User', 'User Management', id, undefined, JSON.stringify(input).slice(0, 200));
  });
}

async function deleteUser(actor: User, input: Input) {
  requirePermission(actor, 'manageUsers');
  const id = requiredText(input, 'id');
  if (id === actor.id) throw new MySqlPortalError('You cannot delete your own account.');
  await withMySqlTransaction(async connection => {
    const [result] = await connection.execute('UPDATE profiles SET is_active = FALSE, deleted_at = UTC_TIMESTAMP(3) WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!affectedRows(result)) throw new MySqlPortalError('User was not found.', 404);
    await addAudit(connection, actor, 'Delete User', 'User Management', id);
  });
}

async function reviewRegistration(actor: User, input: Input) {
  const id = requiredText(input, 'id');
  const decision = requiredText(input, 'decision') as ReviewDecision;
  if (!['approve', 'reject', 'request_info'].includes(decision)) throw new MySqlPortalError('The review decision is invalid.');
  const remarks = optionalString(input, 'remarks');
  await withMySqlTransaction(async connection => {
    const [rows] = await connection.execute<Row[]>('SELECT * FROM companies WHERE id = ? AND deleted_at IS NULL LIMIT 1', [id]);
    const company = rows[0];
    if (!company) throw new MySqlPortalError('Registration was not found.', 404);
    const review = reviewTransition(string(company, 'status'), string(company, 'tdap_review_status'), string(company, 'nafsa_review_status'), actor, decision);
    const verification = review.stage === 'nafsa' && decision === 'approve' ? ['verified', 'verified', 'verified'] : [string(company, 'nadra_status'), string(company, 'secp_status'), string(company, 'ntn_status')];
    await connection.execute(
      `UPDATE companies SET status = ?, tdap_review_status = ?, nafsa_review_status = ?, nadra_status = ?, secp_status = ?, ntn_status = ?, updated_by = ? WHERE id = ?`,
      [review.nextStatus, review.nextTdap, review.nextNafsa, ...verification, actor.id, id],
    );
    const label = review.stage.toUpperCase();
    const title = decision === 'approve' && review.stage === 'tdap' ? 'TDAP Review Passed'
      : decision === 'approve' ? 'Registration Approved'
        : decision === 'reject' ? `Registration Rejected (${label})` : `Additional Information Required (${label})`;
    const message = decision === 'approve' && review.stage === 'tdap'
      ? `Your registration ${string(company, 'registration_number')} has moved to NAFSA review.`
      : decision === 'approve' ? `Your registration ${string(company, 'registration_number')} has been approved.`
        : `${label} updated registration ${string(company, 'registration_number')}.${remarks ? ` Details: ${remarks}` : ''}`;
    await notifyUser(connection, string(company, 'owner_id'), title, message, decision === 'approve' ? 'success' : decision === 'reject' ? 'error' : 'warning', '/dashboard');
    await addAudit(connection, actor, `${decision} (${label})`, 'Registration', string(company, 'registration_number'), string(company, 'status'), review.nextStatus);
  });
}

async function resubmitRegistration(actor: User, input: Input) {
  const id = requiredText(input, 'id');
  const patch = asInput(input.patch);
  await withMySqlTransaction(async connection => {
    const [rows] = await connection.execute<Row[]>('SELECT * FROM companies WHERE id = ? AND deleted_at IS NULL LIMIT 1', [id]);
    const company = rows[0];
    if (!company) throw new MySqlPortalError('Registration was not found.', 404);
    if (string(company, 'owner_id') !== actor.id && actor.role !== 'super_admin') throw new MySqlPortalError('Only the company owner can resubmit this registration.', 403);
    if (!['additional_info_required', 'rejected', 'draft'].includes(string(company, 'status'))) throw new MySqlPortalError('Only returned or draft registrations can be resubmitted.');
    const allowed = ['legal_name', 'trading_name', 'company_type', 'ntn', 'secp_number', 'registration_date', 'address', 'province', 'district', 'city', 'website', 'email', 'phone', 'nature_of_business', 'main_export_categories'];
    const fields: string[] = ["status = 'submitted'", "tdap_review_status = 'pending'", "nafsa_review_status = 'not_initiated'"];
    const values: unknown[] = [];
    for (const field of allowed) {
      if (patch[field] === undefined) continue;
      fields.push(`${field} = ?`);
      values.push(field === 'main_export_categories' ? JSON.stringify(Array.isArray(patch[field]) ? patch[field] : []) : (patch[field] === '' ? null : patch[field]));
    }
    await connection.execute(`UPDATE companies SET ${fields.join(', ')}, updated_by = ? WHERE id = ?`, sqlValues([...values, actor.id, id]));
    await notifySuperAdmins(connection, 'Registration Resubmitted', `${string(company, 'legal_name')} (${string(company, 'registration_number')}) has resubmitted its registration for review.`, 'info', '/admin/reviews');
    await addAudit(connection, actor, 'Resubmit Registration', 'Registration', string(company, 'registration_number'), string(company, 'status'), 'submitted');
  });
}

function exportFields(input: Input): { fields: string[]; values: unknown[] } {
  const fields: string[] = [];
  const values: unknown[] = [];
  const allowed = [
    'product', 'product_category', 'hs_code', 'description', 'quantity', 'unit', 'estimated_value', 'currency',
    'province_of_production', 'district_of_production', 'crop_year', 'batch_number', 'packaging_type', 'num_packages',
    'intended_shipment_date', 'buyer_name', 'buyer_company', 'buyer_country', 'buyer_address', 'buyer_contact',
    'buyer_email', 'buyer_phone', 'purchase_order', 'destination_country', 'destination_port', 'port_of_departure',
    'transport_mode', 'shipping_company', 'container_number', 'bill_of_lading', 'expected_departure', 'expected_arrival', 'status',
  ];
  for (const name of allowed) {
    if (input[name] === undefined) continue;
    const value = input[name];
    const isDate = ['intended_shipment_date', 'expected_departure', 'expected_arrival'].includes(name);
    fields.push(`${name} = ?`);
    values.push(isDate && !String(value).trim() ? null : value);
  }
  return { fields, values };
}

async function createExportRecord(actor: User, input: Input) {
  requirePermission(actor, 'canCreateExportRecord');
  await withMySqlTransaction(async connection => {
    const companyId = optionalString(input, 'company_id');
    const [companies] = await connection.execute<Row[]>(
      `SELECT id FROM companies WHERE owner_id = ? AND deleted_at IS NULL${companyId ? ' AND id = ?' : ''} ORDER BY created_at LIMIT 1`,
      companyId ? [actor.id, companyId] : [actor.id],
    );
    if (!companies[0]?.id) throw new MySqlPortalError('An active company registration is required before adding export records.');
    const id = randomUUID();
    const consignment = `EXP-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const fields = exportFields(input);
    const columns = ['id', 'consignment_number', 'exporter_id', 'company_id', 'product', 'product_category', 'hs_code', 'description', 'quantity', 'unit', 'estimated_value', 'currency', 'country_of_origin', 'province_of_production', 'district_of_production', 'batch_number', 'packaging_type', 'num_packages', 'status', 'created_by', 'updated_by'];
    const values: unknown[] = [
      id, consignment, actor.id, companies[0].id, string(input, 'product'), string(input, 'product_category', 'Other Agricultural'),
      string(input, 'hs_code', '9999.99'), string(input, 'description'), number(input, 'quantity'), string(input, 'unit', 'Metric Tons'),
      number(input, 'estimated_value'), string(input, 'currency', 'USD'), 'Pakistan', string(input, 'province_of_production', 'Punjab'),
      string(input, 'district_of_production'), string(input, 'batch_number'), string(input, 'packaging_type', 'Carton Boxes'),
      number(input, 'num_packages'), string(input, 'status', 'submitted'), actor.id, actor.id,
    ];
    for (const assignment of fields.fields) {
      const name = assignment.slice(0, assignment.indexOf(' '));
      const index = columns.indexOf(name);
      if (index >= 0) values[index] = fields.values[fields.fields.indexOf(assignment)];
      else { columns.push(name); values.push(fields.values[fields.fields.indexOf(assignment)]); }
    }
    await connection.execute(`INSERT INTO export_records (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, sqlValues(values));
    const documents = Array.isArray(input.documents) ? input.documents.map(asInput) : [];
    for (const document of documents) {
      const fileName = optionalString(document, 'file_name');
      const fileUrl = optionalString(document, 'file_url');
      const documentType = optionalString(document, 'document_type');
      if (!fileName || !fileUrl || !documentType) continue;
      await connection.execute(
        `INSERT INTO documents (id, record_id, company_id, document_type, file_name, file_size, file_url, uploaded_by, version, verification_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), id, companies[0].id, documentType, fileName, number(document, 'file_size'), fileUrl, actor.id, number(document, 'version', 1), string(document, 'verification_status', 'pending')],
      );
    }
    await notifyUser(connection, actor.id, 'Export Record Submitted', `Your export record ${consignment} has been submitted for review.`, 'info', '/dashboard/exports');
    await addAudit(connection, actor, 'Create Record', 'Export Records', consignment, undefined, `${string(input, 'product')} → ${string(input, 'destination_country')}`);
  });
}

async function updateExportRecord(actor: User, input: Input) {
  const id = requiredText(input, 'id');
  const patch = asInput(input.patch);
  await withMySqlTransaction(async connection => {
    const record = await requireOwnedExport(connection, id, actor);
    const fields = exportFields(patch);
    if (!fields.fields.length) throw new MySqlPortalError('No supported export fields were supplied.');
    if (patch.status === 'submitted' && string(record, 'status') !== 'submitted') {
      fields.fields.push("tdap_review_status = 'pending'", "nafsa_review_status = 'not_initiated'");
    }
    await connection.execute(`UPDATE export_records SET ${fields.fields.join(', ')}, updated_by = ? WHERE id = ?`, sqlValues([...fields.values, actor.id, id]));
    await notifyUser(connection, actor.id, 'Export Record Updated', `Your export record ${string(record, 'consignment_number')} has been updated.`, 'info', '/dashboard/exports');
    await addAudit(connection, actor, 'Update Record', 'Export Records', string(record, 'consignment_number'), undefined, JSON.stringify(patch).slice(0, 200));
  });
}

async function deleteExportRecord(actor: User, input: Input) {
  const id = requiredText(input, 'id');
  await withMySqlTransaction(async connection => {
    const record = await requireOwnedExport(connection, id, actor);
    await connection.execute('UPDATE export_records SET deleted_at = UTC_TIMESTAMP(3), updated_by = ? WHERE id = ?', [actor.id, id]);
    await addAudit(connection, actor, 'Delete Record', 'Export Records', string(record, 'consignment_number'));
  });
}

async function reviewExportRecord(actor: User, input: Input) {
  const id = requiredText(input, 'id');
  const decision = requiredText(input, 'decision') as ReviewDecision;
  if (!['approve', 'reject', 'request_info'].includes(decision)) throw new MySqlPortalError('The review decision is invalid.');
  const remarks = optionalString(input, 'remarks');
  await withMySqlTransaction(async connection => {
    const [rows] = await connection.execute<Row[]>('SELECT * FROM export_records WHERE id = ? AND deleted_at IS NULL LIMIT 1', [id]);
    const record = rows[0];
    if (!record) throw new MySqlPortalError('Export record was not found.', 404);
    const review = reviewTransition(string(record, 'status'), string(record, 'tdap_review_status', 'pending'), string(record, 'nafsa_review_status', 'not_initiated'), actor, decision);
    const reviewer = review.stage === 'tdap' ? 'tdap_reviewer_id' : 'nafsa_reviewer_id';
    const reviewedAt = review.stage === 'tdap' ? 'tdap_review_date' : 'nafsa_review_date';
    const reviewRemarks = review.stage === 'tdap' ? 'tdap_remarks' : 'nafsa_remarks';
    await connection.execute(
      `UPDATE export_records SET status = ?, tdap_review_status = ?, nafsa_review_status = ?, ${reviewer} = ?, ${reviewedAt} = UTC_TIMESTAMP(3), ${reviewRemarks} = ?, updated_by = ? WHERE id = ?`,
      [review.nextStatus, review.nextTdap, review.nextNafsa, actor.id, remarks ?? null, actor.id, id],
    );
    const label = review.stage.toUpperCase();
    await notifyUser(connection, string(record, 'exporter_id'), decision === 'approve' ? `Export Record ${label} Review Updated` : `Export Record ${label} Review Requires Action`, `Export record ${string(record, 'consignment_number')} is now ${review.nextStatus.replaceAll('_', ' ')}.${remarks ? ` Details: ${remarks}` : ''}`, decision === 'approve' ? 'success' : decision === 'reject' ? 'error' : 'warning', '/dashboard/exports');
    await addAudit(connection, actor, `${decision} (${label})`, 'Export Records', string(record, 'consignment_number'), string(record, 'status'), review.nextStatus);
  });
}

async function complaintForAction(connection: PoolConnection, id: string): Promise<Row> {
  const [rows] = await connection.execute<Row[]>('SELECT * FROM complaints WHERE id = ? AND deleted_at IS NULL LIMIT 1', [id]);
  if (!rows[0]) throw new MySqlPortalError('Complaint was not found.', 404);
  return rows[0];
}

async function resolveComplaint(actor: User, input: Input) {
  requirePermission(actor, 'canResolveComplaint');
  const id = requiredText(input, 'id');
  const resolution = requiredText(input, 'resolution_summary');
  await withMySqlTransaction(async connection => {
    const complaint = await complaintForAction(connection, id);
    await connection.execute("UPDATE complaints SET status = 'resolved', resolution_summary = ?, resolved_at = UTC_TIMESTAMP(3), updated_by = ? WHERE id = ?", [resolution, actor.id, id]);
    await notifySuperAdmins(connection, 'Complaint Resolved', `Complaint ${string(complaint, 'tracking_number')} has been resolved.`, 'success', '/admin/reviews');
    await addAudit(connection, actor, 'Resolve Complaint', 'Complaints', string(complaint, 'tracking_number'), string(complaint, 'status'), 'resolved');
  });
}

async function escalateComplaint(actor: User, input: Input) {
  requirePermission(actor, 'canEscalateComplaint');
  const id = requiredText(input, 'id');
  await withMySqlTransaction(async connection => {
    const complaint = await complaintForAction(connection, id);
    const level = number(complaint, 'escalation_level') + 1;
    await connection.execute("UPDATE complaints SET status = 'escalated', escalation_level = ?, updated_by = ? WHERE id = ?", [level, actor.id, id]);
    await notifySuperAdmins(connection, 'Complaint Escalated', `Complaint ${string(complaint, 'tracking_number')} was escalated to level ${level}.`, 'warning', '/admin/reviews');
    await addAudit(connection, actor, 'Escalate Complaint', 'Complaints', string(complaint, 'tracking_number'), string(complaint, 'status'), 'escalated');
  });
}

async function addComplaintNote(actor: User, input: Input) {
  requirePermission(actor, 'canAddComplaintNote');
  const id = requiredText(input, 'id');
  const note = requiredText(input, 'note');
  await withMySqlTransaction(async connection => {
    const complaint = await complaintForAction(connection, id);
    const entry = `[${new Date().toISOString()}] ${actor.full_name}: ${note}`;
    const notes = optionalString(complaint, 'internal_notes');
    await connection.execute('UPDATE complaints SET internal_notes = ?, updated_by = ? WHERE id = ?', [notes ? `${notes}\n${entry}` : entry, actor.id, id]);
    await connection.execute('INSERT INTO complaint_comments (id, complaint_id, user_id, comment, is_internal) VALUES (?, ?, ?, ?, TRUE)', [randomUUID(), id, actor.id, note]);
    await addAudit(connection, actor, 'Add Note', 'Complaints', string(complaint, 'tracking_number'), undefined, note.slice(0, 200));
  });
}

async function updateComplaint(actor: User, input: Input) {
  requirePermission(actor, 'canResolveComplaint');
  const id = requiredText(input, 'id');
  const patch = asInput(input.patch);
  const allowed = ['status', 'priority', 'assigned_officer_id', 'public_response', 'internal_notes'];
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const field of allowed) {
    if (patch[field] !== undefined) { fields.push(`${field} = ?`); values.push(patch[field] || null); }
  }
  if (!fields.length) throw new MySqlPortalError('No supported complaint fields were supplied.');
  await withMySqlTransaction(async connection => {
    const complaint = await complaintForAction(connection, id);
    await connection.execute(`UPDATE complaints SET ${fields.join(', ')}, updated_by = ? WHERE id = ?`, sqlValues([...values, actor.id, id]));
    await addAudit(connection, actor, 'Update Complaint', 'Complaints', string(complaint, 'tracking_number'), undefined, JSON.stringify(patch).slice(0, 200));
  });
}

async function changeMasterItem(actor: User, input: Input, action: 'create' | 'update' | 'delete') {
  requirePermission(actor, 'manageMasterData');
  const category = requiredText(input, 'category') as MasterCategory;
  if (!MASTER_CATEGORIES.includes(category) || category === 'roles' || category === 'institutions') throw new MySqlPortalError('This master-data category cannot be changed here.');
  const value = requiredText(input, 'value');
  await withMySqlTransaction(async connection => {
    if (action === 'create') {
      await connection.execute('INSERT INTO master_data (id, category, name) VALUES (?, ?, ?)', [randomUUID(), category, value]);
      await addAudit(connection, actor, 'Add Master Data Item', 'Master Data', category, undefined, value);
    } else {
      const old = requiredText(input, 'old_value');
      if (action === 'update') {
        const [result] = await connection.execute('UPDATE master_data SET name = ? WHERE category = ? AND name = ?', [value, category, old]);
        if (!affectedRows(result)) throw new MySqlPortalError('Master-data item was not found.', 404);
        await addAudit(connection, actor, 'Update Master Data Item', 'Master Data', category, old, value);
      } else {
        const [result] = await connection.execute('DELETE FROM master_data WHERE category = ? AND name = ?', [category, old]);
        if (!affectedRows(result)) throw new MySqlPortalError('Master-data item was not found.', 404);
        await addAudit(connection, actor, 'Delete Master Data Item', 'Master Data', category, old);
      }
    }
  });
}

async function changeProvinceSource(actor: User, input: Input, action: 'create' | 'update' | 'delete') {
  requirePermission(actor, 'manageProvinceIntegrations');
  await withMySqlTransaction(async connection => {
    if (action === 'create') {
      const id = randomUUID();
      await connection.execute(
        `INSERT INTO province_api_sources (id, name, province, system_name, api_url, api_key, cron_interval, cron_expression, is_active, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, requiredText(input, 'name'), requiredText(input, 'province'), optionalString(input, 'system_name') ?? null,
          requiredText(input, 'api_url'), optionalString(input, 'api_key') ?? null, string(input, 'cron_interval', 'daily'),
          optionalString(input, 'cron_expression') ?? null, input.is_active !== false, actor.id],
      );
      await addAudit(connection, actor, 'Create API Source', 'Province Integrations', id, undefined, `${string(input, 'name')} (${string(input, 'province')})`);
      return;
    }
    const id = requiredText(input, 'id');
    if (action === 'delete') {
      const [result] = await connection.execute('DELETE FROM province_api_sources WHERE id = ?', [id]);
      if (!affectedRows(result)) throw new MySqlPortalError('Province API source was not found.', 404);
      await addAudit(connection, actor, 'Delete API Source', 'Province Integrations', id);
      return;
    }
    const patch = asInput(input.patch);
    const allowed = ['name', 'province', 'system_name', 'api_url', 'api_key', 'cron_interval', 'cron_expression', 'is_active'];
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const field of allowed) {
      if (patch[field] === undefined) continue;
      fields.push(`${field} = ?`);
      values.push(patch[field] === '' && ['system_name', 'api_key', 'cron_expression'].includes(field) ? null : patch[field]);
    }
    if (!fields.length) throw new MySqlPortalError('No supported API source fields were supplied.');
    const [result] = await connection.execute(`UPDATE province_api_sources SET ${fields.join(', ')} WHERE id = ?`, sqlValues([...values, id]));
    if (!affectedRows(result)) throw new MySqlPortalError('Province API source was not found.', 404);
    await addAudit(connection, actor, 'Update API Source', 'Province Integrations', id, undefined, JSON.stringify(patch).slice(0, 200));
  });
}

async function markNotificationsRead(actor: User) {
  await getMySqlPool().execute('UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE', [actor.id]);
}

/** Executes one server-authorized mutation. Raw SQL is never exposed to clients. */
export async function executeMySqlPortalOperation(request: Request, operation: string, payload: unknown) {
  const actor = await requireActor(request);
  const input = asInput(payload);
  switch (operation) {
    case 'create_user': return createUser(actor, input);
    case 'update_user': return updateUser(actor, input);
    case 'delete_user': return deleteUser(actor, input);
    case 'review_registration': return reviewRegistration(actor, input);
    case 'resubmit_registration': return resubmitRegistration(actor, input);
    case 'create_export_record': return createExportRecord(actor, input);
    case 'update_export_record': return updateExportRecord(actor, input);
    case 'delete_export_record': return deleteExportRecord(actor, input);
    case 'review_export_record': return reviewExportRecord(actor, input);
    case 'update_complaint': return updateComplaint(actor, input);
    case 'resolve_complaint': return resolveComplaint(actor, input);
    case 'escalate_complaint': return escalateComplaint(actor, input);
    case 'add_complaint_note': return addComplaintNote(actor, input);
    case 'create_master_item': return changeMasterItem(actor, input, 'create');
    case 'update_master_item': return changeMasterItem(actor, input, 'update');
    case 'delete_master_item': return changeMasterItem(actor, input, 'delete');
    case 'create_province_source': return changeProvinceSource(actor, input, 'create');
    case 'update_province_source': return changeProvinceSource(actor, input, 'update');
    case 'delete_province_source': return changeProvinceSource(actor, input, 'delete');
    case 'mark_notifications_read': return markNotificationsRead(actor);
    default: throw new MySqlPortalError('The requested portal operation is not supported.', 400);
  }
}
