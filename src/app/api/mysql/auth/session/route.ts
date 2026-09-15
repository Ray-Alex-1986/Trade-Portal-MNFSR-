import { NextResponse } from 'next/server';
import { getMySqlSessionUser } from '@/lib/mysql/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getMySqlSessionUser(request);
    return NextResponse.json({ user });
  } catch (error) {
    console.error('[mysql-auth-session]', error);
    return NextResponse.json({ error: 'The authentication service is unavailable.' }, { status: 503 });
  }
}
