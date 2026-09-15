import { randomUUID, randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import mysql from 'mysql2/promise';

const scrypt = promisify(scryptCallback);
const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const email = required('MYSQL_BOOTSTRAP_ADMIN_EMAIL').trim().toLowerCase();
const fullName = required('MYSQL_BOOTSTRAP_ADMIN_NAME').trim();
const password = required('MYSQL_BOOTSTRAP_ADMIN_PASSWORD');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('MYSQL_BOOTSTRAP_ADMIN_EMAIL is invalid.');
if (!fullName) throw new Error('MYSQL_BOOTSTRAP_ADMIN_NAME is required.');
if (password.length < 12) throw new Error('MYSQL_BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters.');

const salt = randomBytes(16);
const hash = await scrypt(password, salt, 64);
const passwordHash = `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;

const databaseUrl = new URL(required('MYSQL_DATABASE_URL'));
if (!['mysql:', 'mysqls:'].includes(databaseUrl.protocol)) {
  throw new Error('MYSQL_DATABASE_URL must use the mysql:// or mysqls:// protocol.');
}
const port = Number(databaseUrl.port || '3306');
if (!Number.isInteger(port) || port < 1 || port > 65535 || !databaseUrl.pathname || databaseUrl.pathname === '/') {
  throw new Error('MYSQL_DATABASE_URL must include a valid port and database name.');
}
const pool = mysql.createPool({
  host: databaseUrl.hostname,
  port,
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: decodeURIComponent(databaseUrl.pathname.slice(1)),
  ssl: databaseUrl.protocol === 'mysqls:' || process.env.MYSQL_SSL === 'true'
    ? { rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined,
});

try {
  const [roles] = await pool.execute('SELECT id FROM roles WHERE name = ? LIMIT 1', ['super_admin']);
  const roleId = roles[0]?.id;
  if (!roleId) throw new Error('The super_admin role is missing. Apply mysql/schema.sql first.');

  const [existing] = await pool.execute('SELECT id FROM profiles WHERE email = ? LIMIT 1', [email]);
  if (existing.length) throw new Error('An account with this email already exists.');

  await pool.execute(
    'INSERT INTO profiles (id, email, full_name, password_hash, role_id, is_active) VALUES (?, ?, ?, ?, ?, TRUE)',
    [randomUUID(), email, fullName, passwordHash, roleId],
  );
  console.log(`Created super-admin account for ${email}.`);
} finally {
  await pool.end();
}
