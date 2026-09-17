import { NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import { verifyPassword } from '@/lib/mysql/passwords';
import { createMySqlSession, MYSQL_SESSION_COOKIE, mySqlSessionCookieOptions } from '@/lib/mysql/session';
import { getMySqlPool } from '@/lib/mysql/server';
import { UserRole } from '@/lib/types';

export const runtime = 'nodejs';

interface LoginRow extends RowDataPacket {
  id: string;
  email: string;
  full_name: string;
  password_hash: string | null;
  role: UserRole;
  institution: string | null;
  is_active: number | boolean;
  created_at: string;
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = input?.email?.trim().toLowerCase();
  const password = input?.password;
  if (!email || !password) return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });

  try {
    const [rows] = await getMySqlPool().execute<LoginRow[]>(
      `SELECT p.id, p.email, p.full_name, p.password_hash, r.name AS role, i.name AS institution, p.is_active, p.created_at
         FROM profiles p
         JOIN roles r ON r.id = p.role_id
         LEFT JOIN institutions i ON i.id = p.institution_id
        WHERE p.email = ? AND p.deleted_at IS NULL
        LIMIT 1`,
      [email],
    );
    const profile = rows[0];
    if (!profile || !Boolean(profile.is_active) || !(await verifyPassword(password, profile.password_hash))) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    await getMySqlPool().execute('UPDATE profiles SET last_login = UTC_TIMESTAMP(3) WHERE id = ?', [profile.id]);
    const lastLogin = new Date().toISOString();
    const session = createMySqlSession(profile.id);
    const response = NextResponse.json({
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        institution: profile.institution ?? undefined,
        is_active: true,
        created_at: profile.created_at,
        last_login: lastLogin,
      },
    });
    response.cookies.set(MYSQL_SESSION_COOKIE, session.value, mySqlSessionCookieOptions(session.maxAge));
    return response;
  } catch (error) {
    console.error('[mysql-auth-login]', error);
    return NextResponse.json({ error: 'The authentication service is unavailable.' }, { status: 503 });
  }
}
