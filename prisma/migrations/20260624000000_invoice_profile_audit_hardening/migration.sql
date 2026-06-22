-- Phase 0-8 production hardening.
-- All added invoice columns are nullable or defaulted so existing invoices remain valid.

CREATE TYPE "InvoiceMode" AS ENUM ('SIMPLE', 'DETAILED');

ALTER TABLE "BusinessProfile"
  ADD COLUMN "invoicePrefix" TEXT NOT NULL DEFAULT 'INV-';

ALTER TABLE "Invoice"
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "paymentTermsDays" INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN "mode" "InvoiceMode" NOT NULL DEFAULT 'DETAILED',
  ADD COLUMN "totalDurationMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "subtotalCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "expensesSubtotalCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "gstCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "businessNameSnapshot" TEXT,
  ADD COLUMN "businessLegalNameSnapshot" TEXT,
  ADD COLUMN "businessAbnSnapshot" TEXT,
  ADD COLUMN "businessEmailSnapshot" TEXT,
  ADD COLUMN "businessPhoneSnapshot" TEXT,
  ADD COLUMN "businessAddressSnapshot" TEXT,
  ADD COLUMN "businessBankAccountNameSnapshot" TEXT,
  ADD COLUMN "businessBsbSnapshot" TEXT,
  ADD COLUMN "businessAccountNumberSnapshot" TEXT,
  ADD COLUMN "businessGstRegisteredSnapshot" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "businessGstRateSnapshot" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "businessLogoPathSnapshot" TEXT,
  ADD COLUMN "clientBusinessNameSnapshot" TEXT,
  ADD COLUMN "clientContactNameSnapshot" TEXT,
  ADD COLUMN "clientEmailSnapshot" TEXT,
  ADD COLUMN "clientPhoneSnapshot" TEXT,
  ADD COLUMN "clientAddressSnapshot" TEXT,
  ADD COLUMN "clientAbnSnapshot" TEXT;

UPDATE "Invoice"
SET
  "subtotalCents" = "labourTotalCents" + "itemTotalCents",
  "expensesSubtotalCents" = "itemTotalCents",
  "totalDurationMinutes" = ROUND(("totalHours"::numeric * 60))::integer,
  "dueDate" = "invoiceDate" + interval '14 days'
WHERE "subtotalCents" = 0
  AND "grandTotalCents" > 0;

CREATE INDEX "Invoice_ownerId_dueDate_idx" ON "Invoice"("ownerId", "dueDate");

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_ownerId_createdAt_idx" ON "AuditLog"("ownerId", "createdAt");
CREATE INDEX "AuditLog_ownerId_entityType_idx" ON "AuditLog"("ownerId", "entityType");
