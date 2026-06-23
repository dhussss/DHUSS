-- Split invoice email defaults into editable professional template sections.

ALTER TABLE "BusinessProfile"
  ADD COLUMN "defaultInvoiceGreeting" TEXT,
  ADD COLUMN "defaultInvoiceBody" TEXT,
  ADD COLUMN "defaultInvoiceSignOff" TEXT,
  ADD COLUMN "defaultInvoiceFooter" TEXT;

UPDATE "BusinessProfile"
SET "defaultInvoiceBody" = "defaultInvoiceEmailBody"
WHERE "defaultInvoiceBody" IS NULL
  AND "defaultInvoiceEmailBody" IS NOT NULL;
