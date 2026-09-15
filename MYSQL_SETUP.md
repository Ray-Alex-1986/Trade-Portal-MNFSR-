# MySQL cutover preparation

## Current deployment boundary
The active Vercel approval deployment continues to use Supabase by default. The browser selects MySQL only when the non-secret build setting `NEXT_PUBLIC_PORTAL_BACKEND=mysql` is present; leave it unset (or set it to `supabase`) in the current approval environment. MySQL credentials remain server-only in both modes.

Vercel does not host MySQL itself. Use a managed MySQL 8.0+ service reachable from Vercel with TLS enabled, and keep its credentials in Vercel environment variables only. `NEXT_PUBLIC_PORTAL_BACKEND` is a public selector, not a credential, and changing it requires a new deployment because Next.js embeds public environment values at build time.

## Included MySQL artifacts
- `mysql/schema.sql` creates the portal schema, lookup roles, foreign keys, indexes, and JSON columns.
- `src/lib/mysql/` provides a pooled server-only MySQL client, signed HTTP-only session helpers, scrypt password hashing, protected portal operations, province synchronization, public aggregate statistics, complaint tracking, public complaint submission, and exporter registration transactions.
- `src/app/api/mysql/` provides native MySQL Auth, protected portal and province-sync routes, and safe public API endpoints. These routes run in the Node.js runtime; database credentials never enter client bundles.
- `src/lib/auth-mysql.tsx` and `src/lib/data-store-mysql.tsx` retain the existing client contracts while using signed cookie sessions and 15-second bounded polling.
- `mysql/bootstrap-super-admin.mjs` creates the initial MySQL super-admin after the schema is installed.

## Provision a staging MySQL database
1. Create an empty MySQL 8.0+ database with `utf8mb4` enabled.
2. Apply `mysql/schema.sql` once using a database administrator account.
3. Import the operational lookup values from Supabase before testing forms. The schema seeds institutions and roles only; it does not seed product, country, province, port, complaint-category, or document-type master data.
4. Set these environment variables in the approved target environment only:
   ```dotenv
   MYSQL_DATABASE_URL=mysqls://<user>:<url-encoded-password>@<host>:3306/<database>
   MYSQL_SSL=true
   MYSQL_CONNECTION_LIMIT=5
   MYSQL_SESSION_SECRET=<at-least-32-random-characters>
   NEXT_PUBLIC_PORTAL_BACKEND=mysql
   ```
5. Create the first administrator locally or in a one-off secure job. Do not store bootstrap credentials in Vercel after use:
   ```powershell
   $env:MYSQL_DATABASE_URL = 'mysqls://...'
   $env:MYSQL_BOOTSTRAP_ADMIN_EMAIL = 'admin@example.gov.pk'
   $env:MYSQL_BOOTSTRAP_ADMIN_NAME = 'Portal Super Admin'
   $env:MYSQL_BOOTSTRAP_ADMIN_PASSWORD = '<unique-12-plus-character-password>'
   node mysql/bootstrap-super-admin.mjs
   ```
6. Verify login, protected portal reads, public statistics, public complaint tracking, exporter registration, and an approved province-sync source. Do not publish database diagnostics or credentials.

## Cutover rules
1. Keep Supabase as the source of truth while the approval deployment is active.
2. Schedule a maintenance window before import; stop writes to Supabase first.
3. Export and import lookup tables first (`institutions`, `roles`, `master_data`), then `profiles`, companies, export records, documents, complaints, notifications, audit logs, and province tables.
4. Preserve existing UUIDs during import so every foreign-key relationship remains valid.
5. Convert Postgres arrays to JSON for `main_export_categories`, and preserve `province_data_records.data` as JSON.
6. Native MySQL sessions use scrypt password hashes; Supabase passwords must not be copied. Issue fresh credentials through the approved onboarding process for every migrated user.
7. Verify row counts, foreign-key integrity, public aggregate statistics, public complaint tracking, role access, user onboarding, and province-sync behavior in staging before switching the application backend.
8. Keep `NEXT_PUBLIC_PORTAL_BACKEND` unset or `supabase` for the Vercel approval deployment. Set it to `mysql` only in the approved environment after the validation above, then redeploy that environment.

## Security and Vercel constraints
- Never use `NEXT_PUBLIC_` for `MYSQL_DATABASE_URL`, `MYSQL_SESSION_SECRET`, or any provincial API key. `NEXT_PUBLIC_PORTAL_BACKEND` is the only MySQL-related public setting.
- The MySQL pool is server-only and keeps a small per-instance limit suitable for Vercel serverless functions. Use a provider with connection pooling/proxy support for production scale.
- MySQL does not have Supabase/PostgreSQL RLS. Every protected MySQL query goes through a server route that validates the signed session and applies the existing role permission matrix.
- Province sync permits only public HTTP(S) hosts, rejects credentials, redirects, private/local addresses, private DNS resolutions, oversized responses, and non-JSON payloads. Keep provincial API keys server-only.
- Supabase Realtime cannot be reused with MySQL. The MySQL provider uses 15-second bounded polling until a managed event provider is selected.
