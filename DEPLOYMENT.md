# Deploying the portal so all users share one dataset

## The problem this solves

With no database configured the portal runs in **demo mode**: every browser
keeps its own private copy of the data in `localStorage`. An exporter created
on one machine does not exist on any other, and each device generates its own
randomised demo dataset, so the same super-admin account shows different
figures on different computers.

An amber banner reading "Demo mode: no database is connected" appears on every
page while this is the case. Once the steps below are complete the banner
disappears and every user reads and writes the same rows.

---

## 1. Create the Supabase project

1. Sign in at [supabase.com/dashboard](https://supabase.com/dashboard) and choose
   **New project**. Pick a region close to your users.
2. Wait for provisioning to finish.
3. Open **Project Settings → API** and copy three values:
   - Project URL
   - `anon` / publishable key
   - `service_role` key (secret; never expose it to a browser)

## 2. Create the database objects

1. Open **SQL Editor → New query**.
2. Paste the entire contents of [`supabase/setup.sql`](supabase/setup.sql) and run it.

That one file contains the schema, row-level security policies, RPC functions,
the realtime publication, and the demo dataset, applied in the correct order.
Run it once, on an empty project.

To rebuild that file after editing any migration:

```bash
node scripts/build-supabase-setup.mjs
```

If you prefer to run the sources individually, apply them in this order:
`supabase-schema.sql`, then `001_portal_updates.sql`, `002_demo_seed.sql`,
`003_public_portal_stats.sql`, `004_document_realtime.sql`.

## 3. Configure Auth

1. Go to **Authentication → Providers → Email** and make sure the email
   provider is enabled.
2. Go to **Authentication → URL Configuration** and add your site URL, for
   example `https://your-portal.vercel.app`, plus `http://localhost:3000` for
   local development.

You do not need to disable email confirmation. When the service role key is
present, public registration runs server-side through `POST /api/register` and
creates the account already confirmed.

## 4. Set the Vercel environment variables

In your Vercel project, open **Settings → Environment Variables** and add:

| Name | Value | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL from step 1 | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | Production, Preview, Development |

Two things that catch people out:

- **Scope matters.** Variables added only to Preview leave Production in demo
  mode. Tick every environment you actually use.
- **You must redeploy.** Next.js inlines `NEXT_PUBLIC_*` values into the
  browser bundle at build time, so adding the variables changes nothing until a
  new build runs. Trigger **Deployments → Redeploy** (or push a commit).

## 5. Verify that data is now shared

1. Open the deployed site. The amber demo-mode banner must be gone. If it is
   still there, the build did not receive the two `NEXT_PUBLIC_` values.
2. Sign in as a super admin and create a user under **User Management**.
3. Open the site on a second machine, or in a different browser profile, and
   sign in again. The new user must be listed there too.
4. Register an exporter on one machine and confirm it appears in the review
   queue on the other.

## 6. Replace the demo accounts

`supabase/setup.sql` seeds ten demo logins that all share the password
`Demo@12345`. They exist to demonstrate each role and **must not survive into
real use**.

Create your own super admin locally:

```bash
SUPABASE_URL='https://<project-ref>.supabase.co' \
SUPABASE_SERVICE_ROLE_KEY='<service-role-key>' \
SUPABASE_BOOTSTRAP_ADMIN_EMAIL='admin@mnfsr.gov.pk' \
SUPABASE_BOOTSTRAP_ADMIN_NAME='Portal Super Admin' \
SUPABASE_BOOTSTRAP_ADMIN_PASSWORD='<at least 12 characters>' \
node supabase/bootstrap-super-admin.mjs
```

Then sign in as that account and, under **User Management**, delete or
deactivate every seeded demo user. Invite real officers from the same screen:
leave the password field blank to send a Supabase password-setup invitation, or
set a temporary password to hand over directly.

To clear the seeded demo companies, records, and complaints, delete them from
the Supabase table editor. Re-running `SELECT reset_demo_data();` restores the
demo dataset instead of clearing it, so do not use it on a live system.

---

## Using MySQL instead

The portal also ships a native MySQL backend. See [`MYSQL_SETUP.md`](MYSQL_SETUP.md).
In short: apply `mysql/schema.sql`, set `MYSQL_DATABASE_URL`, `MYSQL_SSL`,
`MYSQL_SESSION_SECRET` and `NEXT_PUBLIC_PORTAL_BACKEND=mysql`, redeploy, then
run `mysql/bootstrap-super-admin.mjs`. Vercel does not host MySQL, so use a
managed provider reachable over TLS.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Demo-mode banner still shows | Build did not see `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Check the variable scope, then redeploy |
| Data still differs per machine | Same as above; the app is still on browser storage | As above |
| Sign-in says the account is not provisioned | An auth user exists with no matching `profiles` row | Create the profile, or use the bootstrap script |
| Registration reports it is not configured | `SUPABASE_SERVICE_ROLE_KEY` missing, so the browser fallback ran into email confirmation | Add the key and redeploy |
| Admin screens are empty for an officer | Row-level security is filtering the rows | Confirm the signed-in user's role in `profiles`, and that `001_portal_updates.sql` ran |
| Old demo data lingers after connecting a database | Leftover `localStorage` from demo mode | Clear site data in the browser, or sign out and back in |
