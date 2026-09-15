'use client';

/**
 * Password storage for the offline demo (mock) backend. Passwords are never
 * stored in clear text: a salted SHA-256 digest is kept in localStorage next
 * to the demo dataset so registered exporters and administrator-created users
 * can sign in with the password they were given.
 */
const STORAGE_KEY = 'export_portal_passwords_v1';
const SALT = 'export-portal-demo';

/** Password accepted by every seeded demo account (matches the Supabase seed). */
export const DEMO_PASSWORD = 'Demo@12345';

type PasswordMap = Record<string, string>;

function readMap(): PasswordMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as PasswordMap : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: PasswordMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch { /* storage unavailable */ }
}

async function digest(email: string, password: string): Promise<string> {
  const input = `${SALT}:${email.trim().toLowerCase()}:${password}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Extremely old browsers: fall back to a reversible-free simple hash.
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) hash = (hash * 31 + input.charCodeAt(i)) | 0;
  return `plain-${hash}`;
}

export async function setMockPassword(email: string, password: string): Promise<void> {
  const map = readMap();
  map[email.trim().toLowerCase()] = await digest(email, password);
  writeMap(map);
}

export function hasMockPassword(email: string): boolean {
  return Boolean(readMap()[email.trim().toLowerCase()]);
}

export async function verifyMockPassword(email: string, password: string): Promise<boolean> {
  const stored = readMap()[email.trim().toLowerCase()];
  if (!stored) return false;
  return stored === await digest(email, password);
}

export function removeMockPassword(email: string): void {
  const map = readMap();
  delete map[email.trim().toLowerCase()];
  writeMap(map);
}

export function renameMockPassword(oldEmail: string, newEmail: string): void {
  const map = readMap();
  const from = oldEmail.trim().toLowerCase();
  const to = newEmail.trim().toLowerCase();
  if (from === to || !map[from]) return;
  map[to] = map[from];
  delete map[from];
  writeMap(map);
}

export function clearMockPasswords(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
