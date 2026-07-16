-- Guard core financial records at the database boundary. Existing production
-- rows were audited before this migration and satisfy these constraints.

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_currentHourlyRateCents_nonnegative"
  CHECK ("currentHourlyRateCents" >= 0);

ALTER TABLE "RateHistory"
  ADD CONSTRAINT "RateHistory_rateCents_nonnegative"
  CHECK ("rateCents" >= 0);

ALTER TABLE "TimeEntry"
  ADD CONSTRAINT "TimeEntry_durationMinutes_positive"
  CHECK ("durationMinutes" > 0),
  ADD CONSTRAINT "TimeEntry_chargeRate_nonnegative"
  CHECK ("hourlyRateCentsSnapshot" >= 0),
  ADD CONSTRAINT "TimeEntry_payRate_nonnegative"
  CHECK ("payRateCentsSnapshot" IS NULL OR "payRateCentsSnapshot" >= 0);

ALTER TABLE "ExpenseItem"
  ADD CONSTRAINT "ExpenseItem_quantity_positive"
  CHECK ("quantity" > 0),
  ADD CONSTRAINT "ExpenseItem_amounts_nonnegative"
  CHECK ("unitCostCents" >= 0 AND "totalCostCents" >= 0);

ALTER TABLE "WorkExpense"
  ADD CONSTRAINT "WorkExpense_amount_positive"
  CHECK ("amountCents" > 0),
  ADD CONSTRAINT "WorkExpense_gst_valid"
  CHECK ("gstAmountCents" >= 0 AND "gstAmountCents" <= "amountCents");

ALTER TABLE "TeamInvitation"
  ADD CONSTRAINT "TeamInvitation_rates_nonnegative"
  CHECK ("defaultPayRateCents" >= 0 AND "defaultChargeRateCents" >= 0);

ALTER TABLE "TeamMember"
  ADD CONSTRAINT "TeamMember_rates_nonnegative"
  CHECK ("defaultPayRateCents" >= 0 AND "defaultChargeRateCents" >= 0);

ALTER TABLE "ProjectAssignment"
  ADD CONSTRAINT "ProjectAssignment_rates_nonnegative"
  CHECK ("payRateCents" >= 0 AND "chargeRateCents" >= 0);

ALTER TABLE "WagePayment"
  ADD CONSTRAINT "WagePayment_values_valid"
  CHECK ("minutes" > 0 AND "amountCents" >= 0);

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_date_range_valid"
  CHECK ("dateRangeStart" <= "dateRangeEnd"),
  ADD CONSTRAINT "Invoice_totals_nonnegative"
  CHECK (
    "labourTotalCents" >= 0
    AND "itemTotalCents" >= 0
    AND "subtotalCents" >= 0
    AND "expensesSubtotalCents" >= 0
    AND "gstCents" >= 0
    AND "grandTotalCents" >= 0
  ),
  ADD CONSTRAINT "Invoice_subtotal_consistent"
  CHECK ("subtotalCents" = "labourTotalCents" + "itemTotalCents"),
  ADD CONSTRAINT "Invoice_grand_total_consistent"
  CHECK ("grandTotalCents" = "subtotalCents" + "gstCents");

ALTER TABLE "InvoiceLineItem"
  ADD CONSTRAINT "InvoiceLineItem_values_valid"
  CHECK (
    "unitAmountCents" >= 0
    AND "totalAmountCents" >= 0
    AND ("hoursMinutes" IS NULL OR "hoursMinutes" > 0)
  );

ALTER TABLE "BusinessProfile"
  ADD CONSTRAINT "BusinessProfile_default_rate_nonnegative"
  CHECK ("defaultHourlyRateCents" IS NULL OR "defaultHourlyRateCents" >= 0),
  ADD CONSTRAINT "BusinessProfile_gst_rate_valid"
  CHECK ("gstRate" >= 0 AND "gstRate" <= 100),
  ADD CONSTRAINT "BusinessProfile_payment_terms_valid"
  CHECK ("paymentTermsDays" >= 1 AND "paymentTermsDays" <= 365);
