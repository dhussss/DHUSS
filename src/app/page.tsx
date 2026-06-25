import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  Calculator,
  ClipboardList,
  Clock3,
  FileClock,
  FolderKanban,
  ReceiptText,
  Sparkles,
  Timer,
  TrendingUp,
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Children, type ReactNode } from "react";
import { LogTimeSheet } from "@/components/LogTimeSheet";
import { WeeklyPerformanceChart } from "@/components/AnalyticsCharts";
import { requireUserId } from "@/lib/auth";
import { getDashboardData, type DashboardData } from "@/lib/app-data";
import { dateInputValue, formatDateAU, previousWeekMondayToSunday, todayInPerth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { calculateSetAsidePlanning, formatPercent } from "@/lib/planning";
import { prisma } from "@/lib/prisma";
import { formatHours } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ownerId = await requireUserId();
  const today = todayInPerth();
  const previousWeek = previousWeekMondayToSunday(today);
  const previousWeekExportLink = `/hours-export?start=${dateInputValue(previousWeek.start)}&end=${dateInputValue(previousWeek.end)}`;

  const [dashboardData, profile] = await Promise.all([
    getDashboardData(ownerId),
    prisma.businessProfile.findUnique({
      where: { ownerId },
      select: {
        id: true,
        tradingName: true,
        contactName: true,
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

  const {
    projects,
    topActiveProjects,
    invoiceSnapshots,
    sentInvoices,
    previousWeekEntries,
    currentWeekDays,
    totalCurrentWeekMinutes,
    totalCurrentWeekBillableCents,
    rolling30AverageDailyMinutes,
    currentWeekAverageDailyMinutes,
    weeklyAverageDeltaMinutes,
    currentWeekEntryCount,
    unbilledEntryCount,
    unbilledItemCount,
    pendingPaymentCents,
    pendingInvoicesCents,
    overdueInvoiceCount
  } = dashboardData;

  const displayName = profile?.contactName || profile?.tradingName || "there";
  const showSetup = !profile || projects.length === 0 || (unbilledEntryCount === 0 && unbilledItemCount === 0 && sentInvoices.length === 0);
  const todayLabel = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(today);
  const setAside = calculateSetAsidePlanning(totalCurrentWeekBillableCents, profile, today);

  return (
    <main className="page-shell max-w-[92rem]">
      <section className="overflow-hidden rounded-lg border border-ink/10 bg-ink text-white shadow-soft">
        <div className="command-hero-bg p-4 sm:p-6 lg:p-7">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-black uppercase text-mint">
                <Sparkles size={17} aria-hidden="true" />
                Dashboard
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-normal sm:text-5xl">Morning, {displayName}</h1>
              <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-white/75">
                {todayLabel}. This is the live cockpit for hours, invoices, and work ready to bill.
              </p>
            </div>
            <div className="lg:w-[10rem]">
              <LogTimeSheet projects={projects} buttonLabel="Log Work" />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HeroKpi
              icon={Clock3}
              label="Weekly Hours"
              value={`${formatHours(totalCurrentWeekMinutes)}h`}
              note={`${currentWeekEntryCount} logged entr${currentWeekEntryCount === 1 ? "y" : "ies"}`}
              tone="mint"
            />
            <HeroKpi
              icon={TrendingUp}
              label="Weekly Billable Value"
              value={formatMoney(totalCurrentWeekBillableCents)}
              note="Labour value logged this week"
              tone="mint"
            />
            <HeroKpi
              icon={Banknote}
              label="Outstanding Invoices"
              value={formatMoney(pendingPaymentCents)}
              note={`${invoiceSnapshots.sent.count} sent, ${invoiceSnapshots.overdue.count} overdue`}
              tone={overdueInvoiceCount ? "gum" : "mint"}
            />
            <HeroKpi
              icon={ReceiptText}
              label="Unbilled Work"
              value={formatMoney(pendingInvoicesCents)}
              note={`${unbilledEntryCount} time entr${unbilledEntryCount === 1 ? "y" : "ies"} + ${unbilledItemCount} expense${unbilledItemCount === 1 ? "" : "s"}`}
              tone="mint"
              href="/invoices/new"
            />
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-line bg-white shadow-soft">
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex items-start gap-3">
            <span className="icon-tile">
              <Calculator size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="section-title">Tax Set Aside</p>
              <h2 className="mt-1 text-2xl font-black tracking-normal text-ink">{formatMoney(setAside.combinedWeeklyCents)} this week</h2>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-moss">
                Estimate only, not tax advice. Based on {formatMoney(setAside.currentWeekEarningsCents)} current-week billable value annualised to{" "}
                {formatMoney(setAside.estimatedAnnualIncomeCents)}.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[34rem]">
            <SnapshotMini label="Tax rate estimate" value={formatPercent(setAside.estimatedEffectiveTaxRate)} />
            <SnapshotMini label="Tax this month" value={formatMoney(setAside.suggestedTaxMonthlyCents)} />
            <SnapshotMini label="Super this week" value={formatMoney(setAside.suggestedSuperWeeklyCents)} />
          </div>
        </div>
      </section>

      {showSetup ? (
        <section className="mt-4 rounded-lg border border-mint/30 bg-mint/10 p-4">
          <p className="section-title">Setup</p>
          <h2 className="mt-1 text-xl font-black tracking-normal">Get ready to invoice</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Link className="tap-secondary bg-white" href="/business-profile">
              <Building2 size={18} aria-hidden="true" />
              Business Profile
            </Link>
            <Link className="tap-secondary bg-white" href="/projects/new">
              <UsersRound size={18} aria-hidden="true" />
              First Client / Project
            </Link>
            <Link className="tap-secondary bg-white" href="/invoices/new">
              <ClipboardList size={18} aria-hidden="true" />
              First Invoice
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mt-5 rounded-lg border border-ink/10 bg-white shadow-soft">
        <div className="rounded-t-lg bg-ink p-5 text-white sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-black uppercase text-mint">
                <Timer size={17} aria-hidden="true" />
                Current week planner
              </p>
              <h2 className="mt-1 text-3xl font-black tracking-normal sm:text-4xl">Monday to Sunday</h2>
              <p className="mt-2 text-sm font-bold text-white/70">
                {formatDateAU(dashboardData.currentWeekStart)} - {formatDateAU(dashboardData.currentWeekEnd)}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:w-[28rem]">
              <WeekSummaryCard label="This Week" value={`${formatHours(totalCurrentWeekMinutes)}h`} note="logged hours" />
              <WeekSummaryCard label="Earned" value={formatMoney(totalCurrentWeekBillableCents)} note="billable value" />
            </div>
          </div>
        </div>
        <WeeklyPerformanceChart
          days={currentWeekDays}
          totalMinutes={totalCurrentWeekMinutes}
          billableValueCents={totalCurrentWeekBillableCents}
          rollingAverageDailyMinutes={rolling30AverageDailyMinutes}
          currentWeekAverageDailyMinutes={currentWeekAverageDailyMinutes}
          averageDeltaMinutes={weeklyAverageDeltaMinutes}
          hasEntries={currentWeekEntryCount > 0}
        />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr_0.9fr]">
        <DashboardWidget
          title="Top Active Projects"
          actionHref="/projects"
          actionLabel="Projects"
          emptyIcon={FolderKanban}
          emptyText="No active projects yet."
          accent="mint"
        >
          {topActiveProjects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="group block rounded-lg border border-line bg-white p-4 transition hover:border-mint">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black tracking-normal text-ink">{project.title}</p>
                  <p className="mt-1 text-sm font-bold text-moss">{project.client.businessName}</p>
                </div>
                <ArrowRight size={18} className="mt-1 text-moss transition group-hover:text-mint" aria-hidden="true" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <SnapshotMini label="Unbilled Hours" value={`${formatHours(project.unbilledMinutes)}h`} />
                <SnapshotMini label="Unbilled Value" value={formatMoney(project.unbilledValueCents)} />
              </div>
            </Link>
          ))}
        </DashboardWidget>

        <DashboardWidget
          title="Invoice Snapshot"
          actionHref="/invoices"
          actionLabel="Invoices"
          emptyIcon={FileClock}
          emptyText="No invoices yet."
          accent="mint"
        >
          <InvoiceSnapshotGrid snapshots={invoiceSnapshots} />
        </DashboardWidget>

        <DashboardWidget
          title="Previous Week Hours"
          actionHref={previousWeekExportLink}
          actionLabel="Export"
          emptyIcon={FileClock}
          emptyText="No hours logged for the previous complete week."
          accent="mint"
        >
          {previousWeekEntries.slice(0, 4).map((entry) => (
            <article key={entry.id} className="rounded-lg border border-line bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-ink">{entry.project.title}</p>
                  <p className="mt-1 text-sm font-bold text-moss">{entry.project.client.businessName}</p>
                </div>
                <span className="rounded-lg bg-paper px-2.5 py-1 text-sm font-black text-ink">{formatHours(entry.durationMinutes)}h</span>
              </div>
              <p className="mt-2 text-sm font-bold text-moss">
                {formatDateAU(entry.date)}
                {entry.notes ? ` - ${entry.notes}` : ""}
              </p>
            </article>
          ))}
        </DashboardWidget>
      </section>
    </main>
  );
}

function HeroKpi({
  icon: Icon,
  label,
  value,
  note,
  tone,
  href
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  tone: "mint" | "gum";
  href?: string;
}) {
  const tones = {
    mint: "from-mint/30 to-white/10 text-mint",
    gum: "from-gum/30 to-white/10 text-gum"
  };
  const card = (
    <article className={`min-h-40 rounded-lg border border-white/15 bg-gradient-to-br ${tones[tone]} p-4 shadow-soft`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-white/65">{label}</p>
        <span className="grid size-10 place-items-center rounded-lg bg-white/12">
          <Icon size={21} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-5 text-4xl font-black tracking-normal text-white sm:text-5xl">{value}</p>
      <p className="mt-2 text-sm font-bold leading-5 text-white/70">{note}</p>
      {href ? (
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-black text-white">
          Start invoice <ArrowRight size={16} aria-hidden="true" />
        </span>
      ) : null}
    </article>
  );

  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

function WeekSummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 p-4 shadow-soft">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-white/60">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-normal text-white">{value}</p>
      <p className="mt-1 text-xs font-bold text-white/60">{note}</p>
    </div>
  );
}

function DashboardWidget({
  title,
  actionHref,
  actionLabel,
  emptyIcon: EmptyIcon,
  emptyText,
  accent,
  children
}: {
  title: string;
  actionHref: string;
  actionLabel: string;
  emptyIcon: LucideIcon;
  emptyText: string;
  accent: "mint" | "gum" | "ink";
  children: ReactNode;
}) {
  const hasChildren = Children.toArray(children).some(Boolean);
  const accents = {
    mint: "bg-mint",
    gum: "bg-gum",
    ink: "bg-ink"
  };

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-white/80 shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-white p-4">
        <div className="flex items-center gap-3">
          <span className={`h-9 w-1.5 rounded-full ${accents[accent]}`} aria-hidden="true" />
          <h2 className="text-xl font-black tracking-normal">{title}</h2>
        </div>
        <Link className="inline-flex items-center gap-1 text-sm font-bold text-mint" href={actionHref}>
          {actionLabel} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="grid gap-3 p-3">
        {hasChildren ? (
          children
        ) : (
          <article className="rounded-lg border border-line bg-white p-4 text-sm font-bold text-moss">
            <span className="inline-flex items-center gap-3">
              <EmptyIcon size={20} aria-hidden="true" />
              {emptyText}
            </span>
          </article>
        )}
      </div>
    </section>
  );
}

function SnapshotMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-paper p-2.5">
      <p className="text-[0.68rem] font-black uppercase text-moss">{label}</p>
      <p className="mt-1 text-lg font-black leading-6 text-ink">{value}</p>
    </div>
  );
}

function InvoiceSnapshotGrid({ snapshots }: { snapshots: DashboardData["invoiceSnapshots"] }) {
  const unbilledCaption = [
    `${snapshots.unbilled.timeEntryCount} time entr${snapshots.unbilled.timeEntryCount === 1 ? "y" : "ies"}`,
    snapshots.unbilled.expenseItemCount ? `${snapshots.unbilled.expenseItemCount} expense${snapshots.unbilled.expenseItemCount === 1 ? "" : "s"}` : ""
  ].filter(Boolean).join(", ");
  const rows = [
    { label: "Unbilled", valueCents: snapshots.unbilled.valueCents, caption: unbilledCaption || "No work ready to bill", tone: "mint" as const, icon: ReceiptText, href: "/invoices/new" },
    { label: "Overdue", valueCents: snapshots.overdue.valueCents, caption: `${snapshots.overdue.count} invoice${snapshots.overdue.count === 1 ? "" : "s"}`, tone: "gum" as const, icon: AlertTriangle, href: "/invoices?status=overdue" },
    { label: "Sent", valueCents: snapshots.sent.valueCents, caption: `${snapshots.sent.count} invoice${snapshots.sent.count === 1 ? "" : "s"}`, tone: "mint" as const, icon: Banknote, href: "/invoices?status=sent" },
    { label: "Draft", valueCents: snapshots.draft.valueCents, caption: `${snapshots.draft.count} invoice${snapshots.draft.count === 1 ? "" : "s"}`, tone: "yolk" as const, icon: FileClock, href: "/invoices?status=draft" },
    { label: "Paid This Month", valueCents: snapshots.paidThisMonth.valueCents, caption: `${snapshots.paidThisMonth.count} invoice${snapshots.paidThisMonth.count === 1 ? "" : "s"}`, tone: "ink" as const, icon: TrendingUp, href: "/invoices?status=paid" }
  ];

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <Link key={row.label} href={row.href} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white p-3 transition hover:border-mint">
          <div className="flex items-center gap-3">
            <span className={`grid size-10 place-items-center rounded-lg ${snapshotTone(row.tone)}`}>
              <row.icon size={19} aria-hidden="true" />
            </span>
            <div>
              <p className="font-black text-ink">{row.label}</p>
              <p className="text-sm font-bold text-moss">{row.caption}</p>
            </div>
          </div>
          <p className="text-lg font-black text-ink">{formatMoney(row.valueCents)}</p>
        </Link>
      ))}
    </div>
  );
}

function snapshotTone(tone: "mint" | "yolk" | "gum" | "ink") {
  const tones = {
    mint: "bg-mint/10 text-mint",
    yolk: "bg-yolk/15 text-yolk",
    gum: "bg-gum/10 text-gum",
    ink: "bg-ink/10 text-ink"
  };
  return tones[tone];
}
