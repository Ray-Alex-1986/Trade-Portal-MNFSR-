import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin, isSuperAdmin } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const admin = await getAuthenticatedAdmin(request);
    if (!admin || !isSuperAdmin(admin.profile)) {
      return NextResponse.json({ error: 'Super-admin access is required.' }, { status: 403 });
    }

    const { error } = await admin.client.rpc('reset_demo_data');
    if (error) {
      console.error('[reset-demo]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[reset-demo]', error);
    return NextResponse.json({ error: 'The demo reset could not be completed.' }, { status: 500 });
  }
}
