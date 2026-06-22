-- Add indexes for the main production read paths: dashboard totals, project lists,
-- invoice history, hours export filters, and recently updated records.
CREATE INDEX "Client_updatedAt_idx" ON "Client"("updatedAt");

CREATE INDEX "Project_updatedAt_idx" ON "Project"("updatedAt");

CREATE INDEX "TimeEntry_date_idx" ON "TimeEntry"("date");
CREATE INDEX "TimeEntry_updatedAt_idx" ON "TimeEntry"("updatedAt");

CREATE INDEX "ExpenseItem_datePurchased_idx" ON "ExpenseItem"("datePurchased");
CREATE INDEX "ExpenseItem_updatedAt_idx" ON "ExpenseItem"("updatedAt");

CREATE INDEX "Invoice_paymentDate_idx" ON "Invoice"("paymentDate");
CREATE INDEX "Invoice_updatedAt_idx" ON "Invoice"("updatedAt");
