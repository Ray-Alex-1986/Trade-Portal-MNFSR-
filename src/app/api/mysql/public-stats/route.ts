import { NextResponse } from 'next/server';
import { getMySqlPublicPortalStats } from '@/lib/mysql/portal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getMySqlPublicPortalStats(), {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30' },
    });
  } catch (error) {
    console.error('[mysql-public-stats]', error);
    return NextResponse.json({ error: 'Portal statistics are unavailable.' }, { status: 503 });
  }
}
