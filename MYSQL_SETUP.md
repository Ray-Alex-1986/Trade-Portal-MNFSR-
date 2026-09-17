# MySQL setup

This project uses **MySQL only**.

```bash
copy .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run build
npm run start
```

| Command | Purpose |
|---|---|
| `npm run db:migrate` | First-time DB create + schema + master data + bootstrap admin |
| `npm run db:seed` | Demo users + companies/exports/complaints/notifications/audit logs |
| `npm run build` | Production Next.js build |

## Environment

```dotenv
DATABASE_URL=mysql://root:root123@localhost:3306/export_portal
MYSQL_DATABASE_URL=mysql://root:root123@localhost:3306/export_portal
MYSQL_SSL=false
MYSQL_CONNECTION_LIMIT=10
MYSQL_SESSION_SECRET=<at-least-32-random-characters>
NEXT_PUBLIC_PORTAL_BACKEND=mysql
NEXT_PUBLIC_SHOW_DEMO_LOGINS=true
```

Do not reuse another app's database (for example `complaint_management`). This portal uses its own `export_portal` database.

## Security notes

- Never put `MYSQL_DATABASE_URL` or `MYSQL_SESSION_SECRET` in `NEXT_PUBLIC_*` variables.
- MySQL has no Postgres-style RLS; every protected query goes through `/api/mysql/*` with a signed session cookie.
- Province sync allows only public HTTPS JSON sources and keeps API keys server-side.
