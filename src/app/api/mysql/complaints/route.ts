import { NextResponse } from 'next/server';
import { Complaint } from '@/lib/types';
import { submitMySqlPublicComplaint } from '@/lib/mysql/portal';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as (Partial<Complaint> & { tracking_number?: string }) | null;
  if (!input?.tracking_number) return NextResponse.json({ error: 'A tracking number is required.' }, { status: 400 });

  const result = await submitMySqlPublicComplaint(input as Partial<Complaint> & { tracking_number: string });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ id: result.id, tracking_number: input.tracking_number }, { status: 201 });
}
