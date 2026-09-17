import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { getDatabaseUrl, loadDotEnv } from './load-env.mjs';

loadDotEnv();

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const databaseUrl = new URL(getDatabaseUrl());
if (!['mysql:', 'mysqls:'].includes(databaseUrl.protocol)) {
  throw new Error('DATABASE_URL must use mysql:// or mysqls://');
}

const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
if (!databaseName) throw new Error('DATABASE_URL must include a database name.');
if (databaseName === 'complaint_management') {
  throw new Error('Use a dedicated database for this portal (export_portal), not complaint_management.');
}

const port = Number(databaseUrl.port || '3306');
const baseConfig = {
  host: databaseUrl.hostname,
  port,
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  multipleStatements: true,
  ssl: databaseUrl.protocol === 'mysqls:' || process.env.MYSQL_SSL === 'true'
    ? { rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined,
};

const adminEmail = (process.env.MYSQL_BOOTSTRAP_ADMIN_EMAIL || 'admin@mnfsr.gov.pk').trim().toLowerCase();
const adminName = (process.env.MYSQL_BOOTSTRAP_ADMIN_NAME || 'Portal Super Admin').trim();
const adminPassword = process.env.MYSQL_BOOTSTRAP_ADMIN_PASSWORD || '';

console.log(`Creating database \`${databaseName}\` on ${baseConfig.host}:${port}…`);

const rootConnection = await mysql.createConnection(baseConfig);
await rootConnection.query(
  `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
);
await rootConnection.end();

const connection = await mysql.createConnection({ ...baseConfig, database: databaseName });

const [tables] = await connection.query(
  `SELECT COUNT(*) AS count FROM information_schema.tables
    WHERE table_schema = ? AND table_name = 'profiles'`,
  [databaseName],
);

if (!Number(tables[0]?.count)) {
  console.log('Applying mysql/schema.sql…');
  await connection.query(readFileSync(resolve(root, 'mysql/schema.sql'), 'utf8'));
} else {
  console.log('Schema already present — skipping mysql/schema.sql.');
}

console.log('Seeding master data…');
await connection.query(readFileSync(resolve(root, 'mysql/seed-master-data.sql'), 'utf8'));

if (adminPassword.length >= 12) {
  const [existing] = await connection.execute('SELECT id FROM profiles WHERE email = ? LIMIT 1', [adminEmail]);
  if (existing.length) {
    console.log(`Super-admin ${adminEmail} already exists — skipping bootstrap.`);
  } else {
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync(process.execPath, [resolve(root, 'mysql/bootstrap-super-admin.mjs')], {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      await connection.end();
      process.exit(result.status ?? 1);
    }
  }
} else {
  console.log('MYSQL_BOOTSTRAP_ADMIN_PASSWORD is missing or shorter than 12 characters — skipped admin bootstrap.');
}

{
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(process.execPath, [resolve(root, 'mysql/seed-demo-users.mjs')], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    await connection.end();
    process.exit(result.status ?? 1);
  }
}

const [[{ roles }], [{ institutions }], [{ master_items }]] = await Promise.all([
  connection.query('SELECT COUNT(*) AS roles FROM roles').then(([rows]) => rows),
  connection.query('SELECT COUNT(*) AS institutions FROM institutions').then(([rows]) => rows),
  connection.query('SELECT COUNT(*) AS master_items FROM master_data').then(([rows]) => rows),
]);

await connection.end();
console.log(`Ready. roles=${roles} institutions=${institutions} master_data=${master_items}`);
console.log(`Sign in after \`npm run dev\` as ${adminEmail}`);
