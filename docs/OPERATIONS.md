# Operations Runbook

## Environment Structure

Use separate Vercel projects and Supabase projects for staging and production. Never point a preview deployment at the production database. Keep provider credentials scoped to their matching environment. `APP_BASE_URL` must be the canonical domain for that environment.

Real outbound delivery is disabled outside production unless `ALLOW_NON_PRODUCTION_DELIVERY=true`. Use that override only with controlled recipients and provider test credentials.

## Failed Invoice Email or MMS

1. Record the invoice ID, tenant owner reference, time, channel, and on-screen provider reference without copying the invoice body or credentials into logs.
2. Check the provider delivery log before retrying.
3. Confirm whether SMTP/Twilio accepted the request and whether a bounce or carrier failure followed.
4. Do not resend if acceptance is ambiguous; ask the business to confirm with the client first.
5. Check `APP_BASE_URL`, public-token state, sender verification, and Reply-To configuration.

## Failed PDF

1. Reproduce with the authenticated PDF route and the public token route separately.
2. Check invoice snapshots and logo access without logging bank or client details.
3. Verify the private logo bucket, signed URL configuration, and optional server secret key.
4. Run `pnpm run test` to exercise the PDF renderer.

## Failed Migration

1. Stop deployment promotion.
2. Run `pnpm exec prisma migrate status` using the migration-only `DIRECT_URL`.
3. Inspect the failed migration and database logs. Do not use `db push`, reset, or manually delete migration rows in production.
4. Correct with a new forward migration or Prisma's documented migration-resolution procedure after review.
5. Run `pnpm run audit:database` before restoring traffic.

## Authentication Outage

1. Check Supabase Auth status, Site URL, redirect allow-list, SMTP provider, and callback errors.
2. Do not disable verification or weaken redirect validation as a shortcut.
3. Verify login, signup confirmation, password recovery, and expired-session handling using a test account.

## Storage Issue

1. Verify the `business-logos` bucket remains private and owner-folder policies exist.
2. Run `pnpm run audit:database` and inspect its storage policy result.
3. Never make the whole bucket public to fix anonymous invoice logos; use server-generated signed access.

## Deployment Health

Run `pnpm exec prisma validate`, `pnpm run test`, `pnpm run lint`, `pnpm run typecheck`, and `pnpm run build`. After deployment, verify login, diagnostics, one tenant-scoped read path, PDF generation, and browser console. Promote only after the preview environment indicator and database target are confirmed.

## Secret Rotation

Rotate exposed values at the provider first, update the matching environment only, redeploy, verify, then revoke the old value. Never print secrets in tickets, logs, screenshots, or command history. Database, Supabase service, SMTP, Twilio, diagnostics, and deployment credentials require separate rotation.
