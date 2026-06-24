-- Add planning settings to the private business profile.
ALTER TABLE "BusinessProfile"
ADD COLUMN "taxSetAsideEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "customTaxPercentageOverride" DECIMAL(65,30),
ADD COLUMN "includeGstInTaxEstimate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "includeSuperInSetAsidePlanning" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "superPlanningEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "superContributionPercentage" DECIMAL(65,30) NOT NULL DEFAULT 11.5,
ADD COLUMN "superFundName" TEXT,
ADD COLUMN "superMemberNumber" TEXT;

CREATE TYPE "WorkExpenseCategory" AS ENUM (
  'TOOLS',
  'MATERIALS',
  'FUEL',
  'VEHICLE',
  'PPE',
  'PHONE_INTERNET',
  'TRAINING_TICKETS',
  'INSURANCE',
  'SOFTWARE',
  'SUBCONTRACTOR',
  'OTHER'
);

CREATE TYPE "WorkExpenseStatus" AS ENUM (
  'LOGGED',
  'ALLOCATED',
  'INVOICED_REIMBURSED',
  'TAX_RECORD_ONLY'
);

CREATE TABLE "WorkExpense" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "projectId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "category" "WorkExpenseCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "vendor" TEXT,
  "amountCents" INTEGER NOT NULL,
  "gstIncluded" BOOLEAN NOT NULL DEFAULT false,
  "gstAmountCents" INTEGER NOT NULL DEFAULT 0,
  "paymentMethod" TEXT,
  "receiptReference" TEXT,
  "notes" TEXT,
  "billable" BOOLEAN NOT NULL DEFAULT false,
  "status" "WorkExpenseStatus" NOT NULL DEFAULT 'LOGGED',
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkExpense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DayOffLog" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "plannedWorkDay" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DayOffLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkExpense_ownerId_date_idx" ON "WorkExpense"("ownerId", "date");
CREATE INDEX "WorkExpense_ownerId_category_idx" ON "WorkExpense"("ownerId", "category");
CREATE INDEX "WorkExpense_ownerId_projectId_idx" ON "WorkExpense"("ownerId", "projectId");
CREATE INDEX "WorkExpense_ownerId_status_idx" ON "WorkExpense"("ownerId", "status");
CREATE INDEX "WorkExpense_ownerId_archivedAt_idx" ON "WorkExpense"("ownerId", "archivedAt");

CREATE UNIQUE INDEX "DayOffLog_ownerId_date_key" ON "DayOffLog"("ownerId", "date");
CREATE INDEX "DayOffLog_ownerId_date_idx" ON "DayOffLog"("ownerId", "date");

ALTER TABLE "WorkExpense"
ADD CONSTRAINT "WorkExpense_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
