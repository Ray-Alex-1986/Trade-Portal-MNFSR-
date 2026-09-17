# Deploying the Export Portal (MySQL)

## Local / staging

1. Provision MySQL 8.0+ with a dedicated database (`export_portal`).
2. Copy `.env.example` → `.env` and set `DATABASE_URL` / `MYSQL_*` values.
3. Run:

```bash
npm install
npm run db:setup
npm run db:seed-data   # optional demo dataset
npm run build
npm run start
```

## Hosted (e.g. Vercel + managed MySQL)

1. Create a managed MySQL 8 instance reachable over TLS.
2. Set environment variables in the host:

| Name | Notes |
|---|---|
| `DATABASE_URL` or `MYSQL_DATABASE_URL` | `mysqls://…` for TLS |
| `MYSQL_SSL` | `true` |
| `MYSQL_SESSION_SECRET` | ≥ 32 random characters |
| `NEXT_PUBLIC_PORTAL_BACKEND` | `mysql` |
| `NEXT_PUBLIC_SHOW_DEMO_LOGINS` | `false` in real environments |

3. Apply `mysql/schema.sql` and `mysql/seed-master-data.sql` once.
4. Bootstrap an admin with `npm run db:bootstrap-admin`.
5. Redeploy after changing any `NEXT_PUBLIC_*` value (they are baked at build time).

## Demo reset

In local/dev, super-admins can use **Reset Demo Data** on the admin dashboard. That reloads `mysql/seed-portal-data.mjs`. Production resets stay disabled unless `ALLOW_MYSQL_DEMO_RESET=true`.
