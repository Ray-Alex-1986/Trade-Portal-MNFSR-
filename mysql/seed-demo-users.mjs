import { randomUUID, randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import mysql from 'mysql2/promise';
import { getDatabaseUrl, loadDotEnv } from './load-env.mjs';

loadDotEnv();

const scrypt = promisify(scryptCallback);
const DEMO_PASSWORD = 'Demo@12345';

const DEMO_USERS = [
  { email: 'superadmin@mnfsr.gov.pk', full_name: 'Dr. Ahmed Raza Khan', role: 'super_admin', institutionCode: 'MNFSR' },
  { email: 'admin@moc.gov.pk', full_name: 'Fatima Zahra Sheikh', role: 'moc_admin', institutionCode: 'MoC' },
  { email: 'tdap.admin@tdap.gov.pk', full_name: 'Muhammad Tariq Siddiqui', role: 'tdap_admin', institutionCode: 'TDAP' },
  { email: 'officer1@tdap.gov.pk', full_name: 'Ayesha Malik', role: 'tdap_officer', institutionCode: 'TDAP' },
  { email: 'nafsa.admin@nafsa.gov.pk', full_name: 'Dr. Khalid Mahmood', role: 'nafsa_admin', institutionCode: 'NAFSA' },
  { email: 'officer1@nafsa.gov.pk', full_name: 'Sana Bukhari', role: 'nafsa_officer', institutionCode: 'NAFSA' },
  { email: 'tic.china@tdap.gov.pk', full_name: 'Imran Hussain', role: 'tic', institutionCode: null },
  { email: 'exporter1@pakrice.com', full_name: 'Hassan Ali Shah', role: 'exporter', institutionCode: null },
  { email: 'buyer@chinagrain.cn', full_name: 'Wei Zhang', role: 'buyer', institutionCode: null },
  { email: 'auditor@mnfsr.gov.pk', full_name: 'Nadia Parveen', role: 'auditor', institutionCode: 'MNFSR' },
];

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
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

const passwordHash = await hashPassword(DEMO_PASSWORD);
let created = 0;
let updated = 0;

try {
  const [roles] = await pool.execute('SELECT id, name FROM roles');
  const roleByName = Object.fromEntries(roles.map(row => [row.name, row.id]));
  const [institutions] = await pool.execute('SELECT id, code FROM institutions');
  const institutionByCode = Object.fromEntries(institutions.map(row => [row.code, row.id]));

  for (const user of DEMO_USERS) {
    const roleId = roleByName[user.role];
    if (!roleId) throw new Error(`Missing role: ${user.role}`);
    const institutionId = user.institutionCode ? institutionByCode[user.institutionCode] ?? null : null;

    const [existing] = await pool.execute('SELECT id FROM profiles WHERE email = ? LIMIT 1', [user.email]);
    if (existing.length) {
      await pool.execute(
        `UPDATE profiles
            SET full_name = ?, password_hash = ?, role_id = ?, institution_id = ?, is_active = TRUE, deleted_at = NULL
          WHERE email = ?`,
        [user.full_name, passwordHash, roleId, institutionId, user.email],
      );
      updated += 1;
    } else {
      await pool.execute(
        `INSERT INTO profiles (id, email, full_name, password_hash, role_id, institution_id, is_active)
         VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
        [randomUUID(), user.email, user.full_name, passwordHash, roleId, institutionId],
      );
      created += 1;
    }
  }

  console.log(`Demo users ready. created=${created} updated=${updated}`);
  console.log(`Shared password: ${DEMO_PASSWORD}`);
} finally {
  await pool.end();
}
