import Link from "next/link";
import { ArrowLeft, Banknote, BarChart3, Calculator, Clock3, PiggyBank, ReceiptText, ShieldCheck, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FinancialYearChart, InsightCards, QuarterTrendChart } from "@/components/AnalyticsCharts";
import { requireUserId } from "@/lib/auth";
import { endOfDay, formatDateAU, todayInPerth } from "@/lib/dates";
import { getInsightsData } from "@/lib/insights";
import { formatMoney } from "@/lib/money";
import { formatPercent } from "@/lib/planning";
import { formatHours, labourTotalCents } from "@/lib/time";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const ownerId = await requireUserId();
  const today = todayInPerth();
  const fyStart = new Date(Date.UTC(today.getUTCMonth() >= 6 ? today.getUTCFullYear() : today.getUTCFullYear() - 1, 6, 1));
  const todayEnd = endOfDay(today);
  const [insights, paidInvoices, billedEmployeeEntries, paidEmployeeEntries] = await Promise.all([
    getInsightsData(ownerId),
    prisma.invoice.aggregate({ where: { ownerId, status: "PAID", paymentDate: { gte: fyStart, lte: todayEnd } }, _sum: { grandTotalCents: true } }),
    prisma.timeEntry.findMany({ where: { ownerId, teamMemberId: { not: null }, billingStatus: "BILLED", invoice: { status: { in: ["SENT", "PAID"] }, invoiceDate: { gte: fyStart, lte: todayEnd } } }, select: { durationMinutes: true, hourlyRateCentsSnapshot: true } }),
    prisma.timeEntry.findMany({ where: { ownerId, teamMemberId: { not: null }, paymentStatus: "PAID", paidAt: { gte: fyStart, lte: todayEnd } }, select: { durationMinutes: true, payRateCentsSnapshot: true } })
  ]);
  const ytdPaidToMeCents = paidInvoices._sum.grandTotalCents || 0;
  const ytdEmployeeEarningsCents = billedEmployeeEntries.reduce((sum, entry) => sum + labourTotalCents(entry.durationMinutes, entry.hourlyRateCentsSnapshot), 0);
  const ytdPaidToEmployeesCents = paidEmployeeEntries.reduce((sum, entry) => sum + labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0), 0);
  const averageRate = insights.revenue.averageHourlyRateCents;
  const setAside = insights.taxSetAside;

  const takeHomeWeeklyCents = Math.max(0, insights.currentWeek.billableValueCents - setAside.combinedWeeklyCents);
  const setAsideSegments = [
    setAside.taxEnabled ? { label: "Income tax", cents: setAside.suggestedTaxWeeklyCents, color: "bg-gum" } : null,
    setAside.includeGstInTaxEstimate ? { label: "GST", cents: setAside.suggestedGstWeeklyCents, color: "bg-yolk" } : null,
    setAside.superEnabled && setAside.includeSuperInSetAsidePlanning ? { label: "Super", cents: setAside.suggestedSuperWeeklyCents, color: "bg-mint" } : null,
    { label: "Take-home", cents: takeHomeWeeklyCents, color: "bg-ink" }
  ].filter((segment): segment is { label: string; cents: number; color: string } => Boolean(segment));

  const maxExpenseCategoryCents = Math.max(1, ...insights.expenses.byCategoryThisMonth.map((item) => item.valueCents));

  return (
    <main className="page-shell max-w-[92rem]">
      <div className="mb-4">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-mint">
          <ArrowLeft size={18} aria-hidden="true" />
          Dashboard
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
        <div className="command-hero-bg relative overflow-hidden p-5 sm:p-6 lg:p-7">
          <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-white/[0.05] blur-3xl" aria-hidden="true" />
          <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-bold text-white/70">
                <BarChart3 size={17} aria-hidden="true" />
                Insights
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">Business tracking</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/65">
                Clear workload, invoice, and financial-year signals based on your logged data.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:w-[31rem]">
              <HeroMetric label="Week hours" value={`${formatHours(insights.currentWeek.totalMinutes)}h`} />
              <HeroMetric label="Set aside" value={formatMoney(setAside.combinedWeeklyCents)} />
              <HeroMetric label="Take-home" value={formatMoney(takeHomeWeeklyCents)} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <InsightCards cards={insights.insightCards} />
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <StatTile label="YTD paid to me" value={formatMoney(ytdPaidToMeCents)} icon={Banknote} />
        <StatTile label="YTD earned from employees" value={formatMoney(ytdEmployeeEarningsCents)} icon={TrendingUp} />
        <StatTile label="YTD paid to employees" value={formatMoney(ytdPaidToEmployeesCents)} icon={PiggyBank} />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        <Panel title="Workload" icon={Clock3}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatTile compact label="This week" value={`${formatHours(insights.currentWeek.totalMinutes)}h`} />
            <StatTile compact label="30-day avg/day" value={`${formatHours(insights.rolling30.averageDailyMinutes, "minutes")}h`} />
            <StatTile
              compact
              label="vs 30-day pace"
              value={`${insights.currentWeek.averageDeltaMinutes >= 0 ? "+" : "-"}${formatHours(Math.abs(insights.currentWeek.averageDeltaMinutes), "minutes")}h/day`}
              tone={insights.currentWeek.averageDeltaMinutes >= 0 ? "mint" : "yolk"}
            />
            <StatTile compact label="This month" value={`${formatHours(insights.workload.hoursThisMonthMinutes)}h`} />
            <StatTile compact label="This quarter" value={`${formatHours(insights.workload.hoursThisQuarterMinutes)}h`} />
            <StatTile compact label="Days off (30d)" value={`${insights.rolling30.dayOffCount}`} />
          </div>
          <InsightRow label="Best day this month" value={insights.workload.bestDayThisMonth ? `${formatDateAU(insights.workload.bestDayThisMonth.date)} - ${formatHours(insights.workload.bestDayThisMonth.minutes)}h` : "No hours yet"} />
          <InsightRow label="Busiest project this month" value={insights.workload.busiestProjectThisMonth ? `${insights.workload.busiestProjectThisMonth.title} - ${formatHours(insights.workload.busiestProjectThisMonth.minutes)}h` : "No project hours yet"} />
        </Panel>

        <Panel title="Revenue" icon={Banknote}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatTile compact label="Billable this week" value={formatMoney(insights.revenue.billableThisWeekCents)} />
            <StatTile compact label="Billable this month" value={formatMoney(insights.revenue.billableThisMonthCents)} />
            <StatTile compact label="Paid this month" value={formatMoney(insights.revenue.paidThisMonthCents)} hint={`${insights.revenue.paidThisMonthCount} invoice${insights.revenue.paidThisMonthCount === 1 ? "" : "s"}`} />
            <StatTile compact label="Outstanding" value={formatMoney(insights.revenue.outstandingCents)} hint={`${insights.revenue.outstandingCount} invoice${insights.revenue.outstandingCount === 1 ? "" : "s"}`} />
            <StatTile compact label="Overdue" value={formatMoney(insights.revenue.overdueCents)} hint={`${insights.revenue.overdueCount} invoice${insights.revenue.overdueCount === 1 ? "" : "s"}`} tone={insights.revenue.overdueCount ? "gum" : undefined} />
            <StatTile compact label="Avg rate realised" value={averageRate ? `${formatMoney(averageRate)}/h` : "N/A"} />
          </div>
          <InsightRow label="Unbilled work" value={`${formatMoney(insights.revenue.unbilledCents)} (${insights.revenue.unbilledTimeEntryCount} time, ${insights.revenue.unbilledExpenseItemCount} expenses)`} />
          <Link href="/invoices/new" className="tap-primary mt-2">
            <ReceiptText size={18} aria-hidden="true" />
            Invoice Unbilled Work
          </Link>
        </Panel>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Tax &amp; super planning" icon={Calculator}>
          <p className="text-sm font-semibold leading-6 text-moss">
            Based on a smoothed 30-day average of your billable earnings (not just this single week), annualised at an estimated{" "}
            <strong className="text-ink">{formatPercent(setAside.estimatedEffectiveTaxRate)}</strong> effective rate.
          </p>

          {setAsideSegments.length ? (
            <div>
              <div className="flex h-4 overflow-hidden rounded-full border border-line">
                {setAsideSegments.map((segment) => (
                  <div
                    key={segment.label}
                    className={segment.color}
                    style={{ width: `${Math.max(2, Math.round((segment.cents / Math.max(1, insights.currentWeek.billableValueCents)) * 100))}%` }}
                    title={`${segment.label}: ${formatMoney(segment.cents)}`}
                  />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {setAsideSegments.map((segment) => (
                  <div key={segment.label} className="rounded-lg bg-paper p-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-moss">
                      <span className={`size-2 rounded-full ${segment.color}`} aria-hidden="true" />
                      {segment.label}
                    </span>
                    <p className="mt-1 font-black tabular-nums text-ink">{formatMoney(segment.cents)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-line bg-paper p-3 text-sm font-bold text-moss">
              Tax and super planning are switched off. Turn them on in Settings to see a breakdown here.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatTile compact label="Suggested this week" value={formatMoney(setAside.combinedWeeklyCents)} />
            <StatTile compact label="Suggested this month" value={formatMoney(setAside.combinedMonthlyCents)} />
            <StatTile compact label="Annualised income est." value={formatMoney(setAside.estimatedAnnualIncomeCents)} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper p-3 text-xs font-bold leading-5 text-moss">
            <p>
              Estimate only, not tax advice. Uses the {setAside.financialYear} Australian resident brackets{setAside.customTaxRate ? ", overridden by your custom rate" : ""}.
            </p>
            <Link href="/settings" className="shrink-0 text-mint">
              Adjust in Settings
            </Link>
          </div>
        </Panel>

        <Panel title="Expenses" icon={ShieldCheck}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatTile compact label="This month" value={formatMoney(insights.expenses.thisMonthCents)} />
            <StatTile compact label="This financial year" value={formatMoney(insights.expenses.financialYearCents)} />
            <StatTile compact label="General (no project)" value={formatMoney(insights.expenses.generalFinancialYearCents)} />
          </div>

          {insights.expenses.byCategoryThisMonth.length ? (
            <div className="grid gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-moss">By category this month</p>
              {insights.expenses.byCategoryThisMonth.slice(0, 6).map((item) => (
                <div key={item.category} className="grid gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-ink">{item.label}</span>
                    <span className="font-black tabular-nums text-ink">{formatMoney(item.valueCents)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-paper">
                    <div className="h-full rounded-full bg-mint" style={{ width: `${Math.max(3, Math.round((item.valueCents / maxExpenseCategoryCents) * 100))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-line bg-paper p-3 text-sm font-bold text-moss">No work expenses logged this month.</p>
          )}

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
    <div className="rounded-xl border border-white/12 bg-white/[0.06] p-4">
      <p className="text-xs font-bold text-white/60">{label}</p>
      <p className="mt-2 text-2xl font-black tabular-nums tracking-tight text-white sm:text-3xl">{value}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white shadow-soft">
      <div className="flex items-center gap-3 border-b border-line p-4">
        <span className="icon-tile">
          <Icon size={20} aria-hidden="true" />
        </span>
        <h2 className="text-2xl font-black tracking-tight">{title}</h2>
      </div>
      <div className="grid gap-4 p-4">{children}</div>
    </section>
  );
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  compact = false,
  tone
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  compact?: boolean;
  tone?: "mint" | "gum" | "yolk";
}) {
  const toneClass = tone === "gum" ? "text-gum" : tone === "mint" ? "text-mint" : tone === "yolk" ? "text-yolk" : "text-ink";
  return (
    <div className={`rounded-lg border border-line bg-paper/55 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-moss">{label}</p>
        {Icon ? <Icon size={16} className="text-moss" aria-hidden="true" /> : null}
      </div>
      <p className={`mt-1.5 font-black tabular-nums tracking-tight ${toneClass} ${compact ? "text-lg" : "text-2xl"}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs font-semibold text-moss">{hint}</p> : null}
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-paper/55 p-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-bold text-moss">{label}</span>
      <span className="font-black text-ink">{value}</span>
    </div>
  );
}
