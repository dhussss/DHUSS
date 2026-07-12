CREATE TYPE "WagePaymentStatus" AS ENUM ('PAID', 'VOID');

CREATE TABLE "WagePayment" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "teamMemberId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workExpenseId" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "reference" TEXT,
  "minutes" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" "WagePaymentStatus" NOT NULL DEFAULT 'PAID',
  "reversedAt" TIMESTAMP(3),
  "reversalNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WagePayment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TimeEntry" ADD COLUMN "wagePaymentId" TEXT;
CREATE UNIQUE INDEX "WagePayment_workExpenseId_key" ON "WagePayment"("workExpenseId");
CREATE INDEX "WagePayment_ownerId_status_idx" ON "WagePayment"("ownerId", "status");
CREATE INDEX "WagePayment_teamMemberId_paidAt_idx" ON "WagePayment"("teamMemberId", "paidAt");
CREATE INDEX "WagePayment_projectId_paidAt_idx" ON "WagePayment"("projectId", "paidAt");
CREATE INDEX "TimeEntry_wagePaymentId_idx" ON "TimeEntry"("wagePaymentId");
ALTER TABLE "WagePayment" ADD CONSTRAINT "WagePayment_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WagePayment" ADD CONSTRAINT "WagePayment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WagePayment" ADD CONSTRAINT "WagePayment_workExpenseId_fkey" FOREIGN KEY ("workExpenseId") REFERENCES "WorkExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_wagePaymentId_fkey" FOREIGN KEY ("wagePaymentId") REFERENCES "WagePayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
