# Trade Invoice Tracker

Mobile-first job, time, expense, subcontractor, and invoice tracking for Australian tradespeople. The app is a Next.js PWA backed by Supabase Postgres and Supabase Auth, with server-generated invoice PDFs.

The default product name is centrally configured and can be changed without editing UI components. Platform identity is separate from each tenant's business profile and invoice snapshots.

## What It Covers

- Email/password accounts, password recovery, onboarding, and a reusable tutorial library
- Owner-isolated clients, projects, time entries, expenses, invoices, settings, and business profiles
- Assigned subcontractor projects, automatic employee-hour visibility, wage obligations, reversals, and payment history
- Draft, sent, paid, unpaid, unsent, void, restored, and deleted invoice workflows
- Server-generated PDF invoices, reviewed SMTP email delivery, optional Twilio MMS delivery, and token-based client links
- Dashboard, billing calendar, hours export, expenses, and business insights
- Installable PWA behaviour for iPhone and desktop

Quotes and receipt-photo storage are not currently supported.

## Stack

- Next.js 15 App Router, React 19, TypeScript, and Tailwind CSS
- Prisma 6 with Supabase Postgres
- Supabase Auth and Storage
- PDFKit for server-side A4 invoice generation
- Nodemailer for optional SMTP delivery
- Twilio REST API for optional MMS delivery
- Vercel Functions pinned to Sydney (`syd1`)

## Local Setup

Requirements: Node.js 22 and pnpm.

```bash
pnpm install
cp .env.example .env
```

Fill in `.env`, then run:

```bash
pnpm run db:migrate
pnpm run dev
```

Open `http://localhost:3000`.

The demo seed is destructive and refuses to run unless explicitly acknowledged against an isolated development database:

```bash
ALLOW_DESTRUCTIVE_SEED=true pnpm run db:seed
```

It also refuses to run when `VERCEL_ENV=production`.

## Environment Variables

The complete template is in `.env.example`.

### Required

```env
# Runtime queries only: Supabase transaction-mode pooler.
DATABASE_URL="postgresql://postgres.<PROJECT-REF>:<PASSWORD>@<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Migrations only: Supabase session-mode pooler.
DIRECT_URL="postgresql://postgres.<PROJECT-REF>:<PASSWORD>@<REGION>.pooler.supabase.com:5432/postgres"

NEXT_PUBLIC_SUPABASE_URL="https://<PROJECT-REF>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="<PUBLISHABLE-KEY>"
DIAGNOSTICS_TOKEN="<LONG-RANDOM-TOKEN>"
APP_BASE_URL="https://<CANONICAL-PRODUCTION-DOMAIN>"
NEXT_PUBLIC_PRODUCT_NAME="Trade Invoice Tracker"
NEXT_PUBLIC_PRODUCT_SHORT_NAME="Trade Tracker"
NEXT_PUBLIC_PRODUCT_DESCRIPTION="Work, expense, team and invoice tracking for Australian trade businesses."
NEXT_PUBLIC_SUPPORT_EMAIL="support@example.com"
```

`DATABASE_URL` is the only database URL used by the running app. `DIRECT_URL` is reserved for Prisma migrations.
Existing deployments can continue using `BACKUP_EXPORT_TOKEN` as a legacy diagnostics-token fallback while they transition to `DIAGNOSTICS_TOKEN`.

### Optional Private Logo Rendering

The `business-logos` bucket remains private. To show private logos on anonymous client invoice pages and PDFs, add a server-only Supabase secret key:

```env
SUPABASE_SECRET_KEY="<SUPABASE-SECRET-KEY>"
```

Never use a `NEXT_PUBLIC_` prefix for this key. It is optional; invoices fall back to a business initial when it is absent. The legacy `SUPABASE_SERVICE_ROLE_KEY` name is also recognised.

### Optional Invoice Email

```env
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="smtp-account@example.com"
SMTP_PASSWORD="<PROVIDER-SECRET>"
INVOICE_FROM_EMAIL="invoices@verified-platform-domain.example"
```

The user reviews the recipient, subject, and plain-text body before confirming delivery. The generated PDF is attached server-side. The visible display name is `Business Name via Product Name`, the actual From address is the verified platform address, and Reply-To is the tenant's configured reply-to or business email. A hidden confirmation copy is addressed to the business-profile email, falling back to the configured sender email.

SMTP acceptance proves that the provider accepted the message; it is not a delivery or read receipt. Messages sent by the server may not appear in Apple Mail's Sent folder. The confirmation copy provides an independent record.

The platform-sent model deliberately prevents arbitrary sender spoofing. Custom business-domain sending is not currently supported; it requires per-domain ownership, SPF, DKIM, and provider verification. Platform authentication emails are configured separately in Supabase Auth and must use the platform identity.

Local and Vercel preview deployments cannot send real email or MMS unless `ALLOW_NON_PRODUCTION_DELIVERY=true` is deliberately set for controlled testing. Do not enable it with real client recipients.

### Optional Invoice MMS

```env
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_FROM_NUMBER=""
# Or use TWILIO_MESSAGING_SERVICE_SID instead of TWILIO_FROM_NUMBER.
```

Twilio fetches the PDF from `APP_BASE_URL/public/invoices/<token>/pdf`, so `APP_BASE_URL` must be the canonical HTTPS production URL.

Resend is not part of the active workflow. `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are optional placeholders for a future branded HTML-email path.

## Supabase Setup

1. Create a Supabase project in the same broad region as Vercel. This deployment uses Sydney.
2. Enable email/password signups in Supabase Auth.
3. Add these Auth redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://<production-domain>/auth/callback`
   - Any Vercel preview domains used for authentication testing
4. Set the Site URL to the canonical production domain.
5. Add the required environment variables above.
6. Apply committed migrations:

```bash
pnpm run db:migrate
```

The migrations create the schema, indexes, constraints, the private `business-logos` bucket, and owner-folder Storage policies. They also enable RLS and revoke direct CRUD grants from Supabase `anon` and `authenticated` roles for the Prisma-owned business tables. Do not recreate those policies manually.

The Prisma database role connects through the pooler and performs server-side queries. Application queries and mutations still check the authenticated `ownerId`; the database hardening prevents browser Supabase API roles from directly bypassing the app.

The current tenancy boundary is one owner account per business, with assigned-worker access controlled through team membership and project assignments. This safely isolates the current product model, but ownership transfer, multiple administrators, and business switching require a dedicated workspace/membership migration before unrestricted public rollout. See `docs/PRODUCT_READINESS.md`.

Run the read-only audit after migrations:

```bash
pnpm run audit:database
```

Expected results:

- `exposedTables` is empty
- `tablesWithoutRls` is empty
- `business-logos` exists with four owner-scoped policies
- all mismatch, duplicate-reservation, invalid-value, and invoice-total counts are zero

Legacy rows with a null `ownerId` may be reported. They are hidden from users and must not be assigned until the intended owner account is known.

## Authentication

- `/signup` creates a Supabase Auth account.
- `/login` signs in and preserves a safe local destination.
- `/forgot-password` requests a Supabase recovery email.
- `/reset-password` sets the new password after the Auth callback establishes a recovery session.

Supabase Auth owns verification, recovery, and platform-level email delivery. Configure its Site URL, redirect allow-list, branded SMTP sender, and templates for each environment. Invoice SMTP credentials are not used for authentication messages.

## Public Trust and Account Surfaces

- `/support` provides public support and safe incident-reporting guidance.
- `/legal/privacy` and `/legal/terms` describe current beta behaviour and clearly require formal legal review.
- `/account` lets an authenticated user download a tenant-scoped JSON export and explains the reviewed account-closure process.
- Public invoice URLs use random high-entropy tokens, are revocable, and exclude void invoices.

The export strips internal owner IDs, invitation token hashes, and public invoice tokens. Automated destructive business deletion is intentionally deferred until financial retention, ownership transfer, pending invoice, and file cleanup rules are approved.
- Protected pages and every server mutation require an authenticated user.
- Client, project, invoice, team, expense, and profile reads are owner-scoped.

Test the production password-reset email and callback before inviting external testers. Supabase email delivery limits and custom SMTP settings are managed in the Supabase dashboard.

## Main Workflows

### Onboarding

New users select sole trader or team setup, save their business basics, then complete a real client -> project -> time -> invoice flow. Tutorials remain available under **More > Tutorials**.

### Clients and Projects

Clients can be created, viewed, edited, and deleted only when no protected billing history exists. Projects can be archived/unarchived. Permanent deletion is limited to setup/test projects without invoice, billed, active wage-payment, or protected history.

### Time and Expenses

Time uses integer minutes and a snapshotted hourly rate. Expense and wage values use integer cents. Billed entries cannot be edited or deleted until the related invoice is returned to draft, voided, or deleted through the guarded workflow.

### Team and Wages

1. The owner creates an invitation under **More > Team** with default pay and charge rates.
2. The subcontractor signs in and accepts the one-use invitation.
3. The owner assigns active projects and can override rates per assignment.
4. Assigned projects appear in the subcontractor's normal Projects list and home Log Work selector.
5. Subcontractor hours update the owner's project and invoice data automatically; there is no approval gate.
6. Employee labour appears separately on invoices while remaining part of the same client invoice.
7. Wage obligations are grouped by employee and project. Payment, reversal reason, and linked wage expense remain traceable.

Historical time and invoice lines retain pay/charge snapshots when later rates change.

### Invoices

- Draft creation reserves its selected time/expense sources from other new drafts without marking them billed.
- Invoice numbering advances from the highest existing sequence for the owner's prefix and year, so deleted numbers are not reused.
- Sending by reviewed email or confirmed MMS automatically marks a draft invoice sent and records its sources as billed.
- A provider-accepted delivery followed by a failed status transition produces a prominent warning telling the user not to blindly resend.
- Manual **Mark Sent** remains for hand-delivered or externally delivered invoices.
- Paid invoices can return to sent. Sent invoices can return to draft and release their source rows. Void invoices can be restored.
- Sent/paid invoices keep business and client snapshots; later profile edits do not rewrite historical documents.
- Public client links are long bearer tokens, unlisted, and available only while enabled. Revoke/regenerate a link if it reaches the wrong person.

## PWA and Caching

The service worker caches only explicit public static assets such as the manifest and app icons. It does not cache authenticated HTML, page data, invoice responses, or API traffic. This avoids stale or cross-session business data on shared devices.

Read-heavy dashboard/list data uses short owner-scoped server caches. Mutations revalidate the relevant cache tags and routes.

## Vercel Deployment

The Vercel build command is:

```bash
pnpm run build
```

Before deploying schema changes:

```bash
pnpm run db:migrate
pnpm run audit:database
pnpm run smoke:dashboard
```

Then push `main`; the linked Vercel project deploys from GitHub. Verify:

1. Deployment status is **Ready**.
2. Production aliases point to the new deployment.
3. Runtime logs contain no Prisma, Auth, PDF, SMTP, or route exceptions.
4. `/diagnostics?token=<DIAGNOSTICS_TOKEN>` shows `syd1` in `x-vercel-id` and the expected Sydney Supabase host.
5. Sign in, create a disposable draft, download its PDF, and delete the draft after checking it.

`vercel.json` pins functions to `syd1`. Keep Supabase and Vercel close; every server-rendered database request pays the round-trip cost.

## Diagnostics and Operations

While logged in, open:

```text
/diagnostics?token=<DIAGNOSTICS_TOKEN>
```

It reports server timing, TCP/TLS timing, consecutive Prisma queries, count queries, dashboard query timing, runtime, and region signals without printing credentials.

Useful commands:

```bash
pnpm exec prisma generate
pnpm exec prisma validate
pnpm run test
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm run db:migrate
pnpm run audit:database
pnpm run smoke:dashboard
```

GitHub Actions runs Prisma generation/validation, tests, lint, type checking, and the production build on pushes to `main` and pull requests.

## Data and Security Notes

- Money is stored as integer cents; work duration is stored as integer minutes.
- Final invoice totals and GST are calculated in integer cents.
- Invoice/client/business snapshots protect historical sent and paid documents.
- Owner relationships, source billing state, value ranges, date ranges, and invoice total consistency are checked by database constraints or the database audit.
- Destructive actions use server-side ownership checks and history guards.
- Keep `.env`, database URLs, SMTP/Twilio credentials, and Supabase secret keys out of Git.
- `DATABASE_URL` and `DIRECT_URL` must be rotated immediately if accidentally exposed.
- This repository does not implement automated off-site database backups. Configure and periodically test Supabase backup/PITR appropriate to the production plan.

## Legacy Null-Owner Rows

The production-readiness audit may find preserved rows created before authentication with `ownerId = NULL`. These records are deliberately invisible to every account. Backfill them only after identifying the intended Supabase Auth user ID and reviewing every affected table. Do not run a blanket backfill on a shared database.

## Current Rollout Limits

- Invoice delivery uses one verified platform sender with tenant-specific display names and Reply-To; verified custom tenant domains are not supported yet.
- The current owner-based tenant boundary does not yet support multiple administrators, ownership transfer, or business switching.
- Durable provider delivery logs, database-backed send throttling, and automated account deletion are not implemented.
- Quotes and quote-to-job conversion are not implemented.
- Receipt image storage is not implemented.
- Supabase password-reset delivery must be tested with the production Auth configuration.
- Private logos on anonymous public invoices require optional `SUPABASE_SECRET_KEY`; invoices otherwise use the initial badge.
- Backup/PITR configuration lives outside this repository and must be confirmed in Supabase.

These limits do not block controlled testing with known users. They do block unrestricted public rollout. The full decision and external migration checklist are in `docs/PRODUCT_READINESS.md`; operational response steps are in `docs/OPERATIONS.md`.
