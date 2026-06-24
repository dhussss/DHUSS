# Trade Invoice Tracker

Mobile-first PWA for a sole trader/subcontractor to track clients, projects, logged hours, work expenses, invoice expense items, invoices, dashboard totals, insights, and weekly hours exports.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- Prisma ORM
- Supabase Postgres
- User-owned email sending through the device's default mail app (`mailto:`)
- PWA manifest and service worker for Add to Home Screen

## Architecture Notes

- Server-rendered App Router pages query Supabase through Prisma.
- Prisma uses the Supabase transaction-mode pooler through `DATABASE_URL`.
- Prisma migrations use the session-mode pooler through `DIRECT_URL`.
- The root route config uses the Node.js runtime for Prisma, and `vercel.json` pins Vercel Functions to `syd1` to run close to the current Supabase `ap-southeast-2` project.
- Dashboard totals ignore void invoices. Deleted invoices are gone from the database, and their linked time/items are returned to unbilled before deletion.
- Dashboard and Insights analytics use owner-scoped, cached read helpers and short revalidation so the app stays responsive after time, project, client, and invoice mutations.
- Project and client delete actions are guarded. Records with invoices or billed history should be archived, not deleted.
- Tax and super set-aside figures are estimates only, not tax advice. Australian resident tax brackets are centralised in `src/lib/planning.ts` so the rates can be reviewed and updated in one place.

## Environment Variables

Create `.env` locally and add the Supabase Prisma connection strings:

```bash
# Runtime connection via Supabase shared transaction-mode pooler.
DATABASE_URL="postgresql://postgres.<PROJECT-REF>:<PASSWORD>@<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Direct/session-mode connection used by Prisma migrations.
DIRECT_URL="postgresql://postgres.<PROJECT-REF>:<PASSWORD>@<REGION>.pooler.supabase.com:5432/postgres"

# Required in production to download database backups from /backup.
BACKUP_EXPORT_TOKEN="change-this-long-random-token"

# Public app URL used for secure client invoice links.
APP_BASE_URL="https://<your-vercel-domain>"

# Optional future server-side email delivery. The normal workflow opens the
# user's own email app and does not require these.
# RESEND_API_KEY=""
# RESEND_FROM_EMAIL=""

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
APP_BASE_URL="https://<your-vercel-domain>"
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

Storage policy SQL for the private `business-logos` bucket:

```sql
create policy "Users can read their own business logos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'business-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload their own business logos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'business-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can replace their own business logos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'business-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'business-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own business logos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'business-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

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
APP_BASE_URL="https://<your-vercel-domain>"
NEXT_PUBLIC_SUPABASE_URL="https://<PROJECT-REF>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="<SUPABASE-PUBLISHABLE-KEY>"
```

5. Apply database migrations before or during deployment:

```bash
pnpm run db:migrate
```

`db:migrate` runs `prisma migrate deploy`, which applies committed Prisma migration files without creating new ones.

After this pass, make sure production has applied:

```bash
pnpm run db:migrate
```

The new migration adds Business Profile tax/super planning settings, the work expense register, and day-off logs.

6. Confirm Vercel deployments run near Supabase. This app sets `regions: ["syd1"]` in `vercel.json`. After deployment, open `/diagnostics?token=<BACKUP_EXPORT_TOKEN>` and check `x-vercel-id`. The first segment should be `syd1`.

The diagnostics page helps choose the next fix: if TCP/TLS connect is fast but Prisma `SELECT 1` is high, Prisma engine/pooler overhead is the main problem; if both TCP/TLS and Prisma are high, network or Supabase pooler latency is the main problem; if `SELECT 1` is low but dashboard is high, query work is the main problem.

## Invoice Email Setup

No email provider is required for the normal workflow. `/invoices/<id>/email` prepares a short, editable plain-text email, then opens the user's default email app with a `mailto:` link so the invoice is sent from that user's own account.

Set `APP_BASE_URL` in Vercel if you use public invoice links. When a public link exists, Business Profile controls whether that link is included in the prepared email.

The default invoice email template can be customised in `/business-profile` with merge tags: `{{clientName}}`, `{{invoiceNumber}}`, `{{projectName}}`, `{{amountDue}}`, `{{dueDate}}`, `{{senderName}}`, and `{{businessName}}`. Payment details and a short invoice summary are optional and off by default.

Resend/API-key based server sending is not part of the active workflow. Fully branded HTML invoice emails require a verified sending provider such as Resend, Postmark, or similar, and are a future option. If server-side sending is reintroduced later, treat `RESEND_API_KEY` and `RESEND_FROM_EMAIL` as optional future-only environment variables.

## Backup Export

Use `/backup` locally while logged in to download a JSON backup. In production, set `BACKUP_EXPORT_TOKEN` in Vercel, log in, and download with `/backup?token=<BACKUP_EXPORT_TOKEN>`. It exports only the logged-in user's data:

- business profile
- clients
- projects
- rate history
- time entries
- expense items
- work expenses
- day-off logs
- invoices
- invoice line items
- audit logs

Run a backup before production migrations or any manual database maintenance.

## Private Diagnostics

Use `/diagnostics?token=<BACKUP_EXPORT_TOKEN>` while logged in to open a private performance diagnostics page. It shows the Vercel region signals available to the app plus server, TCP/TLS, Prisma first-query, Prisma second-query, count-query, and dashboard-query timings in milliseconds. It also explains whether slowness appears to be database/network latency, Prisma overhead, dashboard query work, or general server/frontend time. The page does not print secrets, profile details, or bank details.

## Dashboard And Insights

- The dashboard weekly planner is a Monday-to-Sunday performance chart, not a rolling seven-day view.
- The 30-day average is now an included-day average. It includes days with logged hours and explicit planned day-off records, but it does not punish normal quiet weekends with zero hours.
- Invoice Snapshot includes Unbilled work across active projects, combining unbilled time entries and expense items.
- `/insights` provides workload, revenue, tax set-aside estimates, optional super planning, work expense summaries, current-quarter trend, financial-year paid income, and concise insight cards.
- The tax set-aside panel annualises current-week billable value and estimates tax using the configured bracket table. Users can switch the estimate off or set a custom percentage override in Business Profile.
- Optional super planning is a planning estimate only. It does not record or assume any super contribution has been paid.
- The bottom nav keeps five main items. Hours Export, Insights, Expenses, Day Off, Business Profile, Backup, Audit, Privacy, and Logout live under `/more`.

## Expenses And Day Offs

- `/expenses` logs work-related expenses for tax/audit tracking.
- Expenses can be general or linked to a project. Linked expenses appear on the project detail page.
- Expense fields include date, category, description, supplier/vendor, amount, GST included/amount, payment method, receipt/reference, notes, billable/reimbursable, and status.
- Expense statuses are logged, allocated, invoiced/reimbursed, and tax record only.
- Invoiced/reimbursed expenses should be archived instead of destructively deleted.
- `/day-off` logs planned zero-hour work days. These records improve rolling averages without counting ordinary inactive weekends.
- Backup exports include work expenses and day-off logs.
- Audit log entries are written for expense create/update/archive/restore/delete and day-off create/update events.

## Authentication And Business Profile

- `/signup` creates a Supabase Auth account.
- `/login` signs users in with Supabase Auth.
- Dashboard, clients, projects, invoices, hours export, backup, diagnostics, and server actions require a logged-in user.
- `/business-profile` lets each user save their own trading name, legal details, ABN/ACN, contact details, GST defaults, bank details, invoice notes, email message, logo, and footer.
- `/business-profile` also stores default invoice email subject, plain-text greeting, intro, payment line, sign-off, optional email include settings, reply-to email, and the app theme preset.
- `/business-profile` stores tax set-aside preferences, custom tax percentage override, GST set-aside preference, optional super planning percentage, super fund name, and member number.
- Logo files are uploaded directly from the browser to the private `business-logos` Storage bucket under the user's own folder. The server action stores only the Storage path, which avoids Vercel's 1 MB Server Action body limit.
- Logo validation allows PNG, JPG, WEBP, and SVG files up to 1 MB. 500 KB or smaller is recommended for fast invoice previews.
- Invoice detail pages show the user's logo when available.
- Business profile now includes an invoice prefix. The default is `INV-`.

## Invoice Workflow

- `/invoices/new` lets a user select a project, date range, and invoice mode.
- Simple invoices show one labour line plus expenses.
- Detailed invoices show each labour line, hours, rate, notes, and expenses.
- Draft invoices do not mark time entries or expense items as billed.
- Marking a draft invoice sent or paid finalises it, marks linked entries/items billed, calculates GST from the current business profile, and stores business/client snapshots on the invoice.
- Sent and paid invoices do not silently mutate if the business profile or client changes later.
- Invoice preview at `/invoices/<id>` is printable and supports browser Print / Save as PDF.
- Invoice preview uses a centred A4 print layout with `@page` margins and print-specific invoice containers so the saved PDF uses the printable page width instead of inheriting app/dashboard layout constraints.
- The public invoice route `/public/invoices/<token>` uses the same print rules as the private invoice preview.
- App navigation, action buttons, and app backgrounds are hidden in print.
- Invoice preview supports Copy Invoice Text, browser Print / Save as PDF, and a prepare-email workflow at `/invoices/<id>/email`.
- Email preparation requires the invoice to be sent or paid. It does not require `RESEND_API_KEY` or `RESEND_FROM_EMAIL`.
- The email composer opens the user's own email app with the recipient, subject, and professional plain-text body filled in. Copy Email Text is available as a fallback.
- `APP_BASE_URL` is only needed when the prepared email includes an active public invoice link.
- Sent and paid invoices can create a secure client invoice link at `/public/invoices/<token>`. Links can be revoked or regenerated from the invoice page.
- Public invoice links are token-based, unlisted, and only work while enabled on sent or paid invoices. Void invoices automatically disable their public link.
- Invoice list supports search plus filters for all, draft, sent, paid, and void invoices.
- Sent invoices past their due date show an overdue indicator.
- Future finalised invoices snapshot business contact, website, default notes, email message wording, and footer/signature wording so older sent/paid invoices do not drift when the business profile changes.

## Audit Log And Privacy

- `/audit-log` shows recent account-scoped activity for the logged-in user.
- Audit metadata intentionally avoids passwords, auth tokens, full bank details, and secrets.
- Invoice email audit events record when an email is prepared/opened, plus recipient summary and body/subject lengths only. The app cannot know whether the user sent the message from their mail app.
- `/privacy` explains user isolation, stored data, backups, bank details, and the app's responsibility boundaries in plain English.

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
- Set `APP_BASE_URL` to the canonical production URL so emailed invoice links point to the right deployment.
- Each user-owned table is scoped by Supabase Auth user ID in Prisma queries and server actions.
- Prisma uses the database pooler directly, so isolation is enforced in application code. Consider adding database RLS later for defence in depth.
- Use archive/unarchive for real projects with history.
- Project/client deletion is intended only for test or unbilled setup data. If a record has invoices or billed entries, the server action blocks deletion.
- Billed time entries cannot be edited or deleted. Void/delete invoice flows release linked entries/items back to unbilled before changing invoice state.
- Supabase Postgres indexes are included for the common dashboard, invoice, project, and hours export filters.
- Browser print-to-PDF is the current stable PDF export method. Server-side PDF generation is not implemented yet.
- Public invoice links are bearer links. Anyone with the active token can view that invoice, so revoke or regenerate links if they are shared with the wrong person.

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

When deploying the invoice hardening/audit update to production, apply the committed migration:

```bash
pnpm run db:migrate
```

This applies:

```text
20260624000000_invoice_profile_audit_hardening
20260625000000_invoice_document_snapshot_polish
```

## Data Model Notes

Money is stored as integer cents and time is stored as minutes. A time entry snapshots the project hourly rate when it is created, and invoice line items store their own unit/total amounts. Old invoices and dashboard totals remain historically accurate even if a project hourly rate changes later.

Draft invoices create invoice line items only. Source time entries and expense items are marked billed when the invoice is marked sent or paid.
