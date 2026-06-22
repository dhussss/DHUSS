import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { previousWeekMondayToSunday } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const CACHE_TAGS = {
  dashboard: "dashboard-data",
  projects: "projects-data",
  clients: "clients-data",
  invoices: "invoices-data",
  hoursExport: "hours-export-data"
} as const;

const SHORT_REVALIDATE_SECONDS = 20;

export type DashboardData = {
  projects: { id: string; title: string; client: { businessName: string } }[];
  sentInvoices: {
    id: string;
    invoiceNumber: string;
    status: "SENT";
    invoiceDate: string;
    grandTotalCents: number;
    project: { title: string };
  }[];
  paidInvoices: { paymentDate: string; grandTotalCents: number }[];
  unbilledEntryCount: number;
  unbilledItemCount: number;
  pendingPaymentCents: number;
  pendingInvoicesCents: number;
  previousWeekEntries: {
    id: string;
    date: string;
    durationMinutes: number;
    notes: string | null;
    project: { title: string; client: { businessName: string } };
  }[];
};

type DashboardRow = {
  projects: DashboardData["projects"];
  sentInvoices: DashboardData["sentInvoices"];
  paidInvoices: DashboardData["paidInvoices"];
  previousWeekEntries: DashboardData["previousWeekEntries"];
  unbilledEntryCount: bigint | number | null;
  unbilledItemCount: bigint | number | null;
  pendingPaymentCents: bigint | number | null;
  pendingInvoicesCents: bigint | number | null;
};

function numberValue(value: bigint | number | null | undefined) {
  return Number(value ?? 0);
}

export async function loadDashboardData(): Promise<DashboardData> {
  const previousWeek = previousWeekMondayToSunday();
  const rows = await prisma.$queryRaw<DashboardRow[]>`
    WITH bounds AS (
      SELECT ${previousWeek.start}::timestamp AS start_at, ${previousWeek.endInclusive}::timestamp AS end_at
    ),
    active_projects AS (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'title', p.title,
            'client', jsonb_build_object('businessName', c."businessName")
          )
          ORDER BY p."updatedAt" DESC
        ),
        '[]'::jsonb
      ) AS data
      FROM "Project" p
      JOIN "Client" c ON c.id = p."clientId"
      WHERE p.status = 'ACTIVE'
    ),
    sent_invoices AS (
      SELECT
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', i.id,
              'invoiceNumber', i."invoiceNumber",
              'status', i.status,
              'invoiceDate', i."invoiceDate",
              'grandTotalCents', i."grandTotalCents",
              'project', jsonb_build_object('title', p.title)
            )
            ORDER BY i."invoiceDate" DESC
          ),
          '[]'::jsonb
        ) AS data,
        COUNT(*) AS invoice_count,
        COALESCE(SUM(i."grandTotalCents"), 0) AS invoice_total
      FROM "Invoice" i
      JOIN "Project" p ON p.id = i."projectId"
      WHERE i.status = 'SENT'
    ),
    paid_invoices AS (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'paymentDate', i."paymentDate",
            'grandTotalCents', i."grandTotalCents"
          )
          ORDER BY i."paymentDate" DESC
        ),
        '[]'::jsonb
      ) AS data
      FROM "Invoice" i
      WHERE i.status = 'PAID' AND i."paymentDate" IS NOT NULL
    ),
    unbilled_time AS (
      SELECT
        COUNT(*) AS entry_count,
        COALESCE(SUM(ROUND(("durationMinutes"::numeric / 60) * "hourlyRateCentsSnapshot")), 0) AS entry_total
      FROM "TimeEntry"
      WHERE "billingStatus" = 'UNBILLED'
    ),
    unbilled_items AS (
      SELECT
        COUNT(*) AS item_count,
        COALESCE(SUM("totalCostCents"), 0) AS item_total
      FROM "ExpenseItem"
      WHERE "billingStatus" = 'UNBILLED'
    ),
    previous_week_entries AS (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'date', t.date,
            'durationMinutes', t."durationMinutes",
            'notes', t.notes,
            'project', jsonb_build_object(
              'title', p.title,
              'client', jsonb_build_object('businessName', c."businessName")
            )
          )
          ORDER BY t.date ASC, t."createdAt" ASC
        ),
        '[]'::jsonb
      ) AS data
      FROM "TimeEntry" t
      JOIN "Project" p ON p.id = t."projectId"
      JOIN "Client" c ON c.id = p."clientId"
      CROSS JOIN bounds b
      WHERE t.date >= b.start_at AND t.date <= b.end_at
    )
    SELECT
      active_projects.data AS "projects",
      sent_invoices.data AS "sentInvoices",
      paid_invoices.data AS "paidInvoices",
      previous_week_entries.data AS "previousWeekEntries",
      unbilled_time.entry_count AS "unbilledEntryCount",
      unbilled_items.item_count AS "unbilledItemCount",
      sent_invoices.invoice_total AS "pendingPaymentCents",
      (unbilled_time.entry_total + unbilled_items.item_total) AS "pendingInvoicesCents"
    FROM active_projects, sent_invoices, paid_invoices, unbilled_time, unbilled_items, previous_week_entries
  `;

  const row = rows[0];
  return {
    projects: row?.projects ?? [],
    sentInvoices: row?.sentInvoices ?? [],
    paidInvoices: row?.paidInvoices ?? [],
    previousWeekEntries: row?.previousWeekEntries ?? [],
    unbilledEntryCount: numberValue(row?.unbilledEntryCount),
    unbilledItemCount: numberValue(row?.unbilledItemCount),
    pendingPaymentCents: numberValue(row?.pendingPaymentCents),
    pendingInvoicesCents: numberValue(row?.pendingInvoicesCents)
  };
}

export const getDashboardData = unstable_cache(loadDashboardData, ["dashboard-data"], {
  revalidate: SHORT_REVALIDATE_SECONDS,
  tags: [CACHE_TAGS.dashboard]
});

export type ProjectListRow = {
  id: string;
  title: string;
  status: "ACTIVE" | "ARCHIVED";
  currentHourlyRateCents: number;
  clientBusinessName: string;
  unbilledMinutes: number;
  unbilledValueCents: number;
};

export const getProjectsPageData = unstable_cache(
  async (q: string): Promise<ProjectListRow[]> => {
    const like = `%${q}%`;
    const search = q
      ? Prisma.sql`AND (p.title ILIKE ${like} OR c."businessName" ILIKE ${like} OR c."contactName" ILIKE ${like})`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<
      (Omit<ProjectListRow, "unbilledMinutes" | "unbilledValueCents"> & {
        unbilledMinutes: bigint | number | null;
        unbilledValueCents: bigint | number | null;
      })[]
    >`
      WITH time_totals AS (
        SELECT
          "projectId",
          COALESCE(SUM("durationMinutes"), 0) AS minutes,
          COALESCE(SUM(ROUND(("durationMinutes"::numeric / 60) * "hourlyRateCentsSnapshot")), 0) AS value_cents
        FROM "TimeEntry"
        WHERE "billingStatus" = 'UNBILLED'
        GROUP BY "projectId"
      ),
      item_totals AS (
        SELECT "projectId", COALESCE(SUM("totalCostCents"), 0) AS value_cents
        FROM "ExpenseItem"
        WHERE "billingStatus" = 'UNBILLED'
        GROUP BY "projectId"
      )
      SELECT
        p.id,
        p.title,
        p.status,
        p."currentHourlyRateCents",
        c."businessName" AS "clientBusinessName",
        COALESCE(time_totals.minutes, 0) AS "unbilledMinutes",
        (COALESCE(time_totals.value_cents, 0) + COALESCE(item_totals.value_cents, 0)) AS "unbilledValueCents"
      FROM "Project" p
      JOIN "Client" c ON c.id = p."clientId"
      LEFT JOIN time_totals ON time_totals."projectId" = p.id
      LEFT JOIN item_totals ON item_totals."projectId" = p.id
      WHERE p.status IN ('ACTIVE', 'ARCHIVED') ${search}
      ORDER BY p.status ASC, p."updatedAt" DESC
    `;

    return rows.map((row) => ({
      ...row,
      unbilledMinutes: numberValue(row.unbilledMinutes),
      unbilledValueCents: numberValue(row.unbilledValueCents)
    }));
  },
  ["projects-page-data"],
  { revalidate: SHORT_REVALIDATE_SECONDS, tags: [CACHE_TAGS.projects] }
);

export type ClientListRow = {
  id: string;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  abn: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
  activeProjectCount: number;
  archivedProjectCount: number;
  invoiceCount: number;
  invoiceValueCents: number;
  projectNames: string | null;
};

export const getClientsPageData = unstable_cache(
  async (q: string): Promise<ClientListRow[]> => {
    const like = `%${q}%`;
    const search = q
      ? Prisma.sql`WHERE c."businessName" ILIKE ${like} OR c."contactName" ILIKE ${like} OR c.email ILIKE ${like} OR c.phone ILIKE ${like} OR c.abn ILIKE ${like} OR c.address ILIKE ${like} OR c.notes ILIKE ${like}`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<
      (Omit<ClientListRow, "activeProjectCount" | "archivedProjectCount" | "invoiceCount" | "invoiceValueCents"> & {
        activeProjectCount: bigint | number | null;
        archivedProjectCount: bigint | number | null;
        invoiceCount: bigint | number | null;
        invoiceValueCents: bigint | number | null;
      })[]
    >`
      WITH project_totals AS (
        SELECT
          "clientId",
          COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_count,
          COUNT(*) FILTER (WHERE status = 'ARCHIVED') AS archived_count,
          STRING_AGG(title, ', ' ORDER BY title ASC) AS project_names
        FROM "Project"
        GROUP BY "clientId"
      ),
      invoice_totals AS (
        SELECT
          "clientId",
          COUNT(*) AS invoice_count,
          COALESCE(SUM("grandTotalCents") FILTER (WHERE status <> 'VOID'), 0) AS invoice_value
        FROM "Invoice"
        GROUP BY "clientId"
      )
      SELECT
        c.id,
        c."businessName",
        c."contactName",
        c.email,
        c.phone,
        c.abn,
        c.address,
        c.notes,
        c."createdAt",
        COALESCE(project_totals.active_count, 0) AS "activeProjectCount",
        COALESCE(project_totals.archived_count, 0) AS "archivedProjectCount",
        COALESCE(invoice_totals.invoice_count, 0) AS "invoiceCount",
        COALESCE(invoice_totals.invoice_value, 0) AS "invoiceValueCents",
        project_totals.project_names AS "projectNames"
      FROM "Client" c
      LEFT JOIN project_totals ON project_totals."clientId" = c.id
      LEFT JOIN invoice_totals ON invoice_totals."clientId" = c.id
      ${search}
      ORDER BY c."businessName" ASC
    `;

    return rows.map((row) => ({
      ...row,
      activeProjectCount: numberValue(row.activeProjectCount),
      archivedProjectCount: numberValue(row.archivedProjectCount),
      invoiceCount: numberValue(row.invoiceCount),
      invoiceValueCents: numberValue(row.invoiceValueCents)
    }));
  },
  ["clients-page-data"],
  { revalidate: SHORT_REVALIDATE_SECONDS, tags: [CACHE_TAGS.clients] }
);

export const getInvoicesPageData = unstable_cache(
  async () =>
    prisma.invoice.findMany({
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        dateRangeStart: true,
        dateRangeEnd: true,
        invoiceDate: true,
        grandTotalCents: true,
        totalHours: true,
        project: { select: { title: true } },
        client: { select: { businessName: true } }
      },
      orderBy: [{ invoiceDate: "desc" }, { invoiceNumber: "desc" }]
    }),
  ["invoices-page-data"],
  { revalidate: SHORT_REVALIDATE_SECONDS, tags: [CACHE_TAGS.invoices] }
);

export type HoursExportProject = {
  id: string;
  title: string;
  client: string;
  unbilledMinutes: number;
};

export type HoursExportEntry = {
  id: string;
  projectId: string;
  date: Date;
  durationMinutes: number;
  notes: string | null;
};

export const getHoursExportData = unstable_cache(
  async (): Promise<{ projects: HoursExportProject[]; entries: HoursExportEntry[] }> => {
    const [projects, entries] = await Promise.all([
      prisma.$queryRaw<
        (Omit<HoursExportProject, "unbilledMinutes"> & {
          unbilledMinutes: bigint | number | null;
        })[]
      >`
        SELECT
          p.id,
          p.title,
          c."businessName" AS client,
          COALESCE(SUM(t."durationMinutes"), 0) AS "unbilledMinutes"
        FROM "Project" p
        JOIN "Client" c ON c.id = p."clientId"
        LEFT JOIN "TimeEntry" t ON t."projectId" = p.id AND t."billingStatus" = 'UNBILLED'
        WHERE p.status = 'ACTIVE'
        GROUP BY p.id, p.title, c."businessName"
        ORDER BY p.title ASC
      `,
      prisma.timeEntry.findMany({
        select: { id: true, projectId: true, date: true, durationMinutes: true, notes: true },
        orderBy: { date: "asc" }
      })
    ]);

    return {
      projects: projects.map((project) => ({
        ...project,
        unbilledMinutes: numberValue(project.unbilledMinutes)
      })),
      entries
    };
  },
  ["hours-export-data"],
  { revalidate: SHORT_REVALIDATE_SECONDS, tags: [CACHE_TAGS.hoursExport] }
);
