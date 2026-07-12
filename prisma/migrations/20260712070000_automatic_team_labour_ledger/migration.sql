ALTER TABLE "InvoiceLineItem"
ADD COLUMN "workerNameSnapshot" TEXT,
ADD COLUMN "teamMemberId" TEXT,
ADD COLUMN "payRateCentsSnapshot" INTEGER;

CREATE INDEX "InvoiceLineItem_teamMemberId_idx" ON "InvoiceLineItem"("teamMemberId");

UPDATE "TimeEntry"
SET "approvalStatus" = 'APPROVED'
WHERE "teamMemberId" IS NOT NULL
  AND "approvalStatus" = 'SUBMITTED';
