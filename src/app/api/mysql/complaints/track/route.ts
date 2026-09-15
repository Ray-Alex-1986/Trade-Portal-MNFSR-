import { NextResponse } from 'next/server';
import { findMySqlComplaintByTracking } from '@/lib/mysql/portal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const trackingNumber = new URL(request.url).searchParams.get('tracking_number')?.trim();
  if (!trackingNumber) return NextResponse.json({ error: 'tracking_number is required.' }, { status: 400 });

  try {
    const complaint = await findMySqlComplaintByTracking(trackingNumber);
    return NextResponse.json({ complaint });
  } catch (error) {
    console.error('[mysql-track-complaint]', error);
    return NextResponse.json({ error: 'Complaint tracking is unavailable.' }, { status: 503 });
  }
}
