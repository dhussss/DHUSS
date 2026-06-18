import type { ExpenseItem, TimeEntry } from "@prisma/client";
import { formatDateAU } from "@/lib/dates";
import { labourTotalCents } from "@/lib/time";

export type InvoiceSourceExpense = Pick<
  ExpenseItem,
  "id" | "datePurchased" | "description" | "quantity" | "unitCostCents" | "totalCostCents" | "notes"
>;

export type InvoiceSourceTimeEntry = Pick<
  TimeEntry,
  "id" | "date" | "durationMinutes" | "notes" | "hourlyRateCentsSnapshot"
>;

export function timeEntryTotalCents(entry: Pick<TimeEntry, "durationMinutes" | "hourlyRateCentsSnapshot">) {
  return labourTotalCents(entry.durationMinutes, entry.hourlyRateCentsSnapshot);
}

export function buildInvoiceLineData(entries: InvoiceSourceTimeEntry[], expenses: InvoiceSourceExpense[]) {
  let sortOrder = 1;

  const labourLines = entries.map((entry) => ({
    timeEntryId: entry.id,
    type: "LABOUR" as const,
    description: `Labour - ${formatDateAU(entry.date)}`,
    date: entry.date,
    hoursMinutes: entry.durationMinutes,
    unitAmountCents: entry.hourlyRateCentsSnapshot,
    totalAmountCents: timeEntryTotalCents(entry),
    notes: entry.notes,
    sortOrder: sortOrder++
  }));

  const expenseLines = expenses.map((expense) => ({
    expenseItemId: expense.id,
    type: "EXPENSE" as const,
    description: expense.description,
    date: expense.datePurchased,
    quantity: expense.quantity,
    unitAmountCents: expense.unitCostCents,
    totalAmountCents: expense.totalCostCents,
    notes: expense.notes,
    sortOrder: sortOrder++
  }));

  return [...labourLines, ...expenseLines];
}

export function invoiceTotals(entries: InvoiceSourceTimeEntry[], expenses: InvoiceSourceExpense[]) {
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const labourTotalCents = entries.reduce((sum, entry) => sum + timeEntryTotalCents(entry), 0);
  const itemTotalCents = expenses.reduce((sum, expense) => sum + expense.totalCostCents, 0);

  return {
    totalHours: totalMinutes / 60,
    labourTotalCents,
    itemTotalCents,
    grandTotalCents: labourTotalCents + itemTotalCents
  };
}

export function summaryText(entries: InvoiceSourceTimeEntry[], expenses: InvoiceSourceExpense[]) {
  const dayCount = new Set(entries.map((entry) => formatDateAU(entry.date))).size;
  return `${entries.length} time entries across ${dayCount} day${dayCount === 1 ? "" : "s"} and ${expenses.length} expense item${expenses.length === 1 ? "" : "s"}.`;
}
