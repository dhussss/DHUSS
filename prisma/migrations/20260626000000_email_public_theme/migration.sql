-- Email invoice workflow, public invoice sharing, and per-user theme preferences.

ALTER TABLE "Invoice"
  ADD COLUMN "publicToken" TEXT,
  ADD COLUMN "publicTokenEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastEmailedAt" TIMESTAMP(3),
  ADD COLUMN "emailSendCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Invoice_publicToken_key" ON "Invoice"("publicToken");
CREATE INDEX "Invoice_ownerId_publicTokenEnabled_idx" ON "Invoice"("ownerId", "publicTokenEnabled");

ALTER TABLE "BusinessProfile"
  ADD COLUMN "defaultInvoiceEmailSubjectTemplate" TEXT,
  ADD COLUMN "defaultInvoiceEmailBody" TEXT,
  ADD COLUMN "replyToEmail" TEXT,
  ADD COLUMN "themeAccent" TEXT NOT NULL DEFAULT 'emerald',
  ADD COLUMN "themeSecondary" TEXT,
  ADD COLUMN "themeMode" TEXT NOT NULL DEFAULT 'system';

UPDATE "BusinessProfile"
SET "defaultInvoiceEmailBody" = "defaultInvoiceEmailMessage"
WHERE "defaultInvoiceEmailBody" IS NULL
  AND "defaultInvoiceEmailMessage" IS NOT NULL;
