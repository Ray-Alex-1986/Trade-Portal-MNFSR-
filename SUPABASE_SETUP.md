# Supabase setup

## 1. Create the project
1. Sign in to [Supabase](https://supabase.com/dashboard) and select **New project**.
2. Choose an organization, project name, database password, and region, then wait for the project to finish provisioning.
3. In **Project Settings → API**, copy the project URL, the `anon`/publishable key, and the `service_role` key.

## 2. Configure local environment variables
1. Open `.env.local` in the project root.
2. Replace its three placeholders:
   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-or-publishable-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```
3. Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code or commit `.env.local`. `.env.example` is the safe template for other developers.
4. Restart `npm run dev` after changing environment variables. With valid public values, the portal automatically switches from local mock mode to Supabase mode.

## 3. Configure Auth for this portal
For the supplied demo and registration flows:
1. Go to **Authentication → Providers → Email**.
2. Enable Email provider.
3. For local/demo use, disable **Confirm email**. This lets the public registration form create its profile and company application in the same authenticated session.
4. Add your development site URL (for example `http://localhost:3000`) under **Authentication → URL Configuration**.

For production, keep confirmation enabled only after replacing the client-side registration helper with a server-side, post-confirmation profile-provisioning workflow.

## 4. Apply the database SQL
Open **SQL Editor → New query** and run these files in this exact order:

1. `supabase-schema.sql` — base tables, base RLS, institutions, and roles.
2. `supabase/migrations/001_portal_updates.sql` — review columns, province tables, complete RLS, public complaint RPCs, and Realtime publication. It also enables `pgcrypto`, required for demo password hashing.
3. `supabase/migrations/002_demo_seed.sql` — deterministic real demo data plus ten Supabase Auth accounts.
4. `supabase/migrations/003_public_portal_stats.sql` — aggregate-only public landing-page metrics without exposing protected rows.
5. `supabase/migrations/004_document_realtime.sql` — Realtime updates for document metadata joined to export records.

The seed script runs `reset_demo_data()` automatically. It can be rerun in the SQL editor to restore the demo dataset.

## 5. Demo accounts
All seeded accounts use this password:

```text
Demo@12345
```

| Role | Email |
| --- | --- |
| MNFSR Super Admin | `superadmin@mnfsr.gov.pk` |
| TDAP Admin | `tdap.admin@tdap.gov.pk` |
| NAFSA Admin | `nafsa.admin@nafsa.gov.pk` |
| Exporter | `exporter1@pakrice.com` |
| Buyer | `buyer@chinagrain.cn` |

Change these credentials before deploying any non-demo environment.

## 6. Verify realtime behavior
1. Run `npm run dev` and sign in as `superadmin@mnfsr.gov.pk`.
2. Open `/admin` in two browser tabs.
3. Approve a registration or update another record in one tab.
4. The affected table and dashboard KPIs should refresh in the other tab without a browser reload.

If updates do not arrive, confirm that `001_portal_updates.sql` and `004_document_realtime.sql` completed successfully and inspect **Database → Publications → supabase_realtime** for the portal tables.

## 7. Server-side routes
The following routes require a valid Supabase access token and service-role environment variable:

- `POST /api/reset-demo` — super-admin-only demo reseed.
- `POST|PATCH|DELETE /api/admin-users` — super-admin user invitations and management.
- `POST /api/province-sync` — authenticated administrator sync proxy.

Province source API keys are stored in the database and are sent only by the server-side sync proxy. Use an HTTPS URL and avoid entering credentials in client-side code.
