import { NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { getAuthenticatedAdmin, isSuperAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;

const PROFILE_COLUMNS = 'id, email, full_name, is_active, last_login, created_at, role:roles(name), institution:institutions(name)';

type Relation = { name: string } | { name: string }[] | null | undefined;
const relationName = (value: Relation): string | undefined => (Array.isArray(value) ? value[0]?.name : value?.name);

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  role?: Relation;
  institution?: Relation;
}

/** Shape a profile row the way the browser data store expects it. */
function mapProfile(row: ProfileRow) {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: relationName(row.role) ?? 'exporter',
    institution: relationName(row.institution) ?? undefined,
    is_active: row.is_active,
    last_login: row.last_login ?? undefined,
    created_at: row.created_at,
  };
}

async function requireSuperAdmin(request: Request) {
  try {
    const admin = await getAuthenticatedAdmin(request);
    if (!admin) {
      return { error: NextResponse.json({ error: 'Sign in as a portal administrator to manage users.' }, { status: 401 }) };
    }
    if (!isSuperAdmin(admin.profile)) {
      return { error: NextResponse.json({ error: 'Super-admin access is required.' }, { status: 403 }) };
    }
    return { admin };
  } catch (error) {
    console.error('[admin-users] authorization failed', error);
    return { error: NextResponse.json({ error: 'Server configuration error.' }, { status: 500 }) };
  }
}

/**
 * Resolve the role and institution ids. Institution matching is case- and
 * whitespace-insensitive, and an unknown institution is stored as null rather
 * than failing the whole request, because institutions are free text in the UI.
 */
async function resolveRoleAndInstitution(
  client: SupabaseClient,
  roleName: string,
  institutionName?: string | null,
) {
  const { data: role } = await client.from('roles').select('id, name').eq('name', roleName).maybeSingle();
  if (!role) return { error: `Unknown role: ${roleName}` };

  let institutionId: string | null = null;
  const wanted = institutionName?.trim();
  if (wanted) {
    const { data: institutions } = await client.from('institutions').select('id, name, code');
    const match = (institutions ?? []).find(row =>
      String(row.name).trim().toLowerCase() === wanted.toLowerCase() ||
      String(row.code ?? '').trim().toLowerCase() === wanted.toLowerCase());
    institutionId = match ? match.id as string : null;
  }
  return { roleId: role.id as string, institutionId };
}

export async function POST(request: Request) {
  const check = await requireSuperAdmin(request);
  if ('error' in check) return check.error;
  const { client } = check.admin;

  const input = await request.json().catch(() => null) as {
    full_name?: string; email?: string; role?: string; institution?: string; password?: string;
  } | null;
  const fullName = input?.full_name?.trim();
  const email = input?.email?.trim().toLowerCase();
  const roleName = input?.role?.trim();
  const password = input?.password?.trim();
  if (!fullName || !email || !roleName || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: 'Full name, a valid email, and role are required.' }, { status: 400 });
  }
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `Temporary passwords must contain at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
  }

  const { data: duplicate } = await client.from('profiles').select('id').eq('email', email).maybeSingle();
  if (duplicate) return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });

  const lookup = await resolveRoleAndInstitution(client, roleName, input?.institution);
  if ('error' in lookup) return NextResponse.json({ error: lookup.error }, { status: 400 });

  // With a temporary password the account is usable immediately; without one
  // Supabase sends a password-setup invitation and the portal never handles
  // an administrator-chosen password.
  const created = password
    ? await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } })
    : await client.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
  if (created.error || !created.data.user) {
    return NextResponse.json({ error: created.error?.message ?? 'Unable to create the user account.' }, { status: 400 });
  }
  const userId = created.data.user.id;

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .upsert({
      id: userId,
      email,
      full_name: fullName,
      role_id: lookup.roleId,
      institution_id: lookup.institutionId,
      is_active: true,
    })
    .select(PROFILE_COLUMNS)
    .single();
  if (profileError || !profile) {
    await client.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: profileError?.message ?? 'Unable to create user profile.' }, { status: 400 });
  }

  await client.from('audit_logs').insert({
    user_id: check.admin.profile.id,
    user_name: check.admin.profile.full_name,
    user_role: check.admin.profile.role,
    action: password ? 'Create User' : 'Invite User',
    module: 'User Management',
    record_id: email,
    new_value: `${fullName} (${roleName})`,
    ip_address: 'server',
  });

  return NextResponse.json({ user: mapProfile(profile as ProfileRow) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const check = await requireSuperAdmin(request);
  if ('error' in check) return check.error;
  const { client } = check.admin;

  const input = await request.json().catch(() => null) as {
    id?: string; full_name?: string; email?: string; role?: string; institution?: string | null;
    is_active?: boolean; password?: string;
  } | null;
  if (!input?.id) return NextResponse.json({ error: 'User id is required.' }, { status: 400 });
  if (input.id === check.admin.profile.id && input.is_active === false) {
    return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 });
  }

  const { data: current } = await client.from('profiles').select(PROFILE_COLUMNS).eq('id', input.id).maybeSingle();
  if (!current) return NextResponse.json({ error: 'User was not found.' }, { status: 404 });
  const currentProfile = mapProfile(current as ProfileRow);

  const patch: Record<string, unknown> = {};
  if (input.full_name !== undefined) {
    const fullName = input.full_name.trim();
    if (!fullName) return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    patch.full_name = fullName;
  }
  if (input.is_active !== undefined) patch.is_active = input.is_active;
  if (input.role !== undefined || input.institution !== undefined) {
    const lookup = await resolveRoleAndInstitution(
      client,
      input.role?.trim() || currentProfile.role,
      input.institution === undefined ? currentProfile.institution : input.institution,
    );
    if ('error' in lookup) return NextResponse.json({ error: lookup.error }, { status: 400 });
    patch.role_id = lookup.roleId;
    patch.institution_id = lookup.institutionId;
  }

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    if (email !== currentProfile.email.toLowerCase()) {
      const { data: clash } = await client.from('profiles').select('id').eq('email', email).neq('id', input.id).maybeSingle();
      if (clash) return NextResponse.json({ error: 'Another user with this email already exists.' }, { status: 409 });
      const { error } = await client.auth.admin.updateUserById(input.id, { email, email_confirm: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      patch.email = email;
    }
  }

  if (input.password !== undefined) {
    const password = input.password.trim();
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `Passwords must contain at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
    }
    const { error } = await client.auth.admin.updateUserById(input.id, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ user: currentProfile });
  }

  patch.updated_at = new Date().toISOString();
  const { data: profile, error } = await client.from('profiles').update(patch).eq('id', input.id)
    .select(PROFILE_COLUMNS).single();
  if (error || !profile) return NextResponse.json({ error: error?.message ?? 'Unable to update user.' }, { status: 400 });

  await client.from('audit_logs').insert({
    user_id: check.admin.profile.id,
    user_name: check.admin.profile.full_name,
    user_role: check.admin.profile.role,
    action: 'Update User',
    module: 'User Management',
    record_id: currentProfile.email,
    previous_value: `${currentProfile.full_name} (${currentProfile.role})`,
    new_value: JSON.stringify(patch).substring(0, 200),
    ip_address: 'server',
  });

  return NextResponse.json({ user: mapProfile(profile as ProfileRow) });
}

export async function DELETE(request: Request) {
  const check = await requireSuperAdmin(request);
  if ('error' in check) return check.error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'User id is required.' }, { status: 400 });
  if (id === check.admin.profile.id) return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });

  const { client } = check.admin;
  const { data: target } = await client.from('profiles').select('email, full_name').eq('id', id).maybeSingle();

  const { error } = await client.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // The profile row cascades with the auth user, but delete defensively in case
  // the foreign key was created without ON DELETE CASCADE.
  await client.from('profiles').delete().eq('id', id);

  await client.from('audit_logs').insert({
    user_id: check.admin.profile.id,
    user_name: check.admin.profile.full_name,
    user_role: check.admin.profile.role,
    action: 'Delete User',
    module: 'User Management',
    record_id: target?.email ?? id,
    previous_value: target?.full_name ?? undefined,
    ip_address: 'server',
  });

  return NextResponse.json({ success: true });
}
