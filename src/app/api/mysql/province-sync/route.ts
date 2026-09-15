import { NextResponse } from 'next/server';
import { MySqlProvinceSyncError, runMySqlProvinceSync } from '@/lib/mysql/province-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { sourceId?: unknown } | null;
  if (!body || typeof body.sourceId !== 'string') {
    return NextResponse.json({ error: 'sourceId is required.' }, { status: 400 });
  }

  try {
    return NextResponse.json(await runMySqlProvinceSync(request, body.sourceId), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof MySqlProvinceSyncError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[mysql-province-sync]', error);
    return NextResponse.json({ error: 'The provincial sync service is unavailable.' }, { status: 503 });
  }
}
