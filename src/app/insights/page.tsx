import Link from "next/link";
import { ArrowLeft, Banknote, BarChart3, Calculator, Clock3, ReceiptText, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FinancialYearChart, InsightCards, QuarterTrendChart } from "@/components/AnalyticsCharts";
import { requireUserId } from "@/lib/auth";
import { formatDateAU } from "@/lib/dates";
import { getInsightsData } from "@/lib/insights";
import { formatMoney } from "@/lib/money";
import { formatPercent } from "@/lib/planning";
import { formatHours } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const ownerId = await requireUserId();
  const insights = await getInsightsData(ownerId);
  const averageRate = insights.revenue.averageHourlyRateCents;

  return (
    <main className="page-shell max-w-[92rem]">
      <div className="mb-4">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-mint">
          <ArrowLeft size={18} aria-hidden="true" />
          Dashboard
        </Link>
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-white shadow-soft">
        <div className="command-hero-bg p-5 sm:p-6 lg:p-7">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-bold text-mint">
                <BarChart3 size={17} aria-hidden="true" />
                Insights
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-normal sm:text-5xl">Business tracking</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-moss">
                Clear workload, invoice, and financial-year signals based on your logged data.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:w-[27rem]">
              <HeroMetric label="Week hours" value={`${formatHours(insights.currentWeek.totalMinutes)}h`} />
              <HeroMetric label="Set aside" value={formatMoney(insights.taxSetAside.combinedWeeklyCents)} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <InsightCards cards={insights.insightCards} />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        <Panel title="Workload insights" icon={Clock3}>
          <InsightStat label="Current week total" value={`${formatHours(insights.currentWeek.totalMinutes)}h`} />
          <InsightStat label="30-day included-day average" value={`${formatHours(insights.rolling30.averageDailyMinutes, "minutes")}h/day`} />
          <InsightStat label="Current week daily average" value={`${formatHours(insights.currentWeek.averageDailyMinutes, "minutes")}h/day`} />
          <InsightStat
            label="Difference vs 30-day average"
            value={`${insights.currentWeek.averageDeltaMinutes >= 0 ? "+" : "-"}${formatHours(Math.abs(insights.currentWeek.averageDeltaMinutes), "minutes")}h/day`}
          />
          <InsightStat label="Included days in average" value={`${insights.rolling30.includedDayCount} days (${insights.rolling30.dayOffCount} day off)`} />
          <InsightStat label="Best day this month" value={insights.workload.bestDayThisMonth ? `${formatDateAU(insights.workload.bestDayThisMonth.date)} - ${formatHours(insights.workload.bestDayThisMonth.minutes)}h` : "No hours yet"} />
          <InsightStat label="Busiest project this month" value={insights.workload.busiestProjectThisMonth ? `${insights.workload.busiestProjectThisMonth.title} - ${formatHours(insights.workload.busiestProjectThisMonth.minutes)}h` : "No project hours yet"} />
          <InsightStat label="Hours this month" value={`${formatHours(insights.workload.hoursThisMonthMinutes)}h`} />
          <InsightStat label="Hours this quarter" value={`${formatHours(insights.workload.hoursThisQuarterMinutes)}h`} />
        </Panel>

        <Panel title="Revenue insights" icon={Banknote}>
          <InsightStat label="Billable value this week" value={formatMoney(insights.revenue.billableThisWeekCents)} />
          <InsightStat label="Billable value this month" value={formatMoney(insights.revenue.billableThisMonthCents)} />
          <InsightStat label="Paid this month" value={`${formatMoney(insights.revenue.paidThisMonthCents)} (${insights.revenue.paidThisMonthCount})`} />
          <InsightStat label="Outstanding invoices" value={`${formatMoney(insights.revenue.outstandingCents)} (${insights.revenue.outstandingCount})`} />
          <InsightStat label="Unbilled work" value={`${formatMoney(insights.revenue.unbilledCents)} (${insights.revenue.unbilledTimeEntryCount} time, ${insights.revenue.unbilledExpenseItemCount} expenses)`} />
          <InsightStat label="Overdue invoices" value={`${formatMoney(insights.revenue.overdueCents)} (${insights.revenue.overdueCount})`} />
          <InsightStat label="Average hourly rate realised" value={averageRate ? `${formatMoney(averageRate)}/h` : "Not enough data"} />
          <Link href="/invoices/new" className="tap-primary mt-2">
            <ReceiptText size={18} aria-hidden="true" />
            Invoice Unbilled Work
          </Link>
        </Panel>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Tax to set aside this week" icon={Calculator}>
          <InsightStat label="Current week earnings" value={formatMoney(insights.taxSetAside.currentWeekEarningsCents)} />
          <InsightStat label="Annualised income estimate" value={formatMoney(insights.taxSetAside.estimatedAnnualIncomeCents)} />
          <InsightStat label="Effective tax rate estimate" value={formatPercent(insights.taxSetAside.estimatedEffectiveTaxRate)} />
          <InsightStat label="Suggested tax this week" value={formatMoney(insights.taxSetAside.suggestedTaxWeeklyCents)} />
          <InsightStat label="Suggested tax this month" value={formatMoney(insights.taxSetAside.suggestedTaxMonthlyCents)} />
          {insights.taxSetAside.includeGstInTaxEstimate ? <InsightStat label="GST set-aside this week" value={formatMoney(insights.taxSetAside.suggestedGstWeeklyCents)} /> : null}
          {insights.taxSetAside.superEnabled ? <InsightStat label="Super estimate this week" value={formatMoney(insights.taxSetAside.suggestedSuperWeeklyCents)} /> : null}
          <InsightStat label="Combined set-aside this week" value={formatMoney(insights.taxSetAside.combinedWeeklyCents)} />
          <p className="rounded-lg border border-line bg-paper p-3 text-xs font-bold leading-5 text-moss">
            Estimate only, not tax advice. Uses your current week billable value annualised across the {insights.taxSetAside.financialYear} Australian resident brackets unless a custom percentage is set.
          </p>
        </Panel>

        <Panel title="Expense insights" icon={ShieldCheck}>
          <InsightStat label="Work expenses this month" value={formatMoney(insights.expenses.thisMonthCents)} />
          <InsightStat label="Work expenses this financial year" value={formatMoney(insights.expenses.financialYearCents)} />
          <InsightStat label="General expenses this FY" value={formatMoney(insights.expenses.generalFinancialYearCents)} />
          <InsightStat
            label="Largest category this month"
            value={insights.expenses.largestCategoryThisMonth ? `${insights.expenses.byCategoryThisMonth[0]?.label ?? insights.expenses.largestCategoryThisMonth.category} - ${formatMoney(insights.expenses.largestCategoryThisMonth.valueCents)}` : "No expenses yet"}
          />
          <div className="grid gap-2">
            {insights.expenses.byCategoryThisMonth.slice(0, 4).map((item) => (
              <InsightStat key={item.category} label={item.label} value={formatMoney(item.valueCents)} />
            ))}
          </div>
          <Link href="/expenses" className="tap-secondary mt-2">
            <ReceiptText size={18} aria-hidden="true" />
            Open Expenses
          </Link>
        </Panel>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <QuarterTrendChart points={insights.quarterTrend} />
        <FinancialYearChart points={insights.financialYear.points} start={insights.financialYear.start} end={insights.financialYear.end} />
      </section>
    </main>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-line bg-paper/55 p-4">
      <p className="text-xs font-bold text-moss">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-normal text-ink">{value}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white shadow-soft">
      <div className="flex items-center gap-3 border-b border-line p-4">
        <span className="icon-tile">
          <Icon size={20} aria-hidden="true" />
        </span>
        <h2 className="text-2xl font-black tracking-normal">{title}</h2>
      </div>
      <div className="grid gap-2 p-4">{children}</div>
    </section>
  );
}

function InsightStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-line bg-paper/55 p-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-bold text-moss">{label}</span>
      <span className="font-black text-ink">{value}</span>
    </div>
  );
}
