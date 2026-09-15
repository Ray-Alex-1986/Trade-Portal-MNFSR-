import { NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { getAuthenticatedAdmin, isSuperAdmin } from '@/lib/supabase/server';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireSuperAdmin(request: Request) {
  try {
    const admin = await getAuthenticatedAdmin(request);
    if (!admin || !isSuperAdmin(admin.profile)) {
      return { error: NextResponse.json({ error: 'Super-admin access is required.' }, { status: 403 }) };
    }
    return { admin };
  } catch (error) {
    console.error('[admin-users] authorization failed', error);
    return { error: NextResponse.json({ error: 'Server configuration error.' }, { status: 500 }) };
  }
}

async function resolveRoleAndInstitution(
  client: SupabaseClient,
  roleName: string,
  institutionName?: string,
) {
  const { data: role } = await client.from('roles').select('id, name').eq('name', roleName).single();
  if (!role) return { error: `Unknown role: ${roleName}` };

  let institutionId: string | null = null;
  if (institutionName?.trim()) {
    const { data: institution } = await client
      .from('institutions')
      .select('id')
      .eq('name', institutionName.trim())
      .single();
    if (!institution) return { error: `Unknown institution: ${institutionName}` };
    institutionId = institution.id as string;
  }
  return { roleId: role.id as string, institutionId };
}

export async function POST(request: Request) {
  const check = await requireSuperAdmin(request);
  if ('error' in check) return check.error;
  const { client } = check.admin;

  const input = await request.json().catch(() => null) as {
    full_name?: string; email?: string; role?: string; institution?: string;
  } | null;
  const fullName = input?.full_name?.trim();
  const email = input?.email?.trim().toLowerCase();
  const roleName = input?.role?.trim();
  if (!fullName || !email || !roleName || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: 'Full name, a valid email, and role are required.' }, { status: 400 });
  }

  const lookup = await resolveRoleAndInstitution(client, roleName, input?.institution);
  if ('error' in lookup) return NextResponse.json({ error: lookup.error }, { status: 400 });

  // Supabase sends a password-setup invitation; the application never handles
  // or stores an administrator-created password.
  const { data: invitation, error: invitationError } = await client.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  });
  if (invitationError || !invitation.user) {
    return NextResponse.json({ error: invitationError?.message ?? 'Unable to invite user.' }, { status: 400 });
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .insert({
      id: invitation.user.id,
      email,
      full_name: fullName,
      role_id: lookup.roleId,
      institution_id: lookup.institutionId,
      is_active: true,
    })
    .select('id, email, full_name, is_active, last_login, created_at')
    .single();
  if (profileError || !profile) {
    await client.auth.admin.deleteUser(invitation.user.id);
    return NextResponse.json({ error: profileError?.message ?? 'Unable to create user profile.' }, { status: 400 });
  }

  await client.from('audit_logs').insert({
    user_id: check.admin.profile.id,
    user_name: check.admin.profile.full_name,
    user_role: check.admin.profile.role,
    action: 'Invite User',
    module: 'User Management',
    record_id: email,
    new_value: `${fullName} (${roleName})`,
    ip_address: 'server',
  });

  return NextResponse.json({
    user: { ...profile, role: roleName, institution: input?.institution || undefined },
  }, { status: 201 });
}

export async function PATCH(request: Request) {
  const check = await requireSuperAdmin(request);
  if ('error' in check) return check.error;
  const { client } = check.admin;

  const input = await request.json().catch(() => null) as {
    id?: string; full_name?: string; email?: string; role?: string; institution?: string | null; is_active?: boolean;
  } | null;
  if (!input?.id) return NextResponse.json({ error: 'User id is required.' }, { status: 400 });
  if (input.id === check.admin.profile.id && input.is_active === false) {
    return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (input.full_name !== undefined) patch.full_name = input.full_name.trim();
  if (input.is_active !== undefined) patch.is_active = input.is_active;
  if (input.role !== undefined || input.institution !== undefined) {
    const { data: current } = await client.from('profiles').select('role:roles(name), institution:institutions(name)').eq('id', input.id).single();
    const currentRelations = current as unknown as {
      role?: { name: string } | { name: string }[] | null;
      institution?: { name: string } | { name: string }[] | null;
    } | null;
    const currentRole = (Array.isArray(currentRelations?.role) ? currentRelations?.role[0]?.name : currentRelations?.role?.name) as string | undefined;
    const currentInstitution = (Array.isArray(currentRelations?.institution) ? currentRelations?.institution[0]?.name : currentRelations?.institution?.name) as string | undefined;
    const lookup = await resolveRoleAndInstitution(client, input.role ?? currentRole ?? 'exporter', input.institution === undefined ? currentInstitution : input.institution ?? undefined);
    if ('error' in lookup) return NextResponse.json({ error: lookup.error }, { status: 400 });
    patch.role_id = lookup.roleId;
    patch.institution_id = lookup.institutionId;
  }

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    const { error } = await client.auth.admin.updateUserById(input.id, { email });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    patch.email = email;
  }

  const { data: profile, error } = await client.from('profiles').update(patch).eq('id', input.id)
    .select('id, email, full_name, is_active, last_login, created_at').single();
  if (error || !profile) return NextResponse.json({ error: error?.message ?? 'Unable to update user.' }, { status: 400 });
  return NextResponse.json({ user: profile });
}

export async function DELETE(request: Request) {
  const check = await requireSuperAdmin(request);
  if ('error' in check) return check.error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'User id is required.' }, { status: 400 });
  if (id === check.admin.profile.id) return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });

  const { error } = await check.admin.client.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
