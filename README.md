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

# Supabase Auth and Storage. Legacy anon keys can be used here if your project
# has not moved to publishable keys yet.
NEXT_PUBLIC_SUPABASE_URL="https://<PROJECT-REF>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="<SUPABASE-PUBLISHABLE-KEY>"
```

For this Supabase project, copy the current Supabase Prisma connection strings and make sure the runtime pooler URL includes `pgbouncer=true&connection_limit=1`:

```bash
DATABASE_URL="postgresql://postgres.<PROJECT-REF>:<PASSWORD>@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.<PROJECT-REF>:<PASSWORD>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
BACKUP_EXPORT_TOKEN="change-this-long-random-token"
NEXT_PUBLIC_SUPABASE_URL="https://<PROJECT-REF>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="<SUPABASE-PUBLISHABLE-KEY>"
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
5. In Supabase Auth settings, enable email/password signups if you want public signup.
6. Add these redirect URLs in Supabase Auth URL configuration:
   - `http://localhost:3000/auth/callback`
   - `https://<your-vercel-domain>/auth/callback`
7. Copy the Project URL and publishable key from Supabase and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
8. Create a private Supabase Storage bucket named `business-logos`.
9. Add Storage policies for `business-logos` so authenticated users can read/write/delete only files in their own folder. The app uploads to paths like `<user-id>/logo-...`.
10. Run `pnpm run db:migrate:dev` to create the schema.
11. Optionally run `pnpm run db:seed` for sample data.

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
NEXT_PUBLIC_SUPABASE_URL="https://<PROJECT-REF>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="<SUPABASE-PUBLISHABLE-KEY>"
```

5. Apply database migrations before or during deployment:

```bash
pnpm run db:migrate
```

`db:migrate` runs `prisma migrate deploy`, which applies committed Prisma migration files without creating new ones.

6. Confirm Vercel deployments run near Supabase. This app sets `regions: ["syd1"]` in `vercel.json`. After deployment, open `/diagnostics?token=<BACKUP_EXPORT_TOKEN>` and check `x-vercel-id`. The first segment should be `syd1`.

The diagnostics page helps choose the next fix: if TCP/TLS connect is fast but Prisma `SELECT 1` is high, Prisma engine/pooler overhead is the main problem; if both TCP/TLS and Prisma are high, network or Supabase pooler latency is the main problem; if `SELECT 1` is low but dashboard is high, query work is the main problem.

## Backup Export

Use `/backup` locally while logged in to download a JSON backup. In production, set `BACKUP_EXPORT_TOKEN` in Vercel, log in, and download with `/backup?token=<BACKUP_EXPORT_TOKEN>`. It exports only the logged-in user's data:

- business profile
- clients
- projects
- rate history
- time entries
- expense items
- invoices
- invoice line items

Run a backup before production migrations or any manual database maintenance.

## Private Diagnostics

Use `/diagnostics?token=<BACKUP_EXPORT_TOKEN>` while logged in to open a private performance diagnostics page. It shows the Vercel region signals available to the app plus server, TCP/TLS, Prisma first-query, Prisma second-query, count-query, and dashboard-query timings in milliseconds. It also explains whether slowness appears to be database/network latency, Prisma overhead, dashboard query work, or general server/frontend time. The page does not print secrets, profile details, or bank details.

## Authentication And Business Profile

- `/signup` creates a Supabase Auth account.
- `/login` signs users in with Supabase Auth.
- Dashboard, clients, projects, invoices, hours export, backup, diagnostics, and server actions require a logged-in user.
- `/business-profile` lets each user save their own trading name, legal details, ABN/ACN, contact details, GST defaults, bank details, invoice notes, email message, logo, and footer.
- Logo files are uploaded to the `business-logos` Storage bucket under the user's own folder.
- Invoice detail pages show the user's logo when available.

## Multi-User Data Migration Notes

Phase 1 adds nullable `ownerId` columns to existing user-owned tables so production data is preserved. New records always get the logged-in Supabase Auth user ID. Existing records with `ownerId = NULL` are intentionally hidden from all users until you backfill them.

To assign old single-user data to your first Supabase Auth account, first create/log in as that user, copy their Supabase Auth user ID, then run a carefully reviewed SQL backfill in Supabase SQL Editor:

```sql
-- Replace this with the intended Supabase Auth user ID.
do $$
declare target_user text := '00000000-0000-0000-0000-000000000000';
begin
  update "Client" set "ownerId" = target_user where "ownerId" is null;
  update "Project" set "ownerId" = target_user where "ownerId" is null;
  update "RateHistory" set "ownerId" = target_user where "ownerId" is null;
  update "TimeEntry" set "ownerId" = target_user where "ownerId" is null;
  update "ExpenseItem" set "ownerId" = target_user where "ownerId" is null;
  update "Invoice" set "ownerId" = target_user where "ownerId" is null;
  update "InvoiceLineItem" set "ownerId" = target_user where "ownerId" is null;
end $$;
```

Do not run that SQL until you are certain which account should own the existing data.

If Prisma timings remain high while TCP/TLS is low, the cleanest options are:

- Prisma Accelerate/Data Proxy for connection pooling and query caching without rewriting the ORM layer.
- A lightweight Postgres driver for read-heavy aggregate pages while keeping Prisma for mutations and relational writes.
- Drizzle or another lighter ORM if the app later needs a broader ORM migration.

## Production Safety

- Keep `DATABASE_URL` and `DIRECT_URL` only in local `.env`, Vercel environment variables, and secure password storage.
- Set `BACKUP_EXPORT_TOKEN` in Vercel before relying on `/backup`; production exports are blocked without it.
- Each user-owned table is scoped by Supabase Auth user ID in Prisma queries and server actions.
- Prisma uses the database pooler directly, so isolation is enforced in application code. Consider adding database RLS later for defence in depth.
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
- Logo upload fails: confirm the `business-logos` bucket exists and has authenticated per-user folder policies.
- Login works locally but not in production: confirm the Vercel URL is allowed in Supabase Auth redirect URLs and that `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set in Vercel.

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
