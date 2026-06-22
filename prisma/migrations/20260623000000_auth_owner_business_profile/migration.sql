-- Phase 1/2 multi-user foundation.
-- Owner columns are nullable so existing production data is preserved and can be
-- backfilled deliberately after the first real account is created.
ALTER TABLE "Client" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Project" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "RateHistory" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "TimeEntry" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "ExpenseItem" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "InvoiceLineItem" ADD COLUMN "ownerId" TEXT;

DROP INDEX IF EXISTS "Invoice_invoiceNumber_key";

CREATE TABLE "BusinessProfile" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "tradingName" TEXT NOT NULL,
  "legalName" TEXT,
  "abn" TEXT,
  "acn" TEXT,
  "contactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "website" TEXT,
  "defaultHourlyRateCents" INTEGER,
  "gstRegistered" BOOLEAN NOT NULL DEFAULT false,
  "gstRate" DECIMAL(65,30) NOT NULL DEFAULT 10,
  "bankAccountName" TEXT,
  "bsb" TEXT,
  "accountNumber" TEXT,
  "paymentTermsDays" INTEGER NOT NULL DEFAULT 14,
  "defaultInvoiceNotes" TEXT,
  "defaultInvoiceEmailMessage" TEXT,
  "logoPath" TEXT,
  "signatureFooter" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessProfile_ownerId_key" ON "BusinessProfile"("ownerId");
CREATE INDEX "BusinessProfile_ownerId_idx" ON "BusinessProfile"("ownerId");

CREATE INDEX "Client_ownerId_idx" ON "Client"("ownerId");
CREATE INDEX "Client_ownerId_businessName_idx" ON "Client"("ownerId", "businessName");

CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");
CREATE INDEX "Project_ownerId_clientId_idx" ON "Project"("ownerId", "clientId");
CREATE INDEX "Project_ownerId_status_idx" ON "Project"("ownerId", "status");

CREATE INDEX "RateHistory_ownerId_projectId_idx" ON "RateHistory"("ownerId", "projectId");

CREATE INDEX "TimeEntry_ownerId_projectId_idx" ON "TimeEntry"("ownerId", "projectId");
CREATE INDEX "TimeEntry_ownerId_date_idx" ON "TimeEntry"("ownerId", "date");
CREATE INDEX "TimeEntry_ownerId_billingStatus_idx" ON "TimeEntry"("ownerId", "billingStatus");
CREATE INDEX "TimeEntry_ownerId_invoiceId_idx" ON "TimeEntry"("ownerId", "invoiceId");

CREATE INDEX "ExpenseItem_ownerId_projectId_idx" ON "ExpenseItem"("ownerId", "projectId");
CREATE INDEX "ExpenseItem_ownerId_datePurchased_idx" ON "ExpenseItem"("ownerId", "datePurchased");
CREATE INDEX "ExpenseItem_ownerId_billingStatus_idx" ON "ExpenseItem"("ownerId", "billingStatus");
CREATE INDEX "ExpenseItem_ownerId_invoiceId_idx" ON "ExpenseItem"("ownerId", "invoiceId");

CREATE INDEX "Invoice_ownerId_projectId_idx" ON "Invoice"("ownerId", "projectId");
CREATE INDEX "Invoice_ownerId_clientId_idx" ON "Invoice"("ownerId", "clientId");
CREATE INDEX "Invoice_ownerId_status_idx" ON "Invoice"("ownerId", "status");
CREATE INDEX "Invoice_ownerId_invoiceDate_idx" ON "Invoice"("ownerId", "invoiceDate");
CREATE UNIQUE INDEX "Invoice_ownerId_invoiceNumber_key" ON "Invoice"("ownerId", "invoiceNumber");

CREATE INDEX "InvoiceLineItem_ownerId_invoiceId_idx" ON "InvoiceLineItem"("ownerId", "invoiceId");
