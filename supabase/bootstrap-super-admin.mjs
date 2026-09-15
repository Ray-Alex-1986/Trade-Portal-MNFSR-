#!/usr/bin/env node
/**
 * Creates the first real MNFSR super-admin account in a Supabase project, so a
 * production deployment does not have to rely on the demo seed logins.
 *
 * The account is created already email-confirmed and its profile is linked to
 * the super_admin role, which is what the portal reads to grant access.
 *
 * Run it locally (never store the service role key in a hosting provider's
 * build settings for this purpose):
 *
 *   SUPABASE_URL='https://<project-ref>.supabase.co' \
 *   SUPABASE_SERVICE_ROLE_KEY='<service-role-key>' \
 *   SUPABASE_BOOTSTRAP_ADMIN_EMAIL='admin@example.gov.pk' \
 *   SUPABASE_BOOTSTRAP_ADMIN_NAME='Portal Super Admin' \
 *   SUPABASE_BOOTSTRAP_ADMIN_PASSWORD='<at least 12 characters>' \
 *   node supabase/bootstrap-super-admin.mjs
 *
 * Pass SUPABASE_BOOTSTRAP_ADMIN_INSTITUTION to attach an institution by name.
 */
import { createClient } from '@supabase/supabase-js';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

// NEXT_PUBLIC_SUPABASE_URL is accepted so a local .env used by the app works too.
const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
if (!supabaseUrl) throw new Error('SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is required.');
const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');

const email = required('SUPABASE_BOOTSTRAP_ADMIN_EMAIL').trim().toLowerCase();
const fullName = required('SUPABASE_BOOTSTRAP_ADMIN_NAME').trim();
const password = required('SUPABASE_BOOTSTRAP_ADMIN_PASSWORD');
const institutionName = process.env.SUPABASE_BOOTSTRAP_ADMIN_INSTITUTION?.trim();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('SUPABASE_BOOTSTRAP_ADMIN_EMAIL is invalid.');
if (!fullName) throw new Error('SUPABASE_BOOTSTRAP_ADMIN_NAME is required.');
if (password.length < 12) throw new Error('SUPABASE_BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters.');

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: role, error: roleError } = await client
  .from('roles')
  .select('id')
  .eq('name', 'super_admin')
  .maybeSingle();
if (roleError) throw new Error(`Could not read the roles table: ${roleError.message}`);
if (!role) throw new Error('The super_admin role is missing. Run supabase/setup.sql first.');

let institutionId = null;
if (institutionName) {
  const { data: institutions, error: institutionError } = await client.from('institutions').select('id, name, code');
  if (institutionError) throw new Error(`Could not read the institutions table: ${institutionError.message}`);
  const match = (institutions ?? []).find((row) =>
    String(row.name).trim().toLowerCase() === institutionName.toLowerCase()
    || String(row.code ?? '').trim().toLowerCase() === institutionName.toLowerCase());
  if (!match) {
    const available = (institutions ?? []).map((row) => row.name).join(', ');
    throw new Error(`Unknown institution "${institutionName}". Available: ${available}`);
  }
  institutionId = match.id;
}

const { data: existing, error: existingError } = await client
  .from('profiles')
  .select('id')
  .eq('email', email)
  .maybeSingle();
if (existingError) throw new Error(`Could not read the profiles table: ${existingError.message}`);
if (existing) throw new Error(`An account already exists for ${email}.`);

const { data: created, error: createError } = await client.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});
if (createError || !created?.user) {
  throw new Error(`Could not create the auth account: ${createError?.message ?? 'unknown error'}`);
}

const { error: profileError } = await client.from('profiles').upsert({
  id: created.user.id,
  email,
  full_name: fullName,
  role_id: role.id,
  institution_id: institutionId,
  is_active: true,
});
if (profileError) {
  // Leave no orphaned auth account behind if the profile could not be written.
  await client.auth.admin.deleteUser(created.user.id);
  throw new Error(`Could not create the profile: ${profileError.message}`);
}

await client.from('audit_logs').insert({
  user_id: created.user.id,
  user_name: fullName,
  user_role: 'super_admin',
  action: 'Bootstrap Super Admin',
  module: 'User Management',
  record_id: email,
  new_value: fullName,
  ip_address: 'script',
});

console.log(`Created super-admin account for ${email}.`);
console.log('Sign in at /login with that email and the password you supplied.');
