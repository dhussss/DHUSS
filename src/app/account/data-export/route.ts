import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { platform } from "@/lib/platform";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const excludedKeys = new Set(["ownerId", "publicToken", "tokenHash"]);

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const ownerId = user.id;
  const [profile, clients, projects, timeEntries, expenseItems, workExpenses, invoices, teamMembers, teamInvitations, wagePayments, dayOffLogs] = await Promise.all([
    prisma.businessProfile.findUnique({ where: { ownerId } }),
    prisma.client.findMany({ where: { ownerId }, orderBy: { createdAt: "asc" } }),
    prisma.project.findMany({ where: { ownerId }, include: { rateHistory: { orderBy: { startsAt: "asc" } } }, orderBy: { createdAt: "asc" } }),
    prisma.timeEntry.findMany({ where: { ownerId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.expenseItem.findMany({ where: { ownerId }, orderBy: [{ datePurchased: "asc" }, { createdAt: "asc" }] }),
    prisma.workExpense.findMany({ where: { ownerId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.invoice.findMany({ where: { ownerId }, include: { lineItems: { orderBy: { sortOrder: "asc" } } }, orderBy: { invoiceDate: "asc" } }),
    prisma.teamMember.findMany({ where: { ownerId }, include: { assignments: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } }),
    prisma.teamInvitation.findMany({ where: { ownerId }, orderBy: { createdAt: "asc" } }),
    prisma.wagePayment.findMany({ where: { ownerId }, orderBy: { paidAt: "asc" } }),
    prisma.dayOffLog.findMany({ where: { ownerId }, orderBy: { date: "asc" } })
  ]);

  const body = JSON.stringify({
    format: "trade-business-export",
    version: 1,
    product: platform.name,
    exportedAt: new Date().toISOString(),
    accountEmail: user.email ?? null,
    data: { profile, clients, projects, timeEntries, expenseItems, workExpenses, invoices, teamMembers, teamInvitations, wagePayments, dayOffLogs }
  }, (key, value) => excludedKeys.has(key) ? undefined : value, 2);

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="business-data-${date}.json"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
