export type ProjectFinancialPositionInput = {
  issuedRevenueCents: number;
  unbilledValueCents: number;
  recordedExpenseCents: number;
  unpaidWageCents: number;
};

export type ProjectCloseoutCounts = {
  unbilledTimeCount: number;
  unbilledExpenseCount: number;
  draftInvoiceCount: number;
  unpaidWageCount: number;
  outstandingInvoiceCount: number;
};

export function projectFinancialPosition(input: ProjectFinancialPositionInput) {
  const projectedRevenueCents = input.issuedRevenueCents + input.unbilledValueCents;
  const committedCostCents = input.recordedExpenseCents + input.unpaidWageCents;
  const projectedMarginCents = projectedRevenueCents - committedCostCents;
  const projectedMarginPercent = projectedRevenueCents > 0
    ? Math.round((projectedMarginCents / projectedRevenueCents) * 1000) / 10
    : null;

  return {
    ...input,
    projectedRevenueCents,
    committedCostCents,
    projectedMarginCents,
    projectedMarginPercent
  };
}

export function projectCloseoutReadiness(counts: ProjectCloseoutCounts) {
  const blockers = [
    counts.unbilledTimeCount
      ? `${counts.unbilledTimeCount} unbilled time entr${counts.unbilledTimeCount === 1 ? "y" : "ies"}`
      : "",
    counts.unbilledExpenseCount
      ? `${counts.unbilledExpenseCount} unbilled expense item${counts.unbilledExpenseCount === 1 ? "" : "s"}`
      : "",
    counts.draftInvoiceCount
      ? `${counts.draftInvoiceCount} draft invoice${counts.draftInvoiceCount === 1 ? "" : "s"}`
      : "",
    counts.unpaidWageCount
      ? `${counts.unpaidWageCount} unpaid subcontractor entr${counts.unpaidWageCount === 1 ? "y" : "ies"}`
      : ""
  ].filter(Boolean);

  const warnings = counts.outstandingInvoiceCount
    ? [`${counts.outstandingInvoiceCount} sent invoice${counts.outstandingInvoiceCount === 1 ? " is" : "s are"} still awaiting payment`]
    : [];

  return {
    canArchive: blockers.length === 0,
    blockers,
    warnings
  };
}
