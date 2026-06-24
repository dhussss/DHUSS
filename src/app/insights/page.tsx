import Link from "next/link";
import { ArrowLeft, Banknote, BarChart3, Clock3, FileClock, ReceiptText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FinancialYearChart, InsightCards, QuarterTrendChart } from "@/components/AnalyticsCharts";
import { requireUserId } from "@/lib/auth";
import { formatDateAU } from "@/lib/dates";
import { getInsightsData } from "@/lib/insights";
import { formatMoney } from "@/lib/money";
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

      <section className="overflow-hidden rounded-lg border border-ink/10 bg-ink text-white shadow-soft">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(15,159,143,0.42),transparent_34rem),linear-gradient(135deg,rgba(255,255,255,0.12),transparent_38%)] p-5 sm:p-6 lg:p-7">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-black uppercase text-mint">
                <BarChart3 size={17} aria-hidden="true" />
                Insights
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-normal sm:text-5xl">Business tracking</h1>
              <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-white/75">
                Clear workload, invoice, and financial-year signals based on your logged data.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:w-[27rem]">
              <HeroMetric label="Week hours" value={`${formatHours(insights.currentWeek.totalMinutes)}h`} />
              <HeroMetric label="Unbilled" value={formatMoney(insights.revenue.unbilledCents)} />
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
          <InsightStat label="30-day daily average" value={`${formatHours(insights.rolling30.averageDailyMinutes, "minutes")}h/day`} />
          <InsightStat label="Current week daily average" value={`${formatHours(insights.currentWeek.averageDailyMinutes, "minutes")}h/day`} />
          <InsightStat
            label="Difference vs 30-day average"
            value={`${insights.currentWeek.averageDeltaMinutes >= 0 ? "+" : "-"}${formatHours(Math.abs(insights.currentWeek.averageDeltaMinutes), "minutes")}h/day`}
          />
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

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <QuarterTrendChart points={insights.quarterTrend} />
        <FinancialYearChart points={insights.financialYear.points} start={insights.financialYear.start} end={insights.financialYear.end} />
      </section>

      <section className="mt-5 rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-title">Plain-English read</p>
            <h2 className="mt-1 text-2xl font-black tracking-normal text-ink">Useful signals, not noise</h2>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-moss">
              Rolling averages use calendar days, including quiet days, so the workload view reflects business pace rather than only days where hours were logged.
            </p>
          </div>
          <Link href="/hours-export" className="tap-secondary">
            <FileClock size={18} aria-hidden="true" />
            Hours Export
          </Link>
        </div>
      </section>
    </main>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 p-4 shadow-soft">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-white/60">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-normal text-white">{value}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white shadow-soft">
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
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-paper/60 p-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-bold text-moss">{label}</span>
      <span className="font-black text-ink">{value}</span>
    </div>
  );
}
