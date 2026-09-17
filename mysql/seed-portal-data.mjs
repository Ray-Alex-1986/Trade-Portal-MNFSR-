import { randomUUID, randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { getDatabaseUrl, loadDotEnv } from './load-env.mjs';

loadDotEnv();

const scrypt = promisify(scryptCallback);
const DEMO_PASSWORD = 'Demo@12345';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PRODUCTS = [
  'Basmati Rice', 'Mango (Chaunsa)', 'Mango (Sindhri)', 'Kinnow', 'Dates (Aseel)',
  'Sesame Seeds', 'Maize', 'Potatoes', 'Onions', 'Beef Meat', 'Seafood (Shrimp)',
  'Olive Oil', 'Citrus Fruits', 'Red Chili', 'Cotton',
];
const COUNTRIES = [
  'China', 'United Arab Emirates', 'Saudi Arabia', 'United Kingdom', 'Malaysia',
  'Indonesia', 'Qatar', 'Oman', 'Germany', 'Kazakhstan', 'Afghanistan', 'Turkey',
  'South Africa', 'United States', 'Japan',
];
const PROVINCES = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Gilgit-Baltistan', 'Islamabad Capital Territory'];
const DISTRICTS = {
  Punjab: ['Lahore', 'Faisalabad', 'Multan', 'Rawalpindi', 'Sialkot', 'Gujranwala', 'Sargodha'],
  Sindh: ['Karachi', 'Hyderabad', 'Sukkur', 'Larkana', 'Mirpur Khas'],
  'Khyber Pakhtunkhwa': ['Peshawar', 'Abbottabad', 'Mardan', 'Swat', 'Nowshera'],
  Balochistan: ['Quetta', 'Gwadar', 'Turbat', 'Khuzdar'],
  'Gilgit-Baltistan': ['Gilgit', 'Skardu', 'Hunza'],
  'Islamabad Capital Territory': ['Islamabad'],
};
const PORTS = ['Karachi Port', 'Port Qasim', 'Gwadar Port', 'Lahore Dry Port', 'Sialkot Dry Port', 'Islamabad Dry Port'];
const HS_CODES = {
  'Basmati Rice': '1006.30', 'Mango (Chaunsa)': '0804.50', 'Mango (Sindhri)': '0804.50', Kinnow: '0805.10',
  'Dates (Aseel)': '0804.10', 'Sesame Seeds': '1207.40', Maize: '1005.90', Potatoes: '0701.90',
  Onions: '0703.10', 'Beef Meat': '0201.30', 'Seafood (Shrimp)': '0306.17', 'Olive Oil': '1509.10',
  'Citrus Fruits': '0805.90', 'Red Chili': '0904.11', Cotton: '5201.00',
};
const COMPANY_NAMES = [
  'Pak Rice Exports (Pvt) Ltd', 'Al-Noor Trading Corporation', 'Green Valley Agro Exports', 'Sindh Fruit Company',
  'Punjab Grain Traders', 'Karachi Seafood International', 'Ravi Agro Industries', 'Chenab Exports Pvt Ltd',
  'Indus Valley Foods', 'Khyber Trade Corporation', 'Balochistan Dates Company', 'Hunza Organic Exports',
  'National Agri-Trade Pakistan', 'Crescent Foods International', 'Pak-Oman Trading Company', 'Heritage Rice Mills',
  'Golden Harvest Agro', 'Al-Barakah Exports', 'Sialkot Foods & Trading', 'Multan Mango Exports',
  'Faisalabad Grain Company', 'Lahore Spice Traders', 'Gujranwala Agro Mills', 'Quetta Dry Fruits Co',
  'Swat Valley Organics', 'Thatta Seafood Exports', 'DG Khan Agro Industries', 'Peshawar Spice Company',
  'Mirpur Citrus Farms', 'Sukkur Dates Trading', 'Bahawalpur Cotton Traders', 'Sahiwal Dairy Exports',
  'Attock Olive Growers', 'Kasur Chili Processors', 'Okara Potato Exports', 'Jhang Maize Mills',
  'Chiniot Wood & Agro', 'Vehari Grain House', 'Muzaffargarh Agro Co', 'Layyah Sesame Traders',
];
const COMPLAINT_CATEGORIES = [
  'Product quality issue', 'SPS compliance issue', 'Quantity discrepancy', 'Packaging issue',
  'Documentation issue', 'Shipment delay', 'Payment dispute', 'Misrepresentation',
  'Exporter conduct', 'Inspection issue', 'Regulatory issue', 'Other',
];
const DOC_TYPES = ['DDP SPS Certificate', 'Pre-Shipment Inspection (PSI) Report', 'Commercial Invoice', 'Packing List', 'Certificate of Origin'];

const EXTRA_EXPORTERS = [
  { email: 'exporter2@greenvalley.pk', full_name: 'Bilal Ahmed', role: 'exporter' },
  { email: 'exporter3@sindhfruit.pk', full_name: 'Sara Qureshi', role: 'exporter' },
  { email: 'exporter4@punjabgrain.pk', full_name: 'Usman Tariq', role: 'exporter' },
  { email: 'exporter5@karachiseafood.pk', full_name: 'Nadia Iqbal', role: 'exporter' },
];

const COMPANY_STATUSES = [
  'approved', 'approved', 'approved', 'approved', 'approved', 'approved',
  'submitted', 'under_tdap_review', 'under_nafsa_review', 'additional_info_required', 'rejected', 'draft',
];
const EXPORT_STATUSES = [
  'draft', 'submitted', 'under_tdap_review', 'under_nafsa_review', 'approved', 'approved', 'approved',
  'rejected', 'ready_for_shipment', 'shipped', 'delivered', 'closed',
];
const COMPLAINT_STATUSES = [
  'submitted', 'acknowledged', 'under_review', 'assigned', 'investigation',
  'escalated', 'resolved', 'closed', 'resolved', 'resolved',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function num(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pad(n, width = 2) {
  return String(n).padStart(width, '0');
}
function mysqlDateTime(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
}
function mysqlDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
function reviewForCompany(status) {
  switch (status) {
    case 'approved':
    case 'verified':
      return { tdap: 'reviewed', nafsa: 'reviewed' };
    case 'submitted':
    case 'under_tdap_review':
      return { tdap: 'pending', nafsa: 'not_initiated' };
    case 'under_nafsa_review':
      return { tdap: 'reviewed', nafsa: 'pending' };
    case 'additional_info_required':
      return { tdap: 'info_requested', nafsa: 'not_initiated' };
    case 'rejected':
      return { tdap: 'rejected', nafsa: 'not_initiated' };
    default:
      return { tdap: 'not_initiated', nafsa: 'not_initiated' };
  }
}
function reviewForExport(status) {
  if (['submitted', 'under_tdap_review', 'additional_info_required'].includes(status)) {
    return { tdap: 'pending', nafsa: 'not_initiated' };
  }
  if (status === 'under_nafsa_review') return { tdap: 'reviewed', nafsa: 'pending' };
  if (['approved', 'ready_for_shipment', 'shipped', 'delivered', 'closed'].includes(status)) {
    return { tdap: 'reviewed', nafsa: 'reviewed' };
  }
  if (status === 'rejected') return { tdap: 'rejected', nafsa: 'not_initiated' };
  return { tdap: null, nafsa: null };
}
function productCategory(product) {
  if (product.includes('Rice')) return 'Cereals';
  if (product.includes('Mango') || product.includes('Citrus') || product.includes('Kinnow')) return 'Fruits';
  if (product.includes('Potato') || product.includes('Onion')) return 'Vegetables';
  if (product.includes('Meat') || product.includes('Seafood')) return 'Meat & Seafood';
  return 'Other Agricultural';
}
async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

// Ensure demo accounts exist first.
{
  const result = spawnSync(process.execPath, [resolve(root, 'mysql/seed-demo-users.mjs')], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const databaseUrl = new URL(getDatabaseUrl());
const pool = mysql.createPool({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || '3306'),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: decodeURIComponent(databaseUrl.pathname.slice(1)),
  ssl: databaseUrl.protocol === 'mysqls:' || process.env.MYSQL_SSL === 'true'
    ? { rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined,
});

const connection = await pool.getConnection();
try {
  await connection.beginTransaction();

  console.log('Clearing transactional demo tables…');
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of [
    'province_data_records', 'province_sync_logs', 'province_api_sources',
    'complaint_attachments', 'complaint_comments', 'complaints',
    'documents', 'export_records', 'companies',
    'notifications', 'audit_logs',
  ]) {
    await connection.query(`TRUNCATE TABLE \`${table}\``);
  }
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const [roleRows] = await connection.execute('SELECT id, name FROM roles');
  const roleByName = Object.fromEntries(roleRows.map(row => [row.name, row.id]));

  // Extra exporters so company ownership is spread across accounts.
  for (const user of EXTRA_EXPORTERS) {
    const [existing] = await connection.execute('SELECT id FROM profiles WHERE email = ? LIMIT 1', [user.email]);
    if (existing.length) continue;
    await connection.execute(
      `INSERT INTO profiles (id, email, full_name, password_hash, role_id, is_active)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [randomUUID(), user.email, user.full_name, passwordHash, roleByName.exporter],
    );
  }

  const [profileRows] = await connection.execute(
    `SELECT p.id, p.email, p.full_name, r.name AS role
       FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.deleted_at IS NULL AND p.is_active = TRUE`,
  );
  const byEmail = Object.fromEntries(profileRows.map(row => [row.email, row]));
  const exporters = profileRows.filter(row => row.role === 'exporter');
  const officers = profileRows.filter(row => ['tdap_admin', 'tdap_officer', 'nafsa_admin', 'nafsa_officer', 'tic'].includes(row.role));
  const allUsers = profileRows;

  if (!exporters.length) throw new Error('No exporter profiles found. Run db:seed-demo first.');

  console.log(`Seeding companies for ${exporters.length} exporters…`);
  const companies = [];
  for (let i = 0; i < COMPANY_NAMES.length; i += 1) {
    const name = COMPANY_NAMES[i];
    const owner = exporters[i % exporters.length];
    const status = COMPANY_STATUSES[i % COMPANY_STATUSES.length];
    const review = reviewForCompany(status);
    const province = PROVINCES[i % PROVINCES.length];
    const district = pick(DISTRICTS[province]);
    const id = randomUUID();
    const created = randomDate(new Date('2025-01-01'), new Date('2026-06-30'));
    const updated = randomDate(new Date('2026-07-01'), new Date());
    const slug = name.toLowerCase().replace(/[^a-z]/g, '');
    await connection.execute(
      `INSERT INTO companies (
        id, owner_id, legal_name, trading_name, company_type, ntn, secp_number, registration_date,
        address, province, district, city, website, email, phone, nature_of_business,
        main_export_categories, registration_number, status, tdap_review_status, nafsa_review_status,
        nadra_status, secp_status, ntn_status, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, owner.id, name, i % 3 === 0 ? name.replace(' (Pvt) Ltd', '').replace(' Pvt Ltd', '') : null,
        pick(['Private Limited', 'Sole Proprietor', 'Partnership', 'Public Limited']),
        `${num(1000000, 9999999)}-${num(1, 9)}`, String(num(100000, 999999)),
        mysqlDate(randomDate(new Date('2018-01-01'), new Date('2024-12-31'))),
        `${num(1, 500)}, ${pick(['Main Boulevard', 'Commercial Area', 'Industrial Zone', 'GT Road'])}, ${district}`,
        province, district, district,
        i % 2 === 0 ? `https://www.${slug}.pk` : null,
        `info@${slug}.pk`, `+92-${num(300, 349)}-${num(1000000, 9999999)}`,
        pick(['Agricultural Export', 'Food Processing & Export', 'Trading & Export', 'Agro-Industrial Export']),
        JSON.stringify([PRODUCTS[i % PRODUCTS.length], PRODUCTS[(i + 3) % PRODUCTS.length]]),
        `REG-${2024001 + i}`, status, review.tdap, review.nafsa,
        'verified', i % 5 === 0 ? 'pending' : 'verified', 'verified',
        owner.id, owner.id, mysqlDateTime(created), mysqlDateTime(updated),
      ],
    );
    companies.push({ id, owner_id: owner.id, legal_name: name, registration_number: `REG-${2024001 + i}`, status });
  }

  const approvedCompanies = companies.filter(company => company.status === 'approved');
  const exportCompanies = approvedCompanies.length ? approvedCompanies : companies;

  console.log('Seeding export records + documents…');
  const exportCount = 120;
  const exportRecords = [];
  for (let i = 0; i < exportCount; i += 1) {
    const company = exportCompanies[i % exportCompanies.length];
    const product = PRODUCTS[i % PRODUCTS.length];
    const country = COUNTRIES[i % COUNTRIES.length];
    const status = EXPORT_STATUSES[i % EXPORT_STATUSES.length];
    const review = reviewForExport(status);
    const province = PROVINCES[i % PROVINCES.length];
    const id = randomUUID();
    const created = randomDate(new Date('2025-06-01'), new Date());
    const updated = randomDate(created, new Date());
    const consignment = `EXP-${2025001 + i}`;
    await connection.execute(
      `INSERT INTO export_records (
        id, consignment_number, exporter_id, company_id, product, product_category, hs_code, description,
        quantity, unit, estimated_value, currency, country_of_origin, province_of_production, district_of_production,
        crop_year, batch_number, packaging_type, num_packages, intended_shipment_date,
        buyer_name, buyer_company, buyer_country, buyer_address, buyer_contact, buyer_email, buyer_phone, purchase_order,
        destination_country, destination_port, port_of_departure, transport_mode, shipping_company,
        container_number, bill_of_lading, expected_departure, expected_arrival,
        status, tdap_review_status, nafsa_review_status, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, consignment, company.owner_id, company.id, product, productCategory(product), HS_CODES[product] || '9999.99',
        `Premium quality ${product} for export to ${country}`,
        num(10, 500), pick(['Metric Tons', 'Kilograms', 'Containers']), num(50000, 5000000), pick(['USD', 'PKR', 'EUR', 'GBP']),
        'Pakistan', province, pick(DISTRICTS[province]), num(2024, 2026), `B${num(1000, 9999)}`,
        pick(['Jute Bags', 'Carton Boxes', 'Plastic Crates', 'Vacuum Packed', 'Bulk Container']), num(100, 5000),
        mysqlDate(randomDate(new Date('2026-01-01'), new Date('2026-12-31'))),
        `${pick(['Mohammed', 'Ahmed', 'Chen', 'Wei', 'John'])} ${pick(['Al-Rashid', 'Trading Co', 'Imports Ltd'])}`,
        `${country} ${pick(['Global Trading', 'Import Corp', 'Food Distributors'])}`, country,
        `${num(1, 200)}, Trade Center, ${country}`, `+${num(1, 99)}-${num(100, 999)}-${num(1000000, 9999999)}`,
        `buyer@${country.toLowerCase().replace(/\s/g, '')}import.com`, `+${num(1, 99)}-${num(100, 999)}-${num(1000000, 9999999)}`,
        `PO-${num(10000, 99999)}`, country, pick([`${country} Main Port`, 'Jebel Ali', 'Shanghai Port', 'Southampton']),
        pick(PORTS), pick(['Sea', 'Air', 'Road', 'Rail']), pick(['Maersk', 'MSC', 'CMA CGM', 'Hapag-Lloyd', 'PIA Cargo']),
        `MSCU${num(1000000, 9999999)}`, `BL-${num(100000, 999999)}`,
        mysqlDate(randomDate(new Date('2026-02-01'), new Date('2026-11-30'))),
        mysqlDate(randomDate(new Date('2026-03-01'), new Date('2026-12-31'))),
        status, review.tdap, review.nafsa, company.owner_id, company.owner_id,
        mysqlDateTime(created), mysqlDateTime(updated),
      ],
    );
    exportRecords.push({ id, consignment_number: consignment, company_id: company.id, owner_id: company.owner_id });

    for (const docType of DOC_TYPES.slice(0, 2 + (i % 3))) {
      await connection.execute(
        `INSERT INTO documents (
          id, record_id, company_id, document_type, file_name, file_size, file_url, uploaded_by, version, verification_status, upload_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          randomUUID(), id, company.id, docType, `${docType.replace(/\W+/g, '_').toLowerCase()}.pdf`,
          num(80_000, 900_000), `local://${consignment}/${docType.replace(/\W+/g, '_')}.pdf`,
          company.owner_id, pick(['pending', 'verified', 'verified']), mysqlDateTime(created),
        ],
      );
    }
  }

  console.log('Seeding complaints…');
  const complaintCount = 45;
  for (let i = 0; i < complaintCount; i += 1) {
    const status = COMPLAINT_STATUSES[i % COMPLAINT_STATUSES.length];
    const company = companies[i % companies.length];
    const exportRecord = exportRecords[i % exportRecords.length];
    const officer = officers[i % Math.max(officers.length, 1)];
    const created = randomDate(new Date('2025-11-01'), new Date());
    const resolved = ['resolved', 'closed'].includes(status);
    const buyer = byEmail['buyer@chinagrain.cn'];
    const useBuyer = i % 4 === 0 && buyer;
    await connection.execute(
      `INSERT INTO complaints (
        id, tracking_number, complainant_type, full_name, email, phone, company_name, country, address,
        exporter_company, export_registration_number, export_record_number, product, category, subject, description,
        incident_date, preferred_contact, priority, status, sla_deadline, days_pending, escalation_level,
        assigned_officer_id, resolution_summary, satisfaction_rating, resolved_at, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(), `CMP-${2025001 + i}`,
        useBuyer ? 'Buyer' : pick(['Buyer', 'Importer', 'TIC', 'Exporter']),
        useBuyer ? buyer.full_name : `${pick(['Mohammed', 'Sarah', 'Ahmed', 'Chen', 'Fatima'])} ${pick(['Al-Saud', 'Khan', 'Zhang', 'Ali'])}`,
        useBuyer ? buyer.email : `complainant${i + 1}@email.com`,
        `+${num(1, 99)}-${num(100, 999)}-${num(1000000, 9999999)}`,
        `${pick(COUNTRIES)} ${pick(['Trading Co', 'Imports Ltd', 'Global Foods'])}`,
        pick(COUNTRIES), null, company.legal_name, company.registration_number, exportRecord.consignment_number,
        PRODUCTS[i % PRODUCTS.length], pick(COMPLAINT_CATEGORIES),
        `${pick(['Quality concern', 'Documentation delay', 'Quantity mismatch', 'SPS certificate issue', 'Late shipment'])} - Order #${num(10000, 99999)}`,
        `Detailed complaint regarding ${pick(['product quality not matching specifications', 'delayed documentation processing', 'quantity discrepancy', 'SPS certificate not accepted', 'shipment delayed beyond agreed timeline'])}.`,
        mysqlDate(randomDate(new Date('2026-01-01'), new Date('2026-08-31'))),
        pick(['Email', 'Phone', 'Both']), pick(['low', 'medium', 'high', 'critical']), status,
        mysqlDateTime(randomDate(new Date('2026-09-15'), new Date('2026-12-31'))),
        num(1, 120), status === 'escalated' ? num(1, 3) : 0,
        ['assigned', 'investigation', 'resolved', 'closed', 'escalated'].includes(status) && officer ? officer.id : null,
        resolved ? 'Issue investigated and resolved satisfactorily.' : null,
        resolved ? num(3, 5) : null,
        resolved ? mysqlDateTime(randomDate(created, new Date())) : null,
        useBuyer ? buyer.id : null, useBuyer ? buyer.id : null,
        mysqlDateTime(created), mysqlDateTime(randomDate(created, new Date())),
      ],
    );
  }

  console.log('Seeding notifications + audit logs…');
  for (const user of allUsers) {
    const count = user.role === 'exporter' || user.role === 'super_admin' ? 6 : 3;
    for (let i = 0; i < count; i += 1) {
      await connection.execute(
        `INSERT INTO notifications (id, user_id, title, message, type, is_read, link, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(), user.id,
          pick(['Export Record Approved', 'New Registration Pending', 'Complaint Update', 'Document Verified', 'Monthly Report Ready', 'Review Required']),
          pick([
            'A new item needs your attention in the review workspace.',
            'Your latest consignment status has been updated.',
            'A complaint was assigned for follow-up.',
            'SPS / PSI document verification completed.',
            'System activity summary is available in Reports.',
          ]),
          pick(['info', 'success', 'warning']),
          i > 1,
          user.role.includes('admin') || user.role.includes('officer') || user.role === 'auditor' || user.role === 'super_admin'
            ? '/admin/reviews'
            : '/dashboard/notifications',
          mysqlDateTime(randomDate(new Date('2026-08-01'), new Date())),
        ],
      );
    }
  }

  for (let i = 0; i < 80; i += 1) {
    const actor = pick(allUsers);
    await connection.execute(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, module, record_id, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(), actor.id, actor.full_name, actor.role,
        pick(['Login', 'Logout', 'Create Record', 'Update Record', 'Approve', 'Reject', 'Upload Document', 'Change Status', 'Assign Complaint', 'Export Report']),
        pick(['Authentication', 'Registration', 'Export Records', 'Complaints', 'Reports', 'User Management', 'Master Data']),
        pick(['REG-2024001', 'EXP-2025001', 'CMP-2025001', actor.email]),
        `192.168.${num(1, 254)}.${num(1, 254)}`,
        mysqlDateTime(randomDate(new Date('2026-08-01'), new Date())),
      ],
    );
  }

  await connection.commit();

  const [countRows] = await connection.query(
    `SELECT
      (SELECT COUNT(*) FROM profiles WHERE deleted_at IS NULL) AS users,
      (SELECT COUNT(*) FROM companies WHERE deleted_at IS NULL) AS companies,
      (SELECT COUNT(*) FROM export_records WHERE deleted_at IS NULL) AS exports,
      (SELECT COUNT(*) FROM documents) AS documents,
      (SELECT COUNT(*) FROM complaints WHERE deleted_at IS NULL) AS complaints,
      (SELECT COUNT(*) FROM notifications) AS notifications,
      (SELECT COUNT(*) FROM audit_logs) AS audits`,
  );

  console.log('Seed complete:', countRows[0]);
  console.log(`All demo logins use password: ${DEMO_PASSWORD}`);
  console.log('Extra exporters: exporter2@greenvalley.pk … exporter5@karachiseafood.pk');
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await pool.end();
}
