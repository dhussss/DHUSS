export function teamTimeEntryEditBlockReason({
  billingStatus,
  paymentStatus
}: {
  billingStatus: "UNBILLED" | "BILLED";
  paymentStatus: "UNPAID" | "PAID" | null;
}) {
  if (billingStatus === "BILLED") return "billed" as const;
  if (paymentStatus === "PAID") return "paid" as const;
  return null;
}

export function payRunSelectionIsCurrent(requestedIds: string[], foundIds: string[]) {
  if (!requestedIds.length) return true;
  const requested = new Set(requestedIds);
  const found = new Set(foundIds);
  return requested.size === found.size && [...requested].every((id) => found.has(id));
}

export function payRunAmountIsCurrent(reviewedAmount: string, currentAmountCents: number) {
  return /^\d+$/.test(reviewedAmount) && Number.isSafeInteger(Number(reviewedAmount)) &&
    Number(reviewedAmount) === currentAmountCents;
}
