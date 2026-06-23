import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { currentWeekMondayToSunday, dateInputValue, previousWeekMondayToSunday, todayInPerth } from "@/lib/dates";
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
  topActiveProjects: {
    id: string;
    title: string;
    client: { businessName: string };
    unbilledMinutes: number;
    labourValueCents: number;
    expenseValueCents: number;
    unbilledValueCents: number;
  }[];
  invoiceSnapshots: {
    overdue: { count: number; valueCents: number };
    sent: { count: number; valueCents: number };
    draft: { count: number; valueCents: number };
    paidThisMonth: { count: number; valueCents: number };
  };
  sentInvoices: {
    id: string;
    invoiceNumber: string;
    status: "SENT";
    invoiceDate: string;
    dueDate: string | null;
    grandTotalCents: number;
    project: { title: string };
    client: { businessName: string };
  }[];
  currentWeekStart: string;
  currentWeekEnd: string;
  currentWeekDays: {
    date: string;
    dayName: string;
    dayShort: string;
    dateLabel: string;
    isToday: boolean;
    totalMinutes: number;
    billableValueCents: number;
    entryCount: number;
    projects: string[];
  }[];
  totalCurrentWeekMinutes: number;
  totalCurrentWeekBillableCents: number;
  currentWeekEntryCount: number;
  unbilledEntryCount: number;
  unbilledItemCount: number;
  pendingPaymentCents: number;
  pendingInvoicesCents: number;
  overdueInvoiceCount: number;
  overdueInvoiceCents: number;
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
  topActiveProjects: DashboardData["topActiveProjects"];
  invoiceSnapshots: DashboardData["invoiceSnapshots"];
  sentInvoices: DashboardData["sentInvoices"];
  previousWeekEntries: DashboardData["previousWeekEntries"];
  currentWeekEntries: {
    id: string;
    date: string;
    durationMinutes: number;
    hourlyRateCentsSnapshot: number;
    project: { title: string };
  }[];
  currentWeekEntryCount: bigint | number | null;
  totalCurrentWeekMinutes: bigint | number | null;
  totalCurrentWeekBillableCents: bigint | number | null;
  unbilledEntryCount: bigint | number | null;
  unbilledItemCount: bigint | number | null;
  pendingPaymentCents: bigint | number | null;
  pendingInvoicesCents: bigint | number | null;
  overdueInvoiceCount: bigint | number | null;
  overdueInvoiceCents: bigint | number | null;
};

function numberValue(value: bigint | number | null | undefined) {
  return Number(value ?? 0);
}

export async function loadDashboardData(ownerId: string): Promise<DashboardData> {
  const today = todayInPerth();
  const currentWeek = currentWeekMondayToSunday(today);
  const previousWeek = previousWeekMondayToSunday();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const rows = await prisma.$queryRaw<DashboardRow[]>`
    WITH bounds AS (
      SELECT
        ${currentWeek.start}::timestamp AS current_start_at,
        ${currentWeek.endInclusive}::timestamp AS current_end_at,
        ${previousWeek.start}::timestamp AS previous_start_at,
        ${previousWeek.endInclusive}::timestamp AS previous_end_at,
        ${today}::timestamp AS today_at,
        ${monthStart}::timestamp AS month_start_at
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
      WHERE p.status = 'ACTIVE' AND p."ownerId" = ${ownerId}
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
              'dueDate', i."dueDate",
              'grandTotalCents', i."grandTotalCents",
              'project', jsonb_build_object('title', p.title),
              'client', jsonb_build_object('businessName', c."businessName")
            )
            ORDER BY COALESCE(i."dueDate", i."invoiceDate" + (i."paymentTermsDays" * INTERVAL '1 day')) ASC
          ),
          '[]'::jsonb
        ) AS data,
        COUNT(*) AS invoice_count,
        COALESCE(SUM(i."grandTotalCents"), 0) AS invoice_total
      FROM "Invoice" i
      JOIN "Project" p ON p.id = i."projectId"
      JOIN "Client" c ON c.id = i."clientId"
      WHERE i.status = 'SENT' AND i."ownerId" = ${ownerId}
    ),
    overdue_invoices AS (
      SELECT
        COUNT(*) AS overdue_count,
        COALESCE(SUM(i."grandTotalCents"), 0) AS overdue_total
      FROM "Invoice" i
      CROSS JOIN bounds b
      WHERE i.status = 'SENT'
        AND i."ownerId" = ${ownerId}
        AND COALESCE(i."dueDate", i."invoiceDate" + (i."paymentTermsDays" * INTERVAL '1 day')) < b.today_at
    ),
    unbilled_time AS (
      SELECT
        COUNT(*) AS entry_count,
        COALESCE(SUM(ROUND(("durationMinutes"::numeric / 60) * "hourlyRateCentsSnapshot")), 0) AS entry_total
      FROM "TimeEntry"
      WHERE "billingStatus" = 'UNBILLED' AND "ownerId" = ${ownerId}
    ),
    unbilled_items AS (
      SELECT
        COUNT(*) AS item_count,
        COALESCE(SUM("totalCostCents"), 0) AS item_total
      FROM "ExpenseItem"
      WHERE "billingStatus" = 'UNBILLED' AND "ownerId" = ${ownerId}
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
      WHERE t.date >= b.previous_start_at AND t.date <= b.previous_end_at AND t."ownerId" = ${ownerId}
    ),
    current_week_entries AS (
      SELECT
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', t.id,
              'date', t.date,
              'durationMinutes', t."durationMinutes",
              'hourlyRateCentsSnapshot', t."hourlyRateCentsSnapshot",
              'project', jsonb_build_object('title', p.title)
            )
            ORDER BY t.date ASC, t."createdAt" ASC
          ),
          '[]'::jsonb
        ) AS data,
        COUNT(*) AS entry_count,
        COALESCE(SUM(t."durationMinutes"), 0) AS total_minutes,
        COALESCE(SUM(ROUND((t."durationMinutes"::numeric / 60) * t."hourlyRateCentsSnapshot")), 0) AS billable_value
      FROM "TimeEntry" t
      JOIN "Project" p ON p.id = t."projectId"
      CROSS JOIN bounds b
      WHERE t.date >= b.current_start_at AND t.date <= b.current_end_at AND t."ownerId" = ${ownerId}
    ),
    top_project_rows AS (
      SELECT
        p.id,
        p.title,
        c."businessName",
        COALESCE(time_totals.minutes, 0) AS unbilled_minutes,
        COALESCE(time_totals.value_cents, 0) AS labour_value_cents,
        COALESCE(item_totals.value_cents, 0) AS expense_value_cents,
        (COALESCE(time_totals.value_cents, 0) + COALESCE(item_totals.value_cents, 0)) AS unbilled_value_cents
      FROM "Project" p
      JOIN "Client" c ON c.id = p."clientId"
      LEFT JOIN (
        SELECT
          "projectId",
          COALESCE(SUM("durationMinutes"), 0) AS minutes,
          COALESCE(SUM(ROUND(("durationMinutes"::numeric / 60) * "hourlyRateCentsSnapshot")), 0) AS value_cents
        FROM "TimeEntry"
        WHERE "billingStatus" = 'UNBILLED' AND "ownerId" = ${ownerId}
        GROUP BY "projectId"
      ) time_totals ON time_totals."projectId" = p.id
      LEFT JOIN (
        SELECT "projectId", COALESCE(SUM("totalCostCents"), 0) AS value_cents
        FROM "ExpenseItem"
        WHERE "billingStatus" = 'UNBILLED' AND "ownerId" = ${ownerId}
        GROUP BY "projectId"
      ) item_totals ON item_totals."projectId" = p.id
      WHERE p.status = 'ACTIVE' AND p."ownerId" = ${ownerId}
      ORDER BY unbilled_value_cents DESC, p."updatedAt" DESC
      LIMIT 5
    ),
    top_active_projects AS (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'title', title,
            'client', jsonb_build_object('businessName', "businessName"),
            'unbilledMinutes', unbilled_minutes,
            'labourValueCents', labour_value_cents,
            'expenseValueCents', expense_value_cents,
            'unbilledValueCents', unbilled_value_cents
          )
          ORDER BY unbilled_value_cents DESC, title ASC
        ),
        '[]'::jsonb
      ) AS data
      FROM top_project_rows
    ),
    invoice_snapshots AS (
      SELECT jsonb_build_object(
        'overdue', jsonb_build_object(
          'count', COUNT(*) FILTER (
            WHERE i.status = 'SENT'
              AND COALESCE(i."dueDate", i."invoiceDate" + (i."paymentTermsDays" * INTERVAL '1 day')) < b.today_at
          ),
          'valueCents', COALESCE(SUM(i."grandTotalCents") FILTER (
            WHERE i.status = 'SENT'
              AND COALESCE(i."dueDate", i."invoiceDate" + (i."paymentTermsDays" * INTERVAL '1 day')) < b.today_at
          ), 0)
        ),
        'sent', jsonb_build_object(
          'count', COUNT(*) FILTER (WHERE i.status = 'SENT'),
          'valueCents', COALESCE(SUM(i."grandTotalCents") FILTER (WHERE i.status = 'SENT'), 0)
        ),
        'draft', jsonb_build_object(
          'count', COUNT(*) FILTER (WHERE i.status = 'DRAFT'),
          'valueCents', COALESCE(SUM(i."grandTotalCents") FILTER (WHERE i.status = 'DRAFT'), 0)
        ),
        'paidThisMonth', jsonb_build_object(
          'count', COUNT(*) FILTER (WHERE i.status = 'PAID' AND i."paymentDate" >= b.month_start_at),
          'valueCents', COALESCE(SUM(i."grandTotalCents") FILTER (WHERE i.status = 'PAID' AND i."paymentDate" >= b.month_start_at), 0)
        )
      ) AS data
      FROM "Invoice" i
      CROSS JOIN bounds b
      WHERE i."ownerId" = ${ownerId}
    )
    SELECT
      active_projects.data AS "projects",
      top_active_projects.data AS "topActiveProjects",
      invoice_snapshots.data AS "invoiceSnapshots",
      sent_invoices.data AS "sentInvoices",
      previous_week_entries.data AS "previousWeekEntries",
      current_week_entries.data AS "currentWeekEntries",
      current_week_entries.entry_count AS "currentWeekEntryCount",
      current_week_entries.total_minutes AS "totalCurrentWeekMinutes",
      current_week_entries.billable_value AS "totalCurrentWeekBillableCents",
      unbilled_time.entry_count AS "unbilledEntryCount",
      unbilled_items.item_count AS "unbilledItemCount",
      sent_invoices.invoice_total AS "pendingPaymentCents",
      (unbilled_time.entry_total + unbilled_items.item_total) AS "pendingInvoicesCents",
      overdue_invoices.overdue_count AS "overdueInvoiceCount",
      overdue_invoices.overdue_total AS "overdueInvoiceCents"
    FROM active_projects, top_active_projects, invoice_snapshots, sent_invoices, overdue_invoices, unbilled_time, unbilled_items, previous_week_entries, current_week_entries
  `;

  const row = rows[0];
  const currentWeekEntries = row?.currentWeekEntries ?? [];
  const entriesByDay = new Map<string, NonNullable<DashboardRow["currentWeekEntries"]>>();
  for (const entry of currentWeekEntries) {
    const key = dateInputValue(entry.date);
    const entries = entriesByDay.get(key) ?? [];
    entries.push(entry);
    entriesByDay.set(key, entries);
  }
  const todayKey = dateInputValue(today);
  const currentWeekDays = currentWeek.days.map((day) => {
    const key = dateInputValue(day);
    const dayEntries = entriesByDay.get(key) ?? [];
    const projectNames = Array.from(new Set(dayEntries.map((entry) => entry.project.title)));
    return {
      date: key,
      dayName: weekdayLabel(day, "long"),
      dayShort: weekdayLabel(day, "short"),
      dateLabel: `${day.getUTCDate()}/${day.getUTCMonth() + 1}`,
      isToday: key === todayKey,
      totalMinutes: dayEntries.reduce((sum, entry) => sum + Number(entry.durationMinutes ?? 0), 0),
      billableValueCents: dayEntries.reduce(
        (sum, entry) => sum + Math.round((Number(entry.durationMinutes ?? 0) * Number(entry.hourlyRateCentsSnapshot ?? 0)) / 60),
        0
      ),
      entryCount: dayEntries.length,
      projects: projectNames
    };
  });
  const invoiceSnapshots = row?.invoiceSnapshots ?? {
    overdue: { count: 0, valueCents: 0 },
    sent: { count: 0, valueCents: 0 },
    draft: { count: 0, valueCents: 0 },
    paidThisMonth: { count: 0, valueCents: 0 }
  };

  return {
    projects: row?.projects ?? [],
    topActiveProjects: (row?.topActiveProjects ?? []).map((project) => ({
      ...project,
      unbilledMinutes: numberValue(project.unbilledMinutes),
      labourValueCents: numberValue(project.labourValueCents),
      expenseValueCents: numberValue(project.expenseValueCents),
      unbilledValueCents: numberValue(project.unbilledValueCents)
    })),
    invoiceSnapshots: {
      overdue: {
        count: numberValue(invoiceSnapshots.overdue.count),
        valueCents: numberValue(invoiceSnapshots.overdue.valueCents)
      },
      sent: {
        count: numberValue(invoiceSnapshots.sent.count),
        valueCents: numberValue(invoiceSnapshots.sent.valueCents)
      },
      draft: {
        count: numberValue(invoiceSnapshots.draft.count),
        valueCents: numberValue(invoiceSnapshots.draft.valueCents)
      },
      paidThisMonth: {
        count: numberValue(invoiceSnapshots.paidThisMonth.count),
        valueCents: numberValue(invoiceSnapshots.paidThisMonth.valueCents)
      }
    },
    sentInvoices: row?.sentInvoices ?? [],
    currentWeekStart: dateInputValue(currentWeek.start),
    currentWeekEnd: dateInputValue(currentWeek.end),
    currentWeekDays,
    totalCurrentWeekMinutes: numberValue(row?.totalCurrentWeekMinutes),
    totalCurrentWeekBillableCents: numberValue(row?.totalCurrentWeekBillableCents),
    currentWeekEntryCount: numberValue(row?.currentWeekEntryCount),
    previousWeekEntries: row?.previousWeekEntries ?? [],
    unbilledEntryCount: numberValue(row?.unbilledEntryCount),
    unbilledItemCount: numberValue(row?.unbilledItemCount),
    pendingPaymentCents: numberValue(row?.pendingPaymentCents),
    pendingInvoicesCents: numberValue(row?.pendingInvoicesCents),
    overdueInvoiceCount: numberValue(row?.overdueInvoiceCount),
    overdueInvoiceCents: numberValue(row?.overdueInvoiceCents)
  };
}

function weekdayLabel(date: Date, weekday: "short" | "long") {
  return new Intl.DateTimeFormat("en-AU", { weekday, timeZone: "UTC" }).format(date);
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
  async (ownerId: string, q: string): Promise<ProjectListRow[]> => {
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
        WHERE "billingStatus" = 'UNBILLED' AND "ownerId" = ${ownerId}
        GROUP BY "projectId"
      ),
      item_totals AS (
        SELECT "projectId", COALESCE(SUM("totalCostCents"), 0) AS value_cents
        FROM "ExpenseItem"
        WHERE "billingStatus" = 'UNBILLED' AND "ownerId" = ${ownerId}
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
      WHERE p."ownerId" = ${ownerId} AND p.status IN ('ACTIVE', 'ARCHIVED') ${search}
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
  async (ownerId: string, q: string): Promise<ClientListRow[]> => {
    const like = `%${q}%`;
    const search = q
      ? Prisma.sql`AND (c."businessName" ILIKE ${like} OR c."contactName" ILIKE ${like} OR c.email ILIKE ${like} OR c.phone ILIKE ${like} OR c.abn ILIKE ${like} OR c.address ILIKE ${like} OR c.notes ILIKE ${like})`
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
        WHERE "ownerId" = ${ownerId}
        GROUP BY "clientId"
      ),
      invoice_totals AS (
        SELECT
          "clientId",
          COUNT(*) AS invoice_count,
          COALESCE(SUM("grandTotalCents") FILTER (WHERE status <> 'VOID'), 0) AS invoice_value
        FROM "Invoice"
        WHERE "ownerId" = ${ownerId}
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
      WHERE c."ownerId" = ${ownerId} ${search}
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
  async (ownerId: string, status: "ALL" | "DRAFT" | "SENT" | "PAID" | "VOID" = "ALL", q = "") =>
    prisma.invoice.findMany({
      where: {
        ownerId,
        ...(status === "ALL" ? {} : { status }),
        ...(q
          ? {
              OR: [
                { invoiceNumber: { contains: q, mode: "insensitive" as const } },
                { project: { title: { contains: q, mode: "insensitive" as const } } },
                { client: { businessName: { contains: q, mode: "insensitive" as const } } }
              ]
            }
          : {})
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        mode: true,
        dateRangeStart: true,
        dateRangeEnd: true,
        invoiceDate: true,
        dueDate: true,
        paymentDate: true,
        grandTotalCents: true,
        totalHours: true,
        totalDurationMinutes: true,
        project: { select: { title: true } },
        client: { select: { businessName: true, contactName: true, email: true } }
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
  async (ownerId: string): Promise<{ projects: HoursExportProject[]; entries: HoursExportEntry[] }> => {
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
        WHERE p.status = 'ACTIVE' AND p."ownerId" = ${ownerId}
        GROUP BY p.id, p.title, c."businessName"
        ORDER BY p.title ASC
      `,
      prisma.timeEntry.findMany({
        where: { ownerId },
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
