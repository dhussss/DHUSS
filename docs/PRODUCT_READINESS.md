# Product Independence and Public Readiness

This document records the structural audit completed before treating the application as a standalone product. It deliberately distinguishes implemented safeguards from external work and future tenancy changes.

## Personal Dependency Audit

| Area | Finding | Handling | External action |
| --- | --- | --- | --- |
| Team invitations | A production URL fell back to `dhuss.vercel.app`. | Removed. Links now resolve from `APP_BASE_URL`, the active Vercel deployment, or localhost in development. | Set `APP_BASE_URL` to the final custom production domain. |
| Vercel ownership and aliases | The current project, aliases, and team are personally owned infrastructure. | No personal domain is assumed by application code. | Create a dedicated organisation/project, custom domain, access policy, billing owner, and staging project. |
| Supabase, SMTP, Twilio | Provider accounts and secrets are deployment-owned. | Configuration remains environment-based and server-only. Preview delivery is blocked by default. | Transfer or recreate providers under the product operating entity and rotate secrets. |
| User business details | Existing profile and issued-invoice snapshots legitimately contain the current user's business data. | Intentionally retained as tenant-owned and historical data. | No rewrite. Review the first tenant after migration. |
| Test fixtures | PDF tests contained a real-looking personal identity and bank details; an auth-cookie test used a real Supabase project reference. | Replaced with fictional fixtures. | None. |
| Product name | The product name was repeated in UI, metadata, manifest, and invite text. | Centralised in `src/lib/platform.ts` and environment variables. | Approve the final name and visual identity before general launch. |
| Seed script | The demo seed deleted tables without an explicit acknowledgement. | It now requires `ALLOW_DESTRUCTIVE_SEED=true` and refuses Vercel production. | Keep the flag absent from hosted environments. |

Repository history and historical deployment records may retain old identifiers. Rewriting Git history or issued documents is intentionally out of scope and would create more risk than it removes.

## Identity Boundary

Platform identity is configured with `NEXT_PUBLIC_PRODUCT_NAME`, `NEXT_PUBLIC_PRODUCT_SHORT_NAME`, `NEXT_PUBLIC_PRODUCT_DESCRIPTION`, and `NEXT_PUBLIC_SUPPORT_EMAIL`. It controls application metadata, authentication presentation, install labels, and restrained platform attribution.

Tenant identity remains in `BusinessProfile` and immutable invoice snapshots. It controls business name, legal identity, contact details, GST, payment details, logo, invoice prefix, terms, invoice templates, and Reply-To. Customer invoices do not inherit platform business details.

## Current Tenancy Model

The current business boundary is the authenticated owner's Supabase user ID. Business records carry `ownerId`; owner actions query that value server-side. Workers access employer projects through `TeamMember` and `ProjectAssignment`, not by submitting an arbitrary owner ID. Prisma-owned tables have RLS enabled and browser roles have direct CRUD grants revoked.

This supports multiple unrelated owner-operated businesses and assigned subcontractors, but it is not yet the final long-term workspace model. A dedicated `Business` plus `BusinessMembership` model is required for multiple administrators, role changes, ownership transfer, users belonging to multiple businesses, and business continuity after an owner's account changes. That migration must backfill only explicitly identified owner profiles and preserve existing `ownerId` references until every query and constraint is migrated.

## Email Architecture

Invoice delivery uses the platform-sent model:

- SMTP authenticates with the deployment's server-only provider credentials.
- The real From address is `INVOICE_FROM_EMAIL`, which must belong to a verified platform domain.
- The visible display name is `Tenant Business Name via Product Name`.
- Reply-To is the tenant's configured `replyToEmail`, falling back to its business email.
- A confirmation copy goes to the tenant business email when it differs from the recipient.
- The PDF and email body use tenant-scoped invoice data and snapshots.
- Preview and local delivery are blocked unless explicitly enabled for controlled testing.

Arbitrary tenant addresses are never placed in From. Custom tenant-domain sending is not supported until that domain is independently verified with the provider. Supabase Auth emails are separate platform communications and must be branded/configured in Supabase.

## User Migration

No business records or historical invoice snapshots are rewritten by this pass. The existing authenticated owner remains the first tenant boundary. Records with `ownerId = NULL` remain invisible and require an explicit, reviewed owner mapping. Existing public invoice tokens remain unchanged. No database migration was required for this pass.

## Public Surfaces and Lifecycle

- `/support`: public help and safe incident-reporting guidance.
- `/legal/privacy`: accurate beta privacy summary with a legal-review warning.
- `/legal/terms`: accurate beta operating terms with a legal-review warning.
- `/account`: authenticated account and data controls.
- `/account/data-export`: owner-scoped JSON export excluding internal owner IDs, token hashes, and public invoice tokens.

Automated account/business deletion is intentionally not implemented. A safe implementation needs retention policy, re-authentication, ownership-transfer rules, pending invoice handling, worker removal, storage cleanup, and a recovery window.

## Rollout Blockers

### Code and data model

- Dedicated business/workspace memberships, administrator roles, and ownership transfer.
- Durable delivery-attempt records and database-backed abuse throttling.
- Formal account deletion and retention workflow.
- Integration tests using two isolated tenant accounts and storage objects.

### Infrastructure

- Dedicated Vercel, Supabase, email, messaging, monitoring, and domain ownership under the operating entity.
- Separate production and staging databases/provider credentials.
- Backup/PITR configuration and a tested restore procedure.
- Error monitoring and alert ownership.

### Provider and DNS

- Custom product domain and canonical redirects.
- Verified platform email domain with SPF, DKIM, and DMARC.
- Branded Supabase Auth SMTP sender and templates.
- Provider webhooks if delivered/bounced status is required.

### Legal and operations

- Formal privacy policy, terms, retention schedule, subprocessors list, support SLA, acceptable-use process, and operating entity details.
- Abuse response, account recovery, security incident, and data request procedures.

## Rollout Decision

**Ready only for controlled beta.** The code no longer depends on a personal URL or sender display identity, current owner-operated tenants remain isolated, and new trust/data surfaces exist. General public rollout remains blocked by the dedicated workspace membership model, provider ownership and domain verification, durable abuse controls, two-tenant integration evidence, and formal legal/operational setup.
