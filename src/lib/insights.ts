import { unstable_cache } from "next/cache";
import { addDays, currentWeekMondayToSunday, dateInputValue, endOfDay, todayInPerth } from "@/lib/dates";
import { expenseCategoryLabel } from "@/lib/expenses";
import { CACHE_TAGS } from "@/lib/app-data";
import { calculateSetAsidePlanning, type SetAsidePlanning } from "@/lib/planning";
import { prisma } from "@/lib/prisma";

const SHORT_REVALIDATE_SECONDS = 20;
const DAY_MS = 86_400_000;

type Numeric = bigint | number | null | undefined;

export type InsightTone = "mint" | "yolk" | "gum" | "ink";

export type WeekPerformanceDay = {
  date: string;
  dayName: string;
  dayShort: string;
  dateLabel: string;
  isToday: boolean;
  totalMinutes: number;
  billableValueCents: number;
  entryCount: number;
  projects: string[];
};

export type CurrentWeekPerformance = {
  start: string;
  end: string;
  days: WeekPerformanceDay[];
  totalMinutes: number;
  billableValueCents: number;
  entryCount: number;
  elapsedDays: number;
  averageDailyMinutes: number;
  rolling30AverageDailyMinutes: number;
  averageDeltaMinutes: number;
};

export type Rolling30Stats = {
  totalMinutes: number;
  loggedDayCount: number;
  includedDayCount: number;
  dayOffCount: number;
  averageDailyMinutes: number;
  loggedDayAverageMinutes: number;
  averageWeeklyBillableCents: number;
};

export type QuarterTrendPoint = {
  date: string;
  label: string;
  minutes: number;
  rollingAverageMinutes: number;
  projects: string[];
};

export type FinancialYearPoint = {
  month: string;
  label: string;
  paidCents: number;
  cumulativePaidCents: number;
};

export type InsightCard = {
  title: string;
  value: string;
  body: string;
  tone: InsightTone;
};

export type InsightsData = {
  currentWeek: CurrentWeekPerformance;
  rolling30: Rolling30Stats;
  workload: {
    hoursThisMonthMinutes: number;
    hoursThisQuarterMinutes: number;
    bestDayThisMonth: { date: string; minutes: number } | null;
    busiestProjectThisMonth: { title: string; minutes: number } | null;
  };
  revenue: {
    billableThisWeekCents: number;
    billableThisMonthCents: number;
    paidThisMonthCents: number;
    paidThisMonthCount: number;
    outstandingCents: number;
    outstandingCount: number;
    overdueCents: number;
    overdueCount: number;
    unbilledCents: number;
    unbilledTimeEntryCount: number;
    unbilledExpenseItemCount: number;
    averageHourlyRateCents: number | null;
  };
  expenses: {
    thisMonthCents: number;
    financialYearCents: number;
    generalFinancialYearCents: number;
    largestCategoryThisMonth: { category: string; valueCents: number } | null;
    byCategoryThisMonth: { category: string; label: string; valueCents: number }[];
    byProjectThisMonth: { project: string; valueCents: number }[];
  };
  taxSetAside: SetAsidePlanning;
  topUnbilledProject: { title: string; valueCents: number } | null;
  quarterTrend: QuarterTrendPoint[];
  financialYear: {
    start: string;
    end: string;
    points: FinancialYearPoint[];
    paidToMeCents: number;
    employeeEarningsCents: number;
    paidToEmployeesCents: number;
  };
  insightCards: InsightCard[];
};

type InsightRow = {
  currentWeekEntries: {
    id: string;
    date: string;
    durationMinutes: number;
    hourlyRateCentsSnapshot: number;
    project: { title: string };
  }[];
  currentWeekEntryCount: Numeric;
  totalCurrentWeekMinutes: Numeric;
  totalCurrentWeekBillableCents: Numeric;
  rolling30TotalMinutes: Numeric;
  rolling30BillableCents: Numeric;
  rolling30LoggedDayCount: Numeric;
  rolling30IncludedDayCount: Numeric;
  rolling30DayOffCount: Numeric;
  hoursThisMonthMinutes: Numeric;
  hoursThisQuarterMinutes: Numeric;
  billableThisMonthCents: Numeric;
  paidThisMonthCents: Numeric;
  paidThisMonthCount: Numeric;
  paidFinancialYearCents: Numeric;
  employeeEarningsFinancialYearCents: Numeric;
  paidToEmployeesFinancialYearCents: Numeric;
  outstandingCents: Numeric;
  outstandingCount: Numeric;
  overdueCents: Numeric;
  overdueCount: Numeric;
  unbilledTimeEntryCount: Numeric;
  unbilledExpenseItemCount: Numeric;
  unbilledCents: Numeric;
  bestDayThisMonth: { date: string; minutes: number } | null;
  busiestProjectThisMonth: { title: string; minutes: number } | null;
  topUnbilledProject: { title: string; valueCents: number } | null;
  quarterDaily: { date: string; minutes: number; projects: string[] }[];
  fyPaidMonthly: { month: string; valueCents: number }[];
  expenseThisMonthCents: Numeric;
  expenseFyCents: Numeric;
  generalExpenseFyCents: Numeric;
  largestExpenseCategoryThisMonth: { category: string; valueCents: number } | null;
  expensesByCategoryThisMonth: { category: string; valueCents: number }[];
  expensesByProjectThisMonth: { project: string; valueCents: number }[];
};

function numberValue(value: Numeric) {
  return Number(value ?? 0);
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfQuarter(date: Date) {
  const quarterMonth = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterMonth, 1));
}

function endOfQuarter(date: Date) {
  const start = startOfQuarter(date);
  return endOfDay(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0)));
}

function financialYearBounds(date: Date) {
  const year = date.getUTCFullYear();
  const startsThisCalendarYear = date.getUTCMonth() >= 6;
  const startYear = startsThisCalendarYear ? year : year - 1;
  const start = new Date(Date.UTC(startYear, 6, 1));
  const end = endOfDay(new Date(Date.UTC(startYear + 1, 5, 30)));
  return { start, end };
}

function daysBetweenInclusive(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1);
}

function eachDay(start: Date, end: Date) {
  return Array.from({ length: daysBetweenInclusive(start, end) }, (_, index) => addDays(start, index));
}

function eachMonth(start: Date, end: Date) {
  const months: Date[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= last) {
    months.push(new Date(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

function weekdayLabel(date: Date, weekday: "short" | "long") {
  return new Intl.DateTimeFormat("en-AU", { weekday, timeZone: "UTC" }).format(date);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-AU", { month: "short", timeZone: "UTC" }).format(date);
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatShortMoney(cents: number) {
  if (Math.abs(cents) >= 100_000) return `$${Math.round(cents / 100_000)}k`;
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(cents / 100);
}

function formatInsightHours(minutes: number) {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

export async function loadInsightsData(ownerId: string): Promise<InsightsData> {
  const today = todayInPerth();
  const todayEnd = endOfDay(today);
  const currentWeek = currentWeekMondayToSunday(today);
  const rolling30Start = addDays(today, -29);
  const monthStart = startOfMonth(today);
  const quarterStart = startOfQuarter(today);
  const quarterEnd = endOfQuarter(today);
  const fy = financialYearBounds(today);

  const [rows, profile] = await Promise.all([
    prisma.$queryRaw<InsightRow[]>`
    WITH bounds AS (
      SELECT
        ${currentWeek.start}::timestamp AS current_start_at,
        ${currentWeek.endInclusive}::timestamp AS current_end_at,
        ${rolling30Start}::timestamp AS rolling_start_at,
        ${monthStart}::timestamp AS month_start_at,
        ${quarterStart}::timestamp AS quarter_start_at,
        ${quarterEnd}::timestamp AS quarter_end_at,
        ${fy.start}::timestamp AS fy_start_at,
        ${fy.end}::timestamp AS fy_end_at,
        ${today}::timestamp AS today_at,
        ${todayEnd}::timestamp AS today_end_at
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
      WHERE t."ownerId" = ${ownerId}
        AND (t."teamMemberId" IS NULL OR t."approvalStatus" = 'APPROVED')
        AND t.date >= b.current_start_at
        AND t.date <= b.current_end_at
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
    rolling_30 AS (
      SELECT
        COALESCE(SUM(COALESCE(t.minutes, 0)), 0) AS total_minutes,
        COALESCE(SUM(COALESCE(t.billable_cents, 0)), 0) AS total_billable_cents,
        COUNT(t.date_key) FILTER (WHERE COALESCE(t.minutes, 0) > 0) AS logged_day_count,
        COUNT(*) AS included_day_count,
        COUNT(d.date_key) AS day_off_count
      FROM rolling_30_time_by_day t
      FULL OUTER JOIN rolling_30_day_offs d ON d.date_key = t.date_key
      WHERE COALESCE(t.minutes, 0) > 0 OR d.date_key IS NOT NULL
    ),
    month_work AS (
      SELECT
        COALESCE(SUM(t."durationMinutes"), 0) AS total_minutes,
        COALESCE(SUM(ROUND((t."durationMinutes"::numeric / 60) * t."hourlyRateCentsSnapshot")), 0) AS billable_value
      FROM "TimeEntry" t
      CROSS JOIN bounds b
      WHERE t."ownerId" = ${ownerId}
        AND (t."teamMemberId" IS NULL OR t."approvalStatus" = 'APPROVED')
        AND t.date >= b.month_start_at
        AND t.date <= b.today_end_at
    ),
    quarter_work AS (
      SELECT COALESCE(SUM(t."durationMinutes"), 0) AS total_minutes
      FROM "TimeEntry" t
      CROSS JOIN bounds b
      WHERE t."ownerId" = ${ownerId}
        AND (t."teamMemberId" IS NULL OR t."approvalStatus" = 'APPROVED')
        AND t.date >= b.quarter_start_at
        AND t.date <= b.today_end_at
    ),
    best_day AS (
      SELECT (
        SELECT jsonb_build_object('date', ranked.date, 'minutes', ranked.minutes)
        FROM (
          SELECT t.date, COALESCE(SUM(t."durationMinutes"), 0) AS minutes
          FROM "TimeEntry" t
          CROSS JOIN bounds b
          WHERE t."ownerId" = ${ownerId}
            AND (t."teamMemberId" IS NULL OR t."approvalStatus" = 'APPROVED')
            AND t.date >= b.month_start_at
            AND t.date <= b.today_end_at
          GROUP BY t.date
          ORDER BY minutes DESC, t.date ASC
          LIMIT 1
        ) ranked
      ) AS data
    ),
    busiest_project AS (
      SELECT (
        SELECT jsonb_build_object('title', ranked.title, 'minutes', ranked.minutes)
        FROM (
          SELECT p.title, COALESCE(SUM(t."durationMinutes"), 0) AS minutes
          FROM "TimeEntry" t
          JOIN "Project" p ON p.id = t."projectId"
          CROSS JOIN bounds b
          WHERE t."ownerId" = ${ownerId}
            AND (t."teamMemberId" IS NULL OR t."approvalStatus" = 'APPROVED')
            AND p."ownerId" = ${ownerId}
            AND t.date >= b.month_start_at
            AND t.date <= b.today_end_at
          GROUP BY p.title
          ORDER BY minutes DESC, p.title ASC
          LIMIT 1
        ) ranked
      ) AS data
    ),
    quarter_daily AS (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object('date', daily.date, 'minutes', daily.minutes, 'projects', daily.projects)
          ORDER BY daily.date ASC
        ),
        '[]'::jsonb
      ) AS data
      FROM (
        SELECT
          t.date,
          COALESCE(SUM(t."durationMinutes"), 0) AS minutes,
          to_jsonb(ARRAY_AGG(DISTINCT p.title ORDER BY p.title)) AS projects
        FROM "TimeEntry" t
        JOIN "Project" p ON p.id = t."projectId"
        CROSS JOIN bounds b
        WHERE t."ownerId" = ${ownerId}
          AND (t."teamMemberId" IS NULL OR t."approvalStatus" = 'APPROVED')
          AND p."ownerId" = ${ownerId}
          AND t.date >= b.quarter_start_at
          AND t.date <= b.today_end_at
        GROUP BY t.date
      ) daily
    ),
    revenue_summary AS (
      SELECT
        COUNT(*) FILTER (WHERE i.status = 'PAID' AND i."paymentDate" >= b.month_start_at AND i."paymentDate" <= b.today_end_at) AS paid_this_month_count,
        COALESCE(SUM(i."grandTotalCents") FILTER (WHERE i.status = 'PAID' AND i."paymentDate" >= b.month_start_at AND i."paymentDate" <= b.today_end_at), 0) AS paid_this_month,
        COALESCE(SUM(i."grandTotalCents") FILTER (WHERE i.status = 'PAID' AND i."paymentDate" >= b.fy_start_at AND i."paymentDate" <= b.today_end_at), 0) AS paid_financial_year,
        COUNT(*) FILTER (WHERE i.status = 'SENT') AS outstanding_count,
        COALESCE(SUM(i."grandTotalCents") FILTER (WHERE i.status = 'SENT'), 0) AS outstanding_total,
        COUNT(*) FILTER (
          WHERE i.status = 'SENT'
            AND COALESCE(i."dueDate", i."invoiceDate" + (i."paymentTermsDays" * INTERVAL '1 day')) < b.today_at
        ) AS overdue_count,
        COALESCE(SUM(i."grandTotalCents") FILTER (
          WHERE i.status = 'SENT'
            AND COALESCE(i."dueDate", i."invoiceDate" + (i."paymentTermsDays" * INTERVAL '1 day')) < b.today_at
        ), 0) AS overdue_total
      FROM "Invoice" i
      CROSS JOIN bounds b
      WHERE i."ownerId" = ${ownerId}
    ),
    team_financial_year AS (
      SELECT
        COALESCE((
          SELECT SUM(line."totalAmountCents")
          FROM "InvoiceLineItem" line
          JOIN "Invoice" invoice ON invoice.id = line."invoiceId"
          CROSS JOIN bounds b
          WHERE line."ownerId" = ${ownerId}
            AND line."teamMemberId" IS NOT NULL
            AND invoice."ownerId" = ${ownerId}
            AND invoice.status IN ('SENT', 'PAID')
            AND invoice."invoiceDate" >= b.fy_start_at
            AND invoice."invoiceDate" <= b.today_end_at
        ), 0) AS employee_earnings,
        COALESCE((
          SELECT SUM(payment."amountCents")
          FROM "WagePayment" payment
          CROSS JOIN bounds b
          WHERE payment."ownerId" = ${ownerId}
            AND payment.status = 'PAID'
            AND payment."paidAt" >= b.fy_start_at
            AND payment."paidAt" <= b.today_end_at
        ), 0) AS paid_to_employees
    ),
    unbilled_time AS (
      SELECT
        COUNT(*) AS entry_count,
        COALESCE(SUM(ROUND((t."durationMinutes"::numeric / 60) * t."hourlyRateCentsSnapshot")), 0) AS entry_total
      FROM "TimeEntry" t
      JOIN "Project" p ON p.id = t."projectId"
      WHERE t."ownerId" = ${ownerId}
        AND (t."teamMemberId" IS NULL OR t."approvalStatus" = 'APPROVED')
        AND p."ownerId" = ${ownerId}
        AND p.status = 'ACTIVE'
        AND t."billingStatus" = 'UNBILLED'
    ),
    unbilled_items AS (
      SELECT
        COUNT(*) AS item_count,
        COALESCE(SUM(e."totalCostCents"), 0) AS item_total
      FROM "ExpenseItem" e
      JOIN "Project" p ON p.id = e."projectId"
      WHERE e."ownerId" = ${ownerId}
        AND p."ownerId" = ${ownerId}
        AND p.status = 'ACTIVE'
        AND e."billingStatus" = 'UNBILLED'
    ),
    top_unbilled AS (
      SELECT (
        SELECT jsonb_build_object('title', ranked.title, 'valueCents', ranked.value_cents)
        FROM (
          SELECT
            p.title,
            COALESCE(time_values.value_cents, 0) + COALESCE(item_values.value_cents, 0) AS value_cents
          FROM "Project" p
          LEFT JOIN (
            SELECT "projectId", COALESCE(SUM(ROUND(("durationMinutes"::numeric / 60) * "hourlyRateCentsSnapshot")), 0) AS value_cents
            FROM "TimeEntry"
            WHERE "ownerId" = ${ownerId}
              AND "billingStatus" = 'UNBILLED'
              AND ("teamMemberId" IS NULL OR "approvalStatus" = 'APPROVED')
            GROUP BY "projectId"
          ) time_values ON time_values."projectId" = p.id
          LEFT JOIN (
            SELECT "projectId", COALESCE(SUM("totalCostCents"), 0) AS value_cents
            FROM "ExpenseItem"
            WHERE "ownerId" = ${ownerId} AND "billingStatus" = 'UNBILLED'
            GROUP BY "projectId"
          ) item_values ON item_values."projectId" = p.id
          WHERE p."ownerId" = ${ownerId}
            AND p.status = 'ACTIVE'
            AND COALESCE(time_values.value_cents, 0) + COALESCE(item_values.value_cents, 0) > 0
          ORDER BY value_cents DESC, p.title ASC
          LIMIT 1
        ) ranked
      ) AS data
    ),
    fy_paid_monthly AS (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object('month', paid.month_key, 'valueCents', paid.value_cents)
          ORDER BY paid.month_key ASC
        ),
        '[]'::jsonb
      ) AS data
      FROM (
        SELECT
          to_char(date_trunc('month', i."paymentDate"), 'YYYY-MM') AS month_key,
          COALESCE(SUM(i."grandTotalCents"), 0) AS value_cents
        FROM "Invoice" i
        CROSS JOIN bounds b
        WHERE i."ownerId" = ${ownerId}
          AND i.status = 'PAID'
          AND i."paymentDate" >= b.fy_start_at
          AND i."paymentDate" <= b.today_end_at
        GROUP BY month_key
      ) paid
    ),
    expense_summary AS (
      SELECT
        COALESCE(SUM(w."amountCents") FILTER (WHERE w.date >= b.month_start_at AND w.date <= b.today_end_at), 0) AS this_month_total,
        COALESCE(SUM(w."amountCents") FILTER (WHERE w.date >= b.fy_start_at AND w.date <= b.today_end_at), 0) AS fy_total,
        COALESCE(SUM(w."amountCents") FILTER (WHERE w."projectId" IS NULL AND w.date >= b.fy_start_at AND w.date <= b.today_end_at), 0) AS general_fy_total
      FROM "WorkExpense" w
      CROSS JOIN bounds b
      WHERE w."ownerId" = ${ownerId}
        AND w."archivedAt" IS NULL
    ),
    largest_expense_category AS (
      SELECT (
        SELECT jsonb_build_object('category', ranked.category, 'valueCents', ranked.value_cents)
        FROM (
          SELECT w.category::text AS category, COALESCE(SUM(w."amountCents"), 0) AS value_cents
          FROM "WorkExpense" w
          CROSS JOIN bounds b
          WHERE w."ownerId" = ${ownerId}
            AND w."archivedAt" IS NULL
            AND w.date >= b.month_start_at
            AND w.date <= b.today_end_at
          GROUP BY w.category
          ORDER BY value_cents DESC, category ASC
          LIMIT 1
        ) ranked
      ) AS data
    ),
    expenses_by_category AS (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('category', grouped.category, 'valueCents', grouped.value_cents) ORDER BY grouped.value_cents DESC),
        '[]'::jsonb
      ) AS data
      FROM (
        SELECT w.category::text AS category, COALESCE(SUM(w."amountCents"), 0) AS value_cents
        FROM "WorkExpense" w
        CROSS JOIN bounds b
        WHERE w."ownerId" = ${ownerId}
          AND w."archivedAt" IS NULL
          AND w.date >= b.month_start_at
          AND w.date <= b.today_end_at
        GROUP BY w.category
      ) grouped
    ),
    expenses_by_project AS (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('project', grouped.project, 'valueCents', grouped.value_cents) ORDER BY grouped.value_cents DESC),
        '[]'::jsonb
      ) AS data
      FROM (
        SELECT COALESCE(p.title, 'General expenses') AS project, COALESCE(SUM(w."amountCents"), 0) AS value_cents
        FROM "WorkExpense" w
        LEFT JOIN "Project" p ON p.id = w."projectId" AND p."ownerId" = ${ownerId}
        CROSS JOIN bounds b
        WHERE w."ownerId" = ${ownerId}
          AND w."archivedAt" IS NULL
          AND w.date >= b.month_start_at
          AND w.date <= b.today_end_at
        GROUP BY COALESCE(p.title, 'General expenses')
      ) grouped
    )
    SELECT
      current_week_entries.data AS "currentWeekEntries",
      current_week_entries.entry_count AS "currentWeekEntryCount",
      current_week_entries.total_minutes AS "totalCurrentWeekMinutes",
      current_week_entries.billable_value AS "totalCurrentWeekBillableCents",
      rolling_30.total_minutes AS "rolling30TotalMinutes",
      rolling_30.total_billable_cents AS "rolling30BillableCents",
      rolling_30.logged_day_count AS "rolling30LoggedDayCount",
      rolling_30.included_day_count AS "rolling30IncludedDayCount",
      rolling_30.day_off_count AS "rolling30DayOffCount",
      month_work.total_minutes AS "hoursThisMonthMinutes",
      quarter_work.total_minutes AS "hoursThisQuarterMinutes",
      month_work.billable_value AS "billableThisMonthCents",
      revenue_summary.paid_this_month AS "paidThisMonthCents",
      revenue_summary.paid_this_month_count AS "paidThisMonthCount",
      revenue_summary.paid_financial_year AS "paidFinancialYearCents",
      team_financial_year.employee_earnings AS "employeeEarningsFinancialYearCents",
      team_financial_year.paid_to_employees AS "paidToEmployeesFinancialYearCents",
      revenue_summary.outstanding_total AS "outstandingCents",
      revenue_summary.outstanding_count AS "outstandingCount",
      revenue_summary.overdue_total AS "overdueCents",
      revenue_summary.overdue_count AS "overdueCount",
      unbilled_time.entry_count AS "unbilledTimeEntryCount",
      unbilled_items.item_count AS "unbilledExpenseItemCount",
      (unbilled_time.entry_total + unbilled_items.item_total) AS "unbilledCents",
      best_day.data AS "bestDayThisMonth",
      busiest_project.data AS "busiestProjectThisMonth",
      top_unbilled.data AS "topUnbilledProject",
      quarter_daily.data AS "quarterDaily",
      fy_paid_monthly.data AS "fyPaidMonthly",
      expense_summary.this_month_total AS "expenseThisMonthCents",
      expense_summary.fy_total AS "expenseFyCents",
      expense_summary.general_fy_total AS "generalExpenseFyCents",
      largest_expense_category.data AS "largestExpenseCategoryThisMonth",
      expenses_by_category.data AS "expensesByCategoryThisMonth",
      expenses_by_project.data AS "expensesByProjectThisMonth"
    FROM current_week_entries, rolling_30, month_work, quarter_work, revenue_summary, team_financial_year, unbilled_time, unbilled_items, best_day, busiest_project, top_unbilled, quarter_daily, fy_paid_monthly, expense_summary, largest_expense_category, expenses_by_category, expenses_by_project
  `,
    prisma.businessProfile.findUnique({
      where: { ownerId },
      select: {
        gstRegistered: true,
        gstRate: true,
        taxSetAsideEnabled: true,
        customTaxPercentageOverride: true,
        includeGstInTaxEstimate: true,
        includeSuperInSetAsidePlanning: true,
        superPlanningEnabled: true,
        superContributionPercentage: true
      }
    })
  ]);

  const row = rows[0];
  const currentWeekEntries = row?.currentWeekEntries ?? [];
  const entriesByDay = new Map<string, NonNullable<InsightRow["currentWeekEntries"]>>();

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
    const projects = Array.from(new Set(dayEntries.map((entry) => entry.project.title)));

    return {
      date: key,
      dayName: weekdayLabel(day, "long"),
      dayShort: weekdayLabel(day, "short"),
      dateLabel: `${day.getUTCDate()}/${day.getUTCMonth() + 1}`,
      isToday: key === todayKey,
      totalMinutes: dayEntries.reduce((sum, entry) => sum + numberValue(entry.durationMinutes), 0),
      billableValueCents: dayEntries.reduce((sum, entry) => sum + Math.round((numberValue(entry.durationMinutes) * numberValue(entry.hourlyRateCentsSnapshot)) / 60), 0),
      entryCount: dayEntries.length,
      projects
    };
  });

  const elapsedDays = Math.max(1, Math.min(7, Math.floor((today.getTime() - currentWeek.start.getTime()) / DAY_MS) + 1));
  const rolling30LoggedDayCount = numberValue(row?.rolling30LoggedDayCount);
  const rolling30IncludedDayCount = numberValue(row?.rolling30IncludedDayCount);
  const rolling30DayOffCount = numberValue(row?.rolling30DayOffCount);
  const rolling30AverageDailyMinutes = rolling30IncludedDayCount ? numberValue(row?.rolling30TotalMinutes) / rolling30IncludedDayCount : 0;
  const rolling30AverageWeeklyBillableCents = rolling30IncludedDayCount
    ? Math.round((numberValue(row?.rolling30BillableCents) / rolling30IncludedDayCount) * 7)
    : 0;
  const currentWeekAverageDailyMinutes = numberValue(row?.totalCurrentWeekMinutes) / elapsedDays;
  const monthMinutes = numberValue(row?.hoursThisMonthMinutes);
  const billableThisMonthCents = numberValue(row?.billableThisMonthCents);
  const averageHourlyRateCents = monthMinutes > 0 ? Math.round(billableThisMonthCents / (monthMinutes / 60)) : null;

  const quarterDailyMap = new Map(
    (row?.quarterDaily ?? []).map((point) => [
      dateInputValue(point.date),
      {
        minutes: numberValue(point.minutes),
        projects: Array.isArray(point.projects) ? point.projects : []
      }
    ])
  );
  const quarterTrend = eachDay(quarterStart, today).map((day, index, days) => {
    const key = dateInputValue(day);
    const windowStart = Math.max(0, index - 6);
    const windowDays = days.slice(windowStart, index + 1);
    const rollingAverageMinutes = windowDays.reduce((sum, windowDay) => sum + (quarterDailyMap.get(dateInputValue(windowDay))?.minutes ?? 0), 0) / windowDays.length;

    return {
      date: key,
      label: `${day.getUTCDate()}/${day.getUTCMonth() + 1}`,
      minutes: quarterDailyMap.get(key)?.minutes ?? 0,
      rollingAverageMinutes,
      projects: quarterDailyMap.get(key)?.projects ?? []
    };
  });

  const fyPaidMap = new Map((row?.fyPaidMonthly ?? []).map((point) => [point.month, numberValue(point.valueCents)]));
  let cumulativePaidCents = 0;
  const fyMonths = eachMonth(fy.start, today);
  const fyPoints = fyMonths.map((month) => {
    const key = monthKey(month);
    const paidCents = fyPaidMap.get(key) ?? 0;
    cumulativePaidCents += paidCents;

    return {
      month: key,
      label: monthLabel(month),
      paidCents,
      cumulativePaidCents
    };
  });

  const revenue = {
    billableThisWeekCents: numberValue(row?.totalCurrentWeekBillableCents),
    billableThisMonthCents,
    paidThisMonthCents: numberValue(row?.paidThisMonthCents),
    paidThisMonthCount: numberValue(row?.paidThisMonthCount),
    outstandingCents: numberValue(row?.outstandingCents),
    outstandingCount: numberValue(row?.outstandingCount),
    overdueCents: numberValue(row?.overdueCents),
    overdueCount: numberValue(row?.overdueCount),
    unbilledCents: numberValue(row?.unbilledCents),
    unbilledTimeEntryCount: numberValue(row?.unbilledTimeEntryCount),
    unbilledExpenseItemCount: numberValue(row?.unbilledExpenseItemCount),
    averageHourlyRateCents
  };
  const expenses = {
    thisMonthCents: numberValue(row?.expenseThisMonthCents),
    financialYearCents: numberValue(row?.expenseFyCents),
    generalFinancialYearCents: numberValue(row?.generalExpenseFyCents),
    largestCategoryThisMonth: row?.largestExpenseCategoryThisMonth
      ? {
          category: row.largestExpenseCategoryThisMonth.category,
          valueCents: numberValue(row.largestExpenseCategoryThisMonth.valueCents)
        }
      : null,
    byCategoryThisMonth: (row?.expensesByCategoryThisMonth ?? []).map((item) => ({
      category: item.category,
      label: expenseCategoryLabel(item.category),
      valueCents: numberValue(item.valueCents)
    })),
    byProjectThisMonth: (row?.expensesByProjectThisMonth ?? []).map((item) => ({
      project: item.project,
      valueCents: numberValue(item.valueCents)
    }))
  };
  const taxSetAside = calculateSetAsidePlanning(revenue.billableThisWeekCents, profile, today, rolling30AverageWeeklyBillableCents);

  const topUnbilledProject = row?.topUnbilledProject
    ? { title: row.topUnbilledProject.title, valueCents: numberValue(row.topUnbilledProject.valueCents) }
    : null;

  const deltaMinutes = currentWeekAverageDailyMinutes - rolling30AverageDailyMinutes;
  const strongestPaidMonth = fyPoints.reduce<FinancialYearPoint | null>((best, point) => (!best || point.paidCents > best.paidCents ? point : best), null);
  const insightCards: InsightCard[] = [
    revenue.unbilledCents > 0
      ? {
          title: "Ready to invoice",
          value: formatShortMoney(revenue.unbilledCents),
          body: `${revenue.unbilledTimeEntryCount} time entr${revenue.unbilledTimeEntryCount === 1 ? "y" : "ies"} and ${revenue.unbilledExpenseItemCount} expense item${revenue.unbilledExpenseItemCount === 1 ? "" : "s"} are unbilled.`,
          tone: "mint"
        }
      : {
          title: "Ready to invoice",
          value: "$0",
          body: "No active unbilled work is waiting right now.",
          tone: "ink"
        },
    {
      title: "Weekly pace",
      value: `${deltaMinutes >= 0 ? "+" : "-"}${formatInsightHours(Math.abs(deltaMinutes))}/day`,
      body: `This week is tracking ${deltaMinutes >= 0 ? "above" : "below"} your included-day 30-day average.`,
      tone: deltaMinutes >= 0 ? "mint" : "yolk"
    },
    expenses.largestCategoryThisMonth
      ? {
          title: "Largest expense category",
          value: formatShortMoney(expenses.largestCategoryThisMonth.valueCents),
          body: `${expenseCategoryLabel(expenses.largestCategoryThisMonth.category)} is your largest category this month.`,
          tone: "ink"
        }
      : {
          title: "Largest expense category",
          value: "$0",
          body: "No work expenses logged this month.",
          tone: "ink"
        },
    {
      title: "Tax set-aside",
      value: formatShortMoney(taxSetAside.suggestedTaxWeeklyCents),
      body: taxSetAside.taxEnabled
        ? `Estimate only for this week, using ${taxSetAside.customTaxRate ? "your custom rate" : `${taxSetAside.financialYear} resident brackets`}.`
        : "Tax set-aside is switched off in Settings.",
      tone: taxSetAside.taxEnabled ? "mint" : "ink"
    },
    {
      title: "Super planning",
      value: formatShortMoney(taxSetAside.suggestedSuperWeeklyCents),
      body: taxSetAside.superEnabled ? `Optional ${taxSetAside.superRate}% planning estimate for this week.` : "Super planning is switched off in Settings.",
      tone: taxSetAside.superEnabled ? "mint" : "ink"
    },
    topUnbilledProject
      ? {
          title: "Largest unbilled project",
          value: formatShortMoney(topUnbilledProject.valueCents),
          body: `${topUnbilledProject.title} has the largest active unbilled balance.`,
          tone: "mint"
        }
      : {
          title: "Largest unbilled project",
          value: "None",
          body: "No active project has unbilled value at the moment.",
          tone: "ink"
        },
    revenue.overdueCount
      ? {
          title: "Overdue invoices",
          value: formatShortMoney(revenue.overdueCents),
          body: `${revenue.overdueCount} invoice${revenue.overdueCount === 1 ? " is" : "s are"} overdue.`,
          tone: "gum"
        }
      : {
          title: "Overdue invoices",
          value: "None",
          body: "No overdue invoices right now.",
          tone: "mint"
        },
    {
      title: "Paid this month",
      value: formatShortMoney(revenue.paidThisMonthCents),
      body: `${revenue.paidThisMonthCount} paid invoice${revenue.paidThisMonthCount === 1 ? "" : "s"} based on your logged data.`,
      tone: "ink"
    },
    strongestPaidMonth && strongestPaidMonth.paidCents > 0
      ? {
          title: "Strongest FY month",
          value: formatShortMoney(strongestPaidMonth.paidCents),
          body: `${strongestPaidMonth.label} has the highest paid income this financial year.`,
          tone: "mint"
        }
      : {
          title: "Strongest FY month",
          value: "None",
          body: "No paid invoice income has been recorded this financial year.",
          tone: "ink"
    }
  ];

  return {
    currentWeek: {
      start: dateInputValue(currentWeek.start),
      end: dateInputValue(currentWeek.end),
      days: currentWeekDays,
      totalMinutes: numberValue(row?.totalCurrentWeekMinutes),
      billableValueCents: numberValue(row?.totalCurrentWeekBillableCents),
      entryCount: numberValue(row?.currentWeekEntryCount),
      elapsedDays,
      averageDailyMinutes: currentWeekAverageDailyMinutes,
      rolling30AverageDailyMinutes,
      averageDeltaMinutes: deltaMinutes
    },
    rolling30: {
      totalMinutes: numberValue(row?.rolling30TotalMinutes),
      loggedDayCount: rolling30LoggedDayCount,
      includedDayCount: rolling30IncludedDayCount,
      dayOffCount: rolling30DayOffCount,
      averageDailyMinutes: rolling30AverageDailyMinutes,
      loggedDayAverageMinutes: rolling30LoggedDayCount ? numberValue(row?.rolling30TotalMinutes) / rolling30LoggedDayCount : 0,
      averageWeeklyBillableCents: rolling30AverageWeeklyBillableCents
    },
    workload: {
      hoursThisMonthMinutes: monthMinutes,
      hoursThisQuarterMinutes: numberValue(row?.hoursThisQuarterMinutes),
      bestDayThisMonth: row?.bestDayThisMonth ? { date: dateInputValue(row.bestDayThisMonth.date), minutes: numberValue(row.bestDayThisMonth.minutes) } : null,
      busiestProjectThisMonth: row?.busiestProjectThisMonth
        ? { title: row.busiestProjectThisMonth.title, minutes: numberValue(row.busiestProjectThisMonth.minutes) }
        : null
    },
    revenue,
    expenses,
    taxSetAside,
    topUnbilledProject,
    quarterTrend,
    financialYear: {
      start: dateInputValue(fy.start),
      end: dateInputValue(fy.end),
      points: fyPoints,
      paidToMeCents: numberValue(row?.paidFinancialYearCents),
      employeeEarningsCents: numberValue(row?.employeeEarningsFinancialYearCents),
      paidToEmployeesCents: numberValue(row?.paidToEmployeesFinancialYearCents)
    },
    insightCards
  };
}

export const getInsightsData = unstable_cache(loadInsightsData, ["insights-data"], {
  revalidate: SHORT_REVALIDATE_SECONDS,
  tags: [CACHE_TAGS.insights]
});

export async function getCurrentWeekPerformance(ownerId: string) {
  return (await getInsightsData(ownerId)).currentWeek;
}

export async function getRolling30DayStats(ownerId: string) {
  return (await getInsightsData(ownerId)).rolling30;
}

export async function getQuarterWorkloadTrend(ownerId: string) {
  return (await getInsightsData(ownerId)).quarterTrend;
}

export async function getFinancialYearCumulativeRevenue(ownerId: string) {
  return (await getInsightsData(ownerId)).financialYear;
}

export async function getInsightCards(ownerId: string) {
  return (await getInsightsData(ownerId)).insightCards;
}
