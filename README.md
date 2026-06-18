# Trade Invoice Tracker

Mobile-first proof-of-concept PWA for a sole trader/subcontractor to track projects, clients, logged hours, expense items, invoices, and weekly hours exports.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite for local single-user storage
- PWA manifest and service worker for Add to Home Screen

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm run db:push
pnpm run db:seed
pnpm run dev
```

Open `http://localhost:3000`.

## Data model notes

Money is stored as integer cents and time is stored as minutes. A time entry snapshots the project hourly rate when it is created, and invoice line items store their own unit/total amounts. That means old invoices and dashboard totals remain historically accurate even if a project hourly rate changes later.

Draft invoices create invoice line items only. Source time entries and expense items are marked billed when the invoice is marked sent or paid.

## Useful commands

```bash
pnpm run db:push
pnpm run db:seed
pnpm run prisma:studio
pnpm run build
```

## Migrating later

The schema is deliberately close to a Postgres-ready shape. To migrate to Supabase/Postgres later, change `datasource db` in `prisma/schema.prisma` to `provider = "postgresql"`, update `DATABASE_URL`, then run Prisma migrations against the cloud database. Keep the cents/minutes snapshot fields during migration so historical totals remain stable.
