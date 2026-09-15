'use client';

import { Company, User } from './types';
import { getSupabaseBrowserClient } from './supabase/client';
import { getConfiguredPortalBackend } from './supabase/use-mock';

export interface RegistrationInput {
  company: Partial<Company>;
  representative: {
    full_name: string;
    email: string;
    username: string;
    password?: string;
    cnic: string;
    designation: string;
    mobile: string;
  };
  registration_number: string;
}

export interface RegistrationResult {
  user?: User;
  company?: Company;
  error?: string;
}

async function postRegistration(url: string, input: RegistrationInput): Promise<{ status: number; result: RegistrationResult }> {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const result = await response.json().catch(() => ({})) as RegistrationResult;
  return { status: response.status, result: response.ok ? result : { error: result.error || 'Registration could not be submitted.' } };
}

async function registerMySqlExporter(input: RegistrationInput): Promise<RegistrationResult> {
  try {
    return (await postRegistration('/api/mysql/auth/register', input)).result;
  } catch {
    return { error: 'The registration service is unavailable.' };
  }
}

/** Client-side Supabase flow used only when the server route is not configured. */
async function registerSupabaseExporterInBrowser(input: RegistrationInput): Promise<RegistrationResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: 'The database connection is not configured.' };

  const { representative, company, registration_number } = input;
  const password = representative.password?.trim();
  if (!password || password.length < 8) {
    return { error: 'Use a password with at least 8 characters.' };
  }

  const email = representative.email.trim().toLowerCase();
  const { data: signUp, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: representative.full_name.trim() } },
  });
  if (signUpError) return { error: signUpError.message };
  if (!signUp.user) return { error: 'Your account could not be created. Please try again.' };

  // With email confirmation enabled Supabase returns no session, which cannot
  // satisfy the own-row RLS policy. The setup guide instructs the project owner
  // to disable confirmation for the demo or configure the service role key so
  // the server-side registration route is used instead.
  if (!signUp.session) {
    return {
      error: 'Please confirm your email, then sign in. The portal administrator must complete your profile setup.',
    };
  }

  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'exporter')
    .single();
  if (roleError || !role) {
    await supabase.auth.signOut();
    return { error: 'The exporter role is unavailable. Please contact the portal administrator.' };
  }

  const user: User = {
    id: signUp.user.id,
    email,
    full_name: representative.full_name.trim(),
    role: 'exporter',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const { error: profileError } = await supabase.from('profiles').insert({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role_id: role.id,
    phone: representative.mobile || null,
    designation: representative.designation || null,
    is_active: true,
  });
  if (profileError) {
    await supabase.auth.signOut();
    return { error: `Account created, but the profile could not be saved: ${profileError.message}` };
  }

  const now = new Date().toISOString();
  const application: Company = {
    id: '',
    owner_id: user.id,
    legal_name: company.legal_name?.trim() || '',
    trading_name: company.trading_name?.trim() || undefined,
    company_type: company.company_type || 'Private Limited',
    ntn: company.ntn?.trim() || '',
    secp_number: company.secp_number?.trim() || '',
    registration_date: company.registration_date || now.slice(0, 10),
    address: company.address?.trim() || '',
    province: company.province || 'Punjab',
    district: company.district || '',
    city: company.city || '',
    website: company.website?.trim() || undefined,
    email: company.email?.trim() || user.email,
    phone: company.phone?.trim() || representative.mobile,
    nature_of_business: company.nature_of_business || 'Agricultural Export',
    main_export_categories: company.main_export_categories || [],
    registration_number,
    status: 'submitted',
    tdap_review_status: 'pending',
    nafsa_review_status: 'not_initiated',
    nadra_status: 'pending',
    secp_status: 'pending',
    ntn_status: 'pending',
    created_at: now,
    updated_at: now,
  };

  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...companyRow } = application;
  const { data: savedCompany, error: companyError } = await supabase
    .from('companies')
    .insert(companyRow)
    .select('*')
    .single();
  if (companyError) {
    await supabase.auth.signOut();
    return { error: `Account created, but the registration could not be submitted: ${companyError.message}` };
  }

  const saved = { ...application, ...(savedCompany as Partial<Company>) };
  await Promise.all([
    supabase.rpc('notify_super_admins', {
      p_title: 'New Exporter Registration',
      p_message: `${user.full_name} submitted ${saved.legal_name} (${registration_number}) for review.`,
      p_type: 'info',
      p_link: '/admin/reviews',
    }),
    supabase.from('audit_logs').insert({
      user_id: user.id,
      user_name: user.full_name,
      user_role: user.role,
      action: 'Submit Registration',
      module: 'Registration',
      record_id: registration_number,
      new_value: saved.legal_name,
      ip_address: 'client',
    }),
  ]);

  await supabase.auth.signOut();
  return { user, company: saved };
}

/**
 * Creates a database-native exporter account and company application. MySQL
 * registrations use their server route; Supabase prefers the service-role
 * server route and falls back to the browser flow when it is not configured.
 */
export async function registerExporter(input: RegistrationInput): Promise<RegistrationResult> {
  if (getConfiguredPortalBackend() === 'mysql') return registerMySqlExporter(input);

  try {
    const { status, result } = await postRegistration('/api/register', input);
    if (status !== 503) return result;
  } catch {
    // Network failure: try the browser flow below.
  }
  return registerSupabaseExporterInBrowser(input);
}
