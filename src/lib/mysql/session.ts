import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { RowDataPacket } from 'mysql2';
import { User, UserRole } from '@/lib/types';
import { getMySqlPool } from './server';

export const MYSQL_SESSION_COOKIE = 'trade_portal_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

interface SessionPayload {
  sub: string;
  exp: number;
}

interface ProfileRow extends RowDataPacket {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  institution: string | null;
  is_active: number | boolean;
  created_at: string;
  last_login: string | null;
}

function sessionSecret(): string {
  const secret = process.env.MYSQL_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('MYSQL_SESSION_SECRET must contain at least 32 characters.');
  }
  return secret;
}

function sign(value: string): string {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

export function createMySqlSession(userId: string): { value: string; maxAge: number } {
  const payload: SessionPayload = { sub: userId, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { value: `${encoded}.${sign(encoded)}`, maxAge: SESSION_MAX_AGE_SECONDS };
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const prefix = `${name}=`;
  for (const part of header.split(/;\s*/)) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return null;
}

function parseMySqlSession(request: Request): SessionPayload | null {
  const token = readCookie(request.headers.get('cookie'), MYSQL_SESSION_COOKIE);
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = Buffer.from(sign(encoded));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    return payload.sub && payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    institution: row.institution ?? undefined,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    last_login: row.last_login ?? undefined,
  };
}

/** Resolves the cookie subject from the database so disabled users lose access immediately. */
export async function getMySqlSessionUser(request: Request): Promise<User | null> {
  const session = parseMySqlSession(request);
  if (!session) return null;

  const [rows] = await getMySqlPool().execute<ProfileRow[]>(
    `SELECT p.id, p.email, p.full_name, r.name AS role, i.name AS institution,
            p.is_active, p.created_at, p.last_login
       FROM profiles p
       JOIN roles r ON r.id = p.role_id
       LEFT JOIN institutions i ON i.id = p.institution_id
      WHERE p.id = ? AND p.deleted_at IS NULL
      LIMIT 1`,
    [session.sub],
  );
  if (!rows[0] || !Boolean(rows[0].is_active)) return null;
  return mapProfile(rows[0]);
}

export function mySqlSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}
