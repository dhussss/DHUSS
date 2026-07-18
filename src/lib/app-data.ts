import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { addDays, currentWeekMondayToSunday, dateInputValue, endOfDay, previousWeekMondayToSunday, todayInPerth } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const CACHE_TAGS = {
  dashboard: "dashboard-data",
  projects: "projects-data",
  clients: "clients-data",
  invoices: "invoices-data",
  hoursExport: "hours-export-data",
  insights: "insights-data",
  expenses: "expenses-data",
  profile: "profile-data"
} as const;

const SHORT_REVALIDATE_SECONDS = 20;

export type DashboardData = {
  profile: {
    id: string;
    tradingName: string;
    contactName: string | null;
    gstRegistered: boolean;
    gstRate: unknown;
    taxSetAsideEnabled: boolean;
    customTaxPercentageOverride: unknown;
    includeGstInTaxEstimate: boolean;
    includeSuperInSetAsidePlanning: boolean;
    superPlanningEnabled: boolean;
    superContributionPercentage: unknown;
    businessStructure: "SOLE_TRADER" | "EMPLOYER";
    onboardingCompletedAt: string | null;
  } | null;
  projects: { id: string; title: string; client: { businessName: string } }[];
  assignedProjects: { id: string; project: { id: string; title: string; client: { businessName: string } } }[];
  unpaidWageGroups: {
    teamMemberId: string;
    employee: string;
    projectId: string;
    project: string;
    minutes: number;
    wagesCents: number;
    billedMinutes: number;
  }[];
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
    unbilled: { count: number; valueCents: number; timeEntryCount: number; expenseItemCount: number };
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
  rolling30AverageDailyMinutes: number;
  rolling30AverageWeeklyBillableCents: number;
  currentWeekAverageDailyMinutes: number;
  weeklyAverageDeltaMinutes: number;
  currentWeekElapsedDays: number;
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
  profile: DashboardData["profile"];
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
  rolling30TotalMinutes: bigint | number | null;
  rolling30BillableCents: bigint | number | null;
  rolling30IncludedDayCount: bigint | number | null;
  unbilledEntryCount: bigint | number | null;
  unbilledItemCount: bigint | number | null;
  pendingPaymentCents: bigint | number | null;
  pendingInvoicesCents: bigint | number | null;
  overdueInvoiceCount: bigint | number | null;
  overdueInvoiceCents: bigint | number | null;
  assignedProjects: DashboardData["assignedProjects"];
  unpaidWageGroups: DashboardData["unpaidWageGroups"];
};

function numberValue(value: bigint | number | null | undefined) {
  return Number(value ?? 0);
}

export async function loadDashboardData(ownerId: string): Promise<DashboardData> {
  const today = todayInPerth();
  const currentWeek = currentWeekMondayToSunday(today);
  const previousWeek = previousWeekMondayToSunday();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const rolling30Start = addDays(today, -29);
  const rows = await prisma.$queryRaw<DashboardRow[]>`
    WITH bounds AS (
      SELECT
        ${currentWeek.start}::timestamp AS current_start_at,
        ${currentWeek.endInclusive}::timestamp AS current_end_at,
        ${previousWeek.start}::timestamp AS previous_start_at,
        ${previousWeek.endInclusive}::timestamp AS previous_end_at,
        ${today}::timestamp AS today_at,
        ${endOfDay(today)}::timestamp AS today_end_at,
        ${rolling30Start}::timestamp AS rolling_start_at,
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
        COALESCE(SUM(ROUND((t."durationMinutes"::numeric / 60) * t."hourlyRateCentsSnapshot")), 0) AS entry_total
      FROM "TimeEntry" t
      JOIN "Project" p ON p.id = t."projectId"
      WHERE t."billingStatus" = 'UNBILLED'
        AND t."ownerId" = ${ownerId}
        AND (t."teamMemberId" IS NULL OR t."approvalStatus" = 'APPROVED')
        AND p."ownerId" = ${ownerId}
        AND p.status = 'ACTIVE'
    ),
    unbilled_items AS (
      SELECT
        COUNT(*) AS item_count,
        COALESCE(SUM(e."totalCostCents"), 0) AS item_total
      FROM "ExpenseItem" e
      JOIN "Project" p ON p.id = e."projectId"
      WHERE e."billingStatus" = 'UNBILLED'
        AND e."ownerId" = ${ownerId}
        AND p."ownerId" = ${ownerId}
        AND p.status = 'ACTIVE'
    ),
    rolling_30_time_by_day AS (
      SELECT
        t.date::date AS date_key,
        COALESCE(SUM(t."durationMinutes"), 0) AS minutes,
        COALESCE(SUM(ROUND((t."durationMinutes"::numeric / 60) * t."hourlyRateCentsSnapshot")), 0) AS billable_cents
      FROM "TimeEntry" t
      CROSS JOIN bounds b
      WHERE t."ownerId" = ${ownerId}
        AND (t."teamMemberId" IS NULL OR t."approvalStatus" = 'APPROVED')
        AND t.date >= b.rolling_start_at
        AND t.date <= b.today_end_at
      GROUP BY t.date::date
    ),
    rolling_30_day_offs AS (
      SELECT d.date::date AS date_key
      FROM "DayOffLog" d
      CROSS JOIN bounds b
      WHERE d."ownerId" = ${ownerId}
        AND d."plannedWorkDay" = true
        AND d.date >= b.rolling_start_at
        AND d.date <= b.today_end_at
    ),
    rolling_30_work AS (
      SELECT
        COALESCE(SUM(COALESCE(t.minutes, 0)), 0) AS total_minutes,
        COALESCE(SUM(COALESCE(t.billable_cents, 0)), 0) AS total_billable_cents,
        COUNT(*) AS included_day_count
      FROM rolling_30_time_by_day t
      FULL OUTER JOIN rolling_30_day_offs d ON d.date_key = t.date_key
      WHERE COALESCE(t.minutes, 0) > 0 OR d.date_key IS NOT NULL
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
        AND (t."teamMemberId" IS NULL OR t."approvalStatus" = 'APPROVED')
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
        AND (t."teamMemberId" IS NULL OR t."approvalStatus" = 'APPROVED')
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
          AND ("teamMemberId" IS NULL OR "approvalStatus" = 'APPROVED')
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
    ),
    unpaid_wage_groups AS (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'teamMemberId', grouped."teamMemberId",
            'employee', grouped.employee,
            'projectId', grouped."projectId",
            'project', grouped.project,
            'minutes', grouped.minutes,
            'wagesCents', grouped.wages_cents,
            'billedMinutes', grouped.billed_minutes
          )
          ORDER BY grouped.wages_cents DESC, grouped.employee ASC
        ),
        '[]'::jsonb
      ) AS data
      FROM (
        SELECT
          t."teamMemberId",
          tm."displayName" AS employee,
          p.id AS "projectId",
          p.title AS project,
          COALESCE(SUM(t."durationMinutes"), 0) AS minutes,
          COALESCE(SUM(ROUND((t."durationMinutes"::numeric / 60) * COALESCE(t."payRateCentsSnapshot", 0))), 0) AS wages_cents,
          COALESCE(SUM(t."durationMinutes") FILTER (WHERE t."billingStatus" = 'BILLED'), 0) AS billed_minutes
        FROM "TimeEntry" t
        JOIN "TeamMember" tm ON tm.id = t."teamMemberId"
        JOIN "Project" p ON p.id = t."projectId"
        WHERE t."ownerId" = ${ownerId}
          AND t."teamMemberId" IS NOT NULL
          AND t."approvalStatus" = 'APPROVED'
          AND t."paymentStatus" = 'UNPAID'
        GROUP BY t."teamMemberId", tm."displayName", p.id, p.title
      ) grouped
    ),
    assigned_projects AS (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', pa.id,
            'project', jsonb_build_object(
              'id', p.id,
              'title', p.title,
              'client', jsonb_build_object('businessName', c."businessName")
            )
          )
          ORDER BY p.title ASC
        ),
        '[]'::jsonb
      ) AS data
      FROM "ProjectAssignment" pa
      JOIN "TeamMember" tm ON tm.id = pa."teamMemberId"
      JOIN "Project" p ON p.id = pa."projectId"
      JOIN "Client" c ON c.id = p."clientId"
      WHERE pa.active = true
        AND tm."userId" = ${ownerId}
        AND tm.status = 'ACTIVE'
        AND p.status = 'ACTIVE'
    ),
    business_profile AS (
      SELECT jsonb_build_object(
        'id', bp.id,
        'tradingName', bp."tradingName",
        'contactName', bp."contactName",
        'gstRegistered', bp."gstRegistered",
        'gstRate', bp."gstRate",
        'taxSetAsideEnabled', bp."taxSetAsideEnabled",
        'customTaxPercentageOverride', bp."customTaxPercentageOverride",
        'includeGstInTaxEstimate', bp."includeGstInTaxEstimate",
        'includeSuperInSetAsidePlanning', bp."includeSuperInSetAsidePlanning",
        'superPlanningEnabled', bp."superPlanningEnabled",
        'superContributionPercentage', bp."superContributionPercentage",
        'businessStructure', bp."businessStructure",
        'onboardingCompletedAt', bp."onboardingCompletedAt"
      ) AS data
      FROM "BusinessProfile" bp
      WHERE bp."ownerId" = ${ownerId}
      LIMIT 1
    )
    SELECT
      business_profile.data AS "profile",
      active_projects.data AS "projects",
      top_active_projects.data AS "topActiveProjects",
      invoice_snapshots.data AS "invoiceSnapshots",
      sent_invoices.data AS "sentInvoices",
      previous_week_entries.data AS "previousWeekEntries",
      current_week_entries.data AS "currentWeekEntries",
      current_week_entries.entry_count AS "currentWeekEntryCount",
      current_week_entries.total_minutes AS "totalCurrentWeekMinutes",
      current_week_entries.billable_value AS "totalCurrentWeekBillableCents",
      rolling_30_work.total_minutes AS "rolling30TotalMinutes",
      rolling_30_work.total_billable_cents AS "rolling30BillableCents",
      rolling_30_work.included_day_count AS "rolling30IncludedDayCount",
      unbilled_time.entry_count AS "unbilledEntryCount",
      unbilled_items.item_count AS "unbilledItemCount",
      sent_invoices.invoice_total AS "pendingPaymentCents",
      (unbilled_time.entry_total + unbilled_items.item_total) AS "pendingInvoicesCents",
      overdue_invoices.overdue_count AS "overdueInvoiceCount",
      overdue_invoices.overdue_total AS "overdueInvoiceCents",
      assigned_projects.data AS "assignedProjects",
      unpaid_wage_groups.data AS "unpaidWageGroups"
    FROM active_projects, top_active_projects, invoice_snapshots, sent_invoices, overdue_invoices, unbilled_time, unbilled_items, rolling_30_work, previous_week_entries, current_week_entries, assigned_projects, unpaid_wage_groups
    LEFT JOIN business_profile ON true
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
    paidThisMonth: { count: 0, valueCents: 0 },
    unbilled: { count: 0, valueCents: 0, timeEntryCount: 0, expenseItemCount: 0 }
  };
  const unbilledEntryCount = numberValue(row?.unbilledEntryCount);
  const unbilledItemCount = numberValue(row?.unbilledItemCount);
  const pendingInvoicesCents = numberValue(row?.pendingInvoicesCents);
  const elapsedDays = Math.max(1, Math.min(7, Math.floor((today.getTime() - currentWeek.start.getTime()) / 86_400_000) + 1));
  const rolling30IncludedDayCount = numberValue(row?.rolling30IncludedDayCount);
  const rolling30AverageDailyMinutes = rolling30IncludedDayCount ? numberValue(row?.rolling30TotalMinutes) / rolling30IncludedDayCount : 0;
  const rolling30AverageWeeklyBillableCents = rolling30IncludedDayCount
    ? Math.round((numberValue(row?.rolling30BillableCents) / rolling30IncludedDayCount) * 7)
    : 0;
  const currentWeekAverageDailyMinutes = numberValue(row?.totalCurrentWeekMinutes) / elapsedDays;

  return {
    profile: row?.profile ?? null,
    projects: row?.projects ?? [],
    assignedProjects: row?.assignedProjects ?? [],
    unpaidWageGroups: (row?.unpaidWageGroups ?? []).map((group) => ({
      ...group,
      minutes: numberValue(group.minutes),
      wagesCents: numberValue(group.wagesCents),
      billedMinutes: numberValue(group.billedMinutes)
    })),
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
      },
      unbilled: {
        count: unbilledEntryCount + unbilledItemCount,
        valueCents: pendingInvoicesCents,
        timeEntryCount: unbilledEntryCount,
        expenseItemCount: unbilledItemCount
      }
    },
    sentInvoices: row?.sentInvoices ?? [],
    currentWeekStart: dateInputValue(currentWeek.start),
    currentWeekEnd: dateInputValue(currentWeek.end),
    currentWeekDays,
    totalCurrentWeekMinutes: numberValue(row?.totalCurrentWeekMinutes),
    totalCurrentWeekBillableCents: numberValue(row?.totalCurrentWeekBillableCents),
    rolling30AverageDailyMinutes,
    rolling30AverageWeeklyBillableCents,
    currentWeekAverageDailyMinutes,
    weeklyAverageDeltaMinutes: currentWeekAverageDailyMinutes - rolling30AverageDailyMinutes,
    currentWeekElapsedDays: elapsedDays,
    currentWeekEntryCount: numberValue(row?.currentWeekEntryCount),
    previousWeekEntries: row?.previousWeekEntries ?? [],
    unbilledEntryCount,
    unbilledItemCount,
    pendingPaymentCents: numberValue(row?.pendingPaymentCents),
    pendingInvoicesCents,
    overdueInvoiceCount: numberValue(row?.overdueInvoiceCount),
    overdueInvoiceCents: numberValue(row?.overdueInvoiceCents)
  };
}

function weekdayLabel(date: Date, weekday: "short" | "long") {
  return new Intl.DateTimeFormat("en-AU", { weekday, timeZone: "UTC" }).format(date);
}

export const getDashboardData = unstable_cache(loadDashboardData, ["dashboard-data"], {
  revalidate: SHORT_REVALIDATE_SECONDS,
  tags: [CACHE_TAGS.dashboard, CACHE_TAGS.profile]
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
};

export const getClientsPageData = unstable_cache(
  async (ownerId: string, q: string): Promise<ClientListRow[]> => {
    const like = `%${q}%`;
    const search = q
      ? Prisma.sql`AND (c."businessName" ILIKE ${like} OR c."contactName" ILIKE ${like} OR c.email ILIKE ${like} OR c.phone ILIKE ${like})`
      : Prisma.empty;

    return prisma.$queryRaw<ClientListRow[]>`
      SELECT
        c.id,
        c."businessName",
        c."contactName",
        c.email,
        c.phone
      FROM "Client" c
      WHERE c."ownerId" = ${ownerId} ${search}
      ORDER BY c."businessName" ASC
    `;
  },
  ["clients-page-data"],
  { revalidate: SHORT_REVALIDATE_SECONDS, tags: [CACHE_TAGS.clients] }
);

export const getInvoicesPageData = unstable_cache(
  async (ownerId: string, status: "ALL" | "DRAFT" | "SENT" | "OVERDUE" | "PAID" | "VOID" = "ALL", q = "") =>
    prisma.invoice.findMany({
      where: {
        ownerId,
        ...(status === "ALL"
          ? {}
          : status === "OVERDUE"
            ? { status: "SENT", dueDate: { lt: todayInPerth() } }
            : { status }),
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

export const getExpensesPageData = unstable_cache(
  async (ownerId: string) =>
    prisma.workExpense.findMany({
      where: { ownerId },
      select: {
        id: true,
        date: true,
        category: true,
        description: true,
        vendor: true,
        amountCents: true,
        gstIncluded: true,
        gstAmountCents: true,
        paymentMethod: true,
        receiptReference: true,
        notes: true,
        billable: true,
        status: true,
        archivedAt: true,
        project: { select: { id: true, title: true, client: { select: { businessName: true } } } },
        wagePayment: { select: { id: true, teamMemberId: true } }
      },
      orderBy: [{ archivedAt: "asc" }, { date: "desc" }, { createdAt: "desc" }]
    }),
  ["expenses-page-data"],
  { revalidate: SHORT_REVALIDATE_SECONDS, tags: [CACHE_TAGS.expenses] }
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
        LEFT JOIN "TimeEntry" t ON t."projectId" = p.id
          AND t."billingStatus" = 'UNBILLED'
          AND (t."teamMemberId" IS NULL OR t."approvalStatus" = 'APPROVED')
        WHERE p.status = 'ACTIVE' AND p."ownerId" = ${ownerId}
        GROUP BY p.id, p.title, c."businessName"
        ORDER BY p.title ASC
      `,
      prisma.timeEntry.findMany({
        where: { ownerId, OR: [{ teamMemberId: null }, { approvalStatus: "APPROVED" }] },
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
