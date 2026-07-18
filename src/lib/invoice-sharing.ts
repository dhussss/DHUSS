export type ShareableInvoiceStatus = "DRAFT" | "SENT" | "PAID" | "VOID";

export function canShareInvoicePublicly(status: ShareableInvoiceStatus) {
  return status !== "VOID";
}
