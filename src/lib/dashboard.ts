import type { TimeEntry } from "@prisma/client";
import { addDays, startOfWeekMonday } from "@/lib/dates";
import { labourTotalCents } from "@/lib/time";

export function unbilledTimeValue(entries: Pick<TimeEntry, "durationMinutes" | "hourlyRateCentsSnapshot">[]) {
  return entries.reduce((sum, entry) => sum + labourTotalCents(entry.durationMinutes, entry.hourlyRateCentsSnapshot), 0);
}

export function buildPaidWeeklyTotals(invoices: { paymentDate: Date | string | null; grandTotalCents: number }[]) {
  const thisWeek = startOfWeekMonday(new Date());
  const weeks = Array.from({ length: 13 }, (_, index) => {
    const start = addDays(thisWeek, (index - 12) * 7);
    const end = addDays(start, 6);
    return {
      start,
      end,
      label: `${start.getUTCDate()}/${start.getUTCMonth() + 1}`,
      totalCents: 0
    };
  });

  for (const invoice of invoices) {
    if (!invoice.paymentDate) continue;
    const paid = new Date(invoice.paymentDate);
    const week = weeks.find((item) => paid >= item.start && paid <= addDays(item.end, 1));
    if (week) {
      week.totalCents += invoice.grandTotalCents;
    }
  }

  return weeks;
}
