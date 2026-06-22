# Trade Invoice Tracker

Mobile-first PWA for a sole trader/subcontractor to track clients, projects, logged hours, expense items, invoices, dashboard totals, and weekly hours exports.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- Prisma ORM
- Supabase Postgres
- PWA manifest and service worker for Add to Home Screen

## Architecture Notes

- Server-rendered App Router pages query Supabase through Prisma.
- Prisma uses the Supabase transaction-mode pooler through `DATABASE_URL`.
- Prisma migrations use the session-mode pooler through `DIRECT_URL`.
- The root route config uses the Node.js runtime for Prisma, and `vercel.json` pins Vercel Functions to `syd1` to run close to the current Supabase `ap-southeast-2` project.
- Dashboard totals ignore void invoices. Deleted invoices are gone from the database, and their linked time/items are returned to unbilled before deletion.
- Project and client delete actions are guarded. Records with invoices or billed history should be archived, not deleted.

## Environment Variables

Create `.env` locally and add the Supabase Prisma connection strings:

```bash
# Runtime connection via Supabase shared transaction-mode pooler.
DATABASE_URL="postgresql://postgres.<PROJECT-REF>:<PASSWORD>@<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Direct/session-mode connection used by Prisma migrations.
DIRECT_URL="postgresql://postgres.<PROJECT-REF>:<PASSWORD>@<REGION>.pooler.supabase.com:5432/postgres"

# Required in production to download database backups from /backup.
BACKUP_EXPORT_TOKEN="change-this-long-random-token"
```

For this Supabase project, copy the current Supabase Prisma connection strings and make sure the runtime pooler URL includes `pgbouncer=true&connection_limit=1`:

```bash
DATABASE_URL="postgresql://postgres.<PROJECT-REF>:<PASSWORD>@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.<PROJECT-REF>:<PASSWORD>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
BACKUP_EXPORT_TOKEN="change-this-long-random-token"
```

## Local Setup

```bash
pnpm install
cp .env.example .env
```

Edit `.env` and add the real Supabase database password.

For first-time database setup during development, run:

```bash
pnpm run db:migrate:dev
pnpm run db:seed
pnpm run dev
```

Open `http://localhost:3000`.

If you do not want Prisma migration files during quick prototyping, you can push the schema directly instead:

```bash
pnpm run db:push
```

For production-like workflows, prefer migrations.

## Supabase Setup

1. Create a Supabase project.
2. Go to the project database connection settings.
3. Copy the Prisma connection strings:
   - `DATABASE_URL`: shared transaction-mode pooler on port `6543` with `?pgbouncer=true&connection_limit=1`
   - `DIRECT_URL`: shared session-mode pooler on port `5432`
4. Add both values to `.env`.
5. Run `pnpm run db:migrate:dev` to create the schema.
6. Optionally run `pnpm run db:seed` for sample data.

## Vercel Deployment

1. Push the repository to GitHub.
2. Import the project into Vercel.
3. Set the build command to:

```bash
pnpm run build
```

4. Add these Vercel environment variables for Production, Preview, and Development. Do not commit `.env`:

```bash
DATABASE_URL="postgresql://postgres.<PROJECT-REF>:<PASSWORD>@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.<PROJECT-REF>:<PASSWORD>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
BACKUP_EXPORT_TOKEN="change-this-long-random-token"
```

5. Apply database migrations before or during deployment:

```bash
pnpm run db:migrate
```

`db:migrate` runs `prisma migrate deploy`, which applies committed Prisma migration files without creating new ones.

6. Confirm Vercel deployments run near Supabase. This app sets `regions: ["syd1"]` in `vercel.json`. After deployment, open `/diagnostics?token=<BACKUP_EXPORT_TOKEN>` and check `x-vercel-id`. The first segment should be `syd1`.

The diagnostics page helps choose the next fix: if TCP/TLS connect is fast but Prisma `SELECT 1` is high, Prisma engine/pooler overhead is the main problem; if both TCP/TLS and Prisma are high, network or Supabase pooler latency is the main problem; if `SELECT 1` is low but dashboard is high, query work is the main problem.

## Backup Export

Use `/backup` locally to download a JSON backup. In production, set `BACKUP_EXPORT_TOKEN` in Vercel and download with `/backup?token=<BACKUP_EXPORT_TOKEN>`. It exports:

- clients
- projects
- rate history
- time entries
- expense items
- invoices
- invoice line items

Run a backup before production migrations or any manual database maintenance.

## Private Diagnostics

Use `/diagnostics?token=<BACKUP_EXPORT_TOKEN>` to open a private performance diagnostics page. It shows the Vercel region signals available to the app plus server, TCP/TLS, Prisma first-query, Prisma second-query, count-query, and dashboard-query timings in milliseconds. It also explains whether slowness appears to be database/network latency, Prisma overhead, dashboard query work, or general server/frontend time. The page does not print secrets and is blocked in production unless `BACKUP_EXPORT_TOKEN` is set.

If Prisma timings remain high while TCP/TLS is low, the cleanest options are:

- Prisma Accelerate/Data Proxy for connection pooling and query caching without rewriting the ORM layer.
- A lightweight Postgres driver for read-heavy aggregate pages while keeping Prisma for mutations and relational writes.
- Drizzle or another lighter ORM if the app later needs a broader ORM migration.

## Production Safety

- Keep `DATABASE_URL` and `DIRECT_URL` only in local `.env`, Vercel environment variables, and secure password storage.
- Set `BACKUP_EXPORT_TOKEN` in Vercel before relying on `/backup`; production exports are blocked without it.
- Use archive/unarchive for real projects with history.
- Project/client deletion is intended only for test or unbilled setup data. If a record has invoices or billed entries, the server action blocks deletion.
- Billed time entries cannot be edited or deleted. Void/delete invoice flows release linked entries/items back to unbilled before changing invoice state.
- Supabase Postgres indexes are included for the common dashboard, invoice, project, and hours export filters.

## Troubleshooting

- `the URL must start with postgresql://`: the Vercel `DATABASE_URL` is missing, malformed, or still set to an old SQLite value.
- `Can't reach database server`: check the Supabase password, pooler host, and that `DATABASE_URL` uses port `6543` with `?pgbouncer=true&connection_limit=1`.
- Migration fails in production: confirm `DIRECT_URL` is set to the session-mode pooler on port `5432`.
- Slow first loads: check Vercel runtime logs for the executing region. Far-away regions add latency to every Supabase query.
- Region mismatch: open `/diagnostics?token=<BACKUP_EXPORT_TOKEN>` after deploy. `x-vercel-id` should start with `syd1` when Vercel is running close to the current Supabase Sydney database.
- Build fails after schema changes: run `pnpm run db:migrate` or `pnpm exec prisma generate`, then rerun `pnpm run build`.

## Useful Commands

```bash
pnpm run dev
pnpm run build
pnpm run lint
pnpm run db:migrate:dev
pnpm run db:migrate
pnpm run db:push
pnpm run db:seed
pnpm run prisma:studio
```

## Data Model Notes

Money is stored as integer cents and time is stored as minutes. A time entry snapshots the project hourly rate when it is created, and invoice line items store their own unit/total amounts. Old invoices and dashboard totals remain historically accurate even if a project hourly rate changes later.

Draft invoices create invoice line items only. Source time entries and expense items are marked billed when the invoice is marked sent or paid.
