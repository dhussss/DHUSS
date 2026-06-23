-- Add plain-text mail-app invoice email defaults and optional appendices.

ALTER TABLE "BusinessProfile"
  ADD COLUMN "defaultEmailGreeting" TEXT,
  ADD COLUMN "defaultEmailIntro" TEXT,
  ADD COLUMN "defaultEmailPaymentLine" TEXT,
  ADD COLUMN "defaultEmailSignOff" TEXT,
  ADD COLUMN "includePaymentDetailsInEmail" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "includeInvoiceSummaryInEmail" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "includePublicInvoiceLinkInEmail" BOOLEAN NOT NULL DEFAULT true;

