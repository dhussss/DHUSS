import type { Prisma } from "@prisma/client";
import { buildInvoiceLineData, invoiceTotals, summaryText } from "@/lib/invoices";

export async function syncProjectDrafts(tx: Prisma.TransactionClient, ownerId: string, projectId: string) {
  const drafts = await tx.invoice.findMany({
    where: { ownerId, projectId, status: "DRAFT" },
    select: { id: true, dateRangeStart: true, dateRangeEnd: true, lineItems: { select: { timeEntryId: true, expenseItemId: true } } }
  });
  if (!drafts.length) return;
  const profile = await tx.businessProfile.findUnique({ where: { ownerId }, select: { gstRegistered: true, gstRate: true } });

  for (const draft of drafts) {
    const entries = await tx.timeEntry.findMany({
      where: {
        ownerId, projectId, billingStatus: "UNBILLED",
        id: { in: draft.lineItems.flatMap((line) => line.timeEntryId ? [line.timeEntryId] : []) },
        OR: [{ teamMemberId: null }, { approvalStatus: "APPROVED" }]
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }]
    });
    const expenses = await tx.expenseItem.findMany({
      where: {
        ownerId, projectId, billingStatus: "UNBILLED",
        id: { in: draft.lineItems.flatMap((line) => line.expenseItemId ? [line.expenseItemId] : []) }
      },
      orderBy: [{ datePurchased: "asc" }, { createdAt: "asc" }]
    });
    const totals = invoiceTotals(entries, expenses, {
      registered: profile?.gstRegistered ?? false, rate: Number(profile?.gstRate ?? 0)
    });
    const dates = [...entries.map((entry) => entry.date), ...expenses.map((item) => item.datePurchased)];
    await tx.invoice.update({
      where: { id: draft.id, ownerId, status: "DRAFT" },
      data: {
        totalHours: totals.totalHours,
        totalDurationMinutes: totals.totalDurationMinutes,
        labourTotalCents: totals.labourTotalCents,
        itemTotalCents: totals.itemTotalCents,
        expensesSubtotalCents: totals.expensesSubtotalCents,
        subtotalCents: totals.subtotalCents,
        gstCents: totals.gstCents,
        grandTotalCents: totals.grandTotalCents,
        dateRangeStart: new Date(Math.min(draft.dateRangeStart.getTime(), ...dates.map(Number))),
        dateRangeEnd: new Date(Math.max(draft.dateRangeEnd.getTime(), ...dates.map(Number))),
        summary: summaryText(entries, expenses),
        lineItems: {
          deleteMany: {},
          create: buildInvoiceLineData(entries, expenses).map((line) => ({ ...line, ownerId }))
        }
      }
    });
  }
}
