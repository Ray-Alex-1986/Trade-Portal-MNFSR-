import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegistrationBody {
  company?: Record<string, unknown>;
  representative?: {
    full_name?: string; email?: string; username?: string; password?: string;
    cnic?: string; designation?: string; mobile?: string;
  };
  registration_number?: string;
}

const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value.trim() : fallback) || fallback;

/**
 * Server-side exporter registration for the Supabase backend. It runs with the
 * service role so the account is created already confirmed and the profile and
 * company application are inserted atomically-enough regardless of the
 * project's email-confirmation setting. Falls back with 503 when the service
 * role key is not configured so the browser can use the client-side flow.
 */
export async function POST(request: Request) {
  let client;
  try {
    client = getSupabaseServiceClient();
  } catch {
    return NextResponse.json({ error: 'Server-side registration is not configured.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as RegistrationBody | null;
  const rep = body?.representative;
  const company = body?.company ?? {};
  const registrationNumber = text(body?.registration_number);
  const email = text(rep?.email).toLowerCase();
  const fullName = text(rep?.full_name);
  const password = typeof rep?.password === 'string' ? rep.password : '';
  const legalName = text(company.legal_name);

  if (!fullName || !legalName || !registrationNumber) {
    return NextResponse.json({ error: 'Representative name, company legal name, and registration number are required.' }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Use a password with at least 8 characters.' }, { status: 400 });

  const { data: existing } = await client.from('profiles').select('id').eq('email', email).maybeSingle();
  if (existing) return NextResponse.json({ error: 'An account with this email already exists. Please sign in instead.' }, { status: 409 });

  const { data: role, error: roleError } = await client.from('roles').select('id').eq('name', 'exporter').single();
  if (roleError || !role) return NextResponse.json({ error: 'The exporter role is unavailable. Please contact the portal administrator.' }, { status: 500 });

  const { data: created, error: createError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? 'Your account could not be created.' }, { status: 400 });
  }
  const userId = created.user.id;

  const { error: profileError } = await client.from('profiles').upsert({
    id: userId,
    email,
    full_name: fullName,
    role_id: role.id,
    phone: text(rep?.mobile) || null,
    designation: text(rep?.designation) || null,
    is_active: true,
  });
  if (profileError) {
    await client.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: `Account created, but the profile could not be saved: ${profileError.message}` }, { status: 400 });
  }

  const now = new Date().toISOString();
  const categories = Array.isArray(company.main_export_categories) ? company.main_export_categories.filter((v): v is string => typeof v === 'string') : [];
  const companyRow = {
    owner_id: userId,
    legal_name: legalName,
    trading_name: text(company.trading_name) || null,
    company_type: text(company.company_type, 'Private Limited'),
    ntn: text(company.ntn),
    secp_number: text(company.secp_number),
    registration_date: text(company.registration_date) || now.slice(0, 10),
    address: text(company.address),
    province: text(company.province, 'Punjab'),
    district: text(company.district),
    city: text(company.city),
    website: text(company.website) || null,
    email: text(company.email) || email,
    phone: text(company.phone) || text(rep?.mobile),
    nature_of_business: text(company.nature_of_business, 'Agricultural Export'),
    main_export_categories: categories,
    registration_number: registrationNumber,
    status: 'submitted',
    tdap_review_status: 'pending',
    nafsa_review_status: 'not_initiated',
    nadra_status: 'pending',
    secp_status: 'pending',
    ntn_status: 'pending',
    created_by: userId,
    updated_by: userId,
  };
  const { data: savedCompany, error: companyError } = await client.from('companies').insert(companyRow).select('*').single();
  if (companyError) {
    await client.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: `Account created, but the registration could not be submitted: ${companyError.message}` }, { status: 400 });
  }

  // notify_super_admins() is the schema's own helper, so it stays correct even
  // if the reviewer roles change.
  await Promise.all([
    client.rpc('notify_super_admins', {
      p_title: 'New Exporter Registration',
      p_message: `${fullName} submitted ${legalName} (${registrationNumber}) for review.`,
      p_type: 'info',
      p_link: '/admin/reviews',
    }),
    client.from('notifications').insert({
      user_id: userId,
      title: 'Registration Received',
      message: `Your registration ${registrationNumber} has been received and is awaiting TDAP review.`,
      type: 'info',
      link: '/dashboard',
    }),
    client.from('audit_logs').insert({
      user_id: userId,
      user_name: fullName,
      user_role: 'exporter',
      action: 'Submit Registration',
      module: 'Registration',
      record_id: registrationNumber,
      new_value: legalName,
      ip_address: 'server',
    }),
  ]);

  return NextResponse.json({
    user: { id: userId, email, full_name: fullName, role: 'exporter', is_active: true, created_at: now },
    company: savedCompany,
  }, { status: 201 });
}
