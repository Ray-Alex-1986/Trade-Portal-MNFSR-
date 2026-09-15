import { NextResponse } from 'next/server';
import {
  executeMySqlPortalOperation, getMySqlPortalSnapshot, MySqlPortalError,
} from '@/lib/mysql/portal-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(error: unknown) {
  if (error instanceof MySqlPortalError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('[mysql-portal]', error);
  return NextResponse.json({ error: 'The portal service is unavailable.' }, { status: 503 });
}

export async function GET(request: Request) {
  try {
    return NextResponse.json(await getMySqlPortalSnapshot(request), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { operation?: unknown; payload?: unknown } | null;
    if (!body || typeof body.operation !== 'string') {
      return NextResponse.json({ error: 'An operation is required.' }, { status: 400 });
    }
    await executeMySqlPortalOperation(request, body.operation, body.payload);
    return NextResponse.json(await getMySqlPortalSnapshot(request), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
