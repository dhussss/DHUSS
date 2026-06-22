import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "syd1";

function authorised(request: NextRequest) {
  const configuredToken = process.env.BACKUP_EXPORT_TOKEN;
  if (!configuredToken && process.env.NODE_ENV === "production") return false;
  if (!configuredToken) return true;

  const providedToken = request.nextUrl.searchParams.get("token") ?? request.headers.get("x-backup-token");
  return providedToken === configuredToken;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Backup export is not authorised." }, { status: 401 });
  }
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Login is required for backup export." }, { status: 401 });
  }
  const ownerId = user.id;

  const [profile, clients, projects, rateHistory, timeEntries, expenseItems, invoices, invoiceLineItems] = await Promise.all([
    prisma.businessProfile.findUnique({ where: { ownerId } }),
    prisma.client.findMany({ where: { ownerId }, orderBy: [{ businessName: "asc" }, { createdAt: "asc" }] }),
    prisma.project.findMany({ where: { ownerId }, orderBy: [{ updatedAt: "desc" }, { createdAt: "asc" }] }),
    prisma.rateHistory.findMany({ where: { ownerId }, orderBy: [{ projectId: "asc" }, { startsAt: "asc" }] }),
    prisma.timeEntry.findMany({ where: { ownerId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.expenseItem.findMany({ where: { ownerId }, orderBy: [{ datePurchased: "asc" }, { createdAt: "asc" }] }),
    prisma.invoice.findMany({ where: { ownerId }, orderBy: [{ invoiceDate: "asc" }, { invoiceNumber: "asc" }] }),
    prisma.invoiceLineItem.findMany({ where: { ownerId }, orderBy: [{ invoiceId: "asc" }, { sortOrder: "asc" }] })
  ]);

  const exportedAt = new Date().toISOString();
  const filename = `trade-invoice-tracker-backup-${exportedAt.slice(0, 10)}.json`;

  return NextResponse.json(
    {
      app: "Trade Invoice Tracker",
      version: 1,
      exportedAt,
      tables: {
        profile,
        clients,
        projects,
        rateHistory,
        timeEntries,
        expenseItems,
        invoices,
        invoiceLineItems
      }
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    }
  );
}
