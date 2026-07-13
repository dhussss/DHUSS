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
  TrendingUp,
  UsersRound,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Children, type ReactNode } from "react";
import { LogTimeSheet } from "@/components/LogTimeSheet";
import { WeeklyPerformanceChart } from "@/components/WeeklyPerformanceChart";
import { requireUserId } from "@/lib/auth";
import { getDashboardData, type DashboardData } from "@/lib/app-data";
import { dateInputValue, formatDateAU, previousWeekMondayToSunday, todayInPerth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { calculateSetAsidePlanning, formatPercent } from "@/lib/planning";
import { formatHours, labourTotalCents } from "@/lib/time";
import { prisma } from "@/lib/prisma";
import { markTeamMemberPaidAction } from "@/app/team/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ wagePaid?: string }> }) {
  const { wagePaid } = await searchParams;
  const ownerId = await requireUserId();
  const today = todayInPerth();
  const previousWeek = previousWeekMondayToSunday(today);
  const previousWeekExportLink = `/hours-export?start=${dateInputValue(previousWeek.start)}&end=${dateInputValue(previousWeek.end)}`;

  const [dashboardData, unpaidTeamEntries, assignedProjects] = await Promise.all([
    getDashboardData(ownerId),
    prisma.timeEntry.findMany({
      where: { ownerId, teamMemberId: { not: null }, approvalStatus: "APPROVED", paymentStatus: "UNPAID" },
      select: {
        teamMemberId: true,
        durationMinutes: true,
        payRateCentsSnapshot: true,
        billingStatus: true,
        teamMember: { select: { displayName: true } },
        project: { select: { id: true, title: true } }
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }]
    }),
    prisma.projectAssignment.findMany({
      where: { active: true, teamMember: { userId: ownerId, status: "ACTIVE" }, project: { status: "ACTIVE" } },
      select: { id: true, project: { select: { id: true, title: true, client: { select: { businessName: true } } } } },
      orderBy: { project: { title: "asc" } }
    })
  ]);
  const unpaidWageGroups = new Map<string, { teamMemberId: string; employee: string; projectId: string; project: string; minutes: number; wagesCents: number; billedMinutes: number }>();
  for (const entry of unpaidTeamEntries) {
    if (!entry.teamMemberId || !entry.teamMember) continue;
    const key = `${entry.teamMemberId}:${entry.project.id}`;
    const group = unpaidWageGroups.get(key) || { teamMemberId: entry.teamMemberId, employee: entry.teamMember.displayName, projectId: entry.project.id, project: entry.project.title, minutes: 0, wagesCents: 0, billedMinutes: 0 };
    group.minutes += entry.durationMinutes;
    group.wagesCents += labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0);
    if (entry.billingStatus === "BILLED") group.billedMinutes += entry.durationMinutes;
    unpaidWageGroups.set(key, group);
  }
  const profile = dashboardData.profile;

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
    rolling30AverageWeeklyBillableCents,
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
  const setAside = calculateSetAsidePlanning(totalCurrentWeekBillableCents, profile, today, rolling30AverageWeeklyBillableCents);
  const setupStepsComplete = [Boolean(profile), projects.length > 0, currentWeekEntryCount > 0].filter(Boolean).length;
  const setupProgress = Math.round((setupStepsComplete / 3) * 100);

  return (
    <main className="page-shell max-w-[92rem]">
      {wagePaid === "1" ? (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-mint/25 bg-mint/10 p-4 text-sm font-bold text-ink" role="status">
          <WalletCards size={19} className="shrink-0 text-mint" aria-hidden="true" />
          Wage payment recorded. The employee ledger and wages expense are now up to date.
        </div>
      ) : null}
      <section className="command-hero-bg relative overflow-hidden rounded-2xl text-white shadow-[0_1px_1px_rgba(15,43,34,0.4),0_24px_60px_-16px_rgba(15,43,34,0.55)]">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-white/[0.05] blur-3xl" aria-hidden="true" />
        <div className="relative p-5 sm:p-7 lg:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold text-white/60">{todayLabel}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Good morning, {displayName}</h1>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[31rem]">
              <div className="[&_button]:w-full [&_button]:rounded-xl [&_button]:border-white/15 [&_button]:bg-white [&_button]:text-ink [&_button]:shadow-none [&_button:hover]:bg-paper">
                <LogTimeSheet projects={projects} assignedProjects={assignedProjects} buttonLabel="Log Work" />
              </div>
              <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:border-white/25 hover:bg-white/[0.16]" href="/invoices/new">
                <ReceiptText size={18} aria-hidden="true" /> New Invoice
              </Link>
              <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:border-white/25 hover:bg-white/[0.16]" href="/projects/new">
                <FolderKanban size={18} aria-hidden="true" /> New Project
              </Link>
            </div>
          </div>

          <div className="mt-7 grid overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] md:grid-cols-3">
            <HeroKpi
              icon={Clock3}
              label="This week"
              value={`${formatHours(totalCurrentWeekMinutes)}h`}
              note={`${formatMoney(totalCurrentWeekBillableCents)} billable`}
              tone="mint"
            />
            <HeroKpi
              icon={Banknote}
              label="Outstanding"
              value={formatMoney(pendingPaymentCents)}
              note={invoiceSnapshots.overdue.count ? `${invoiceSnapshots.overdue.count} overdue` : `${invoiceSnapshots.sent.count} sent invoice${invoiceSnapshots.sent.count === 1 ? "" : "s"}`}
              tone={overdueInvoiceCount ? "gum" : "mint"}
            />
            <HeroKpi
              icon={ReceiptText}
              label="Ready to invoice"
              value={formatMoney(pendingInvoicesCents)}
              note={`${unbilledEntryCount + unbilledItemCount} unbilled item${unbilledEntryCount + unbilledItemCount === 1 ? "" : "s"}`}
              tone="mint"
              href="/invoices/new"
            />
          </div>
        </div>
      </section>

      <Link href="/insights" className="card mt-4 block transition hover:border-mint/50">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="icon-tile">
              <Calculator size={19} aria-hidden="true" />
            </span>
            <div>
              <p className="font-black text-ink">Tax set-aside this week</p>
              <p className="mt-1 text-sm font-semibold text-moss">
                {setAside.taxEnabled ? `Based on your 30-day average earnings, annualised at ${formatPercent(setAside.estimatedEffectiveTaxRate)}.` : "Tax set-aside is switched off in Settings."}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black tabular-nums tracking-tight text-ink">{formatMoney(setAside.combinedWeeklyCents)}</p>
            <span className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-mint">
              Full breakdown <ArrowRight size={15} aria-hidden="true" />
            </span>
          </div>
        </div>
        {setAside.taxEnabled || setAside.superEnabled || setAside.includeGstInTaxEstimate ? (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {setAside.taxEnabled ? <SetAsideChip label="Income tax" value={formatMoney(setAside.suggestedTaxWeeklyCents)} /> : null}
            {setAside.includeGstInTaxEstimate ? <SetAsideChip label="GST" value={formatMoney(setAside.suggestedGstWeeklyCents)} /> : null}
            {setAside.superEnabled && setAside.includeSuperInSetAsidePlanning ? <SetAsideChip label="Super" value={formatMoney(setAside.suggestedSuperWeeklyCents)} /> : null}
          </div>
        ) : null}
      </Link>

      {unpaidWageGroups.size ? (
        <section className="mt-4 overflow-hidden rounded-2xl border border-gum/30 bg-white shadow-soft">
          <div className="flex items-center justify-between gap-4 border-b border-line bg-gum/5 p-4 sm:p-5">
            <div><p className="section-title text-gum">Employee pay due</p><h2 className="mt-1 text-xl font-black">Unpaid wages</h2></div>
            <WalletCards size={22} className="text-gum" aria-hidden="true" />
          </div>
          <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-2">
            {[...unpaidWageGroups.values()].map((group) => (
              <article key={`${group.teamMemberId}:${group.projectId}`} className="rounded-[10px] border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-4"><div><p className="font-black">{group.employee}</p><Link href={`/projects/${group.projectId}`} className="mt-1 block text-sm font-bold text-mint">{group.project}</Link></div><p className="text-xl font-black">{formatMoney(group.wagesCents)}</p></div>
                <p className="mt-3 text-sm font-semibold text-moss">{formatHours(group.minutes)}h unpaid · {formatHours(group.billedMinutes)}h already billed</p>
                <form action={markTeamMemberPaidAction} className="mt-3"><input type="hidden" name="teamMemberId" value={group.teamMemberId} /><input type="hidden" name="projectId" value={group.projectId} /><input type="hidden" name="returnTo" value="/?wagePaid=1" /><ConfirmSubmitButton className="tap-primary w-full" message={`Mark ${formatMoney(group.wagesCents)} for ${group.employee} on ${group.project} as paid? This will add a wages expense.`} pendingLabel="Recording payment..." showDefaultIcon={false}><WalletCards size={18} aria-hidden="true" />Mark paid</ConfirmSubmitButton></form>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {showSetup ? (
        <section className="mt-4 rounded-2xl border border-mint/25 bg-white p-4 shadow-soft sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-title">Getting started</p>
              <h2 className="mt-1 text-xl font-black tracking-tight">You are {setupProgress}% ready to send your first invoice</h2>
            </div>
            <span className="text-2xl font-black text-mint">{setupStepsComplete}/3</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-paper">
            <div className="h-full rounded-full bg-mint transition-all" style={{ width: `${setupProgress}%` }} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Link className="tap-secondary bg-white" href="/business-profile">
              <Building2 size={18} aria-hidden="true" />
              {profile ? "Profile complete" : "Complete profile"}
            </Link>
            <Link className="tap-secondary bg-white" href="/projects/new">
              <UsersRound size={18} aria-hidden="true" />
              {projects.length ? "Project added" : "Add first project"}
            </Link>
            <Link className="tap-secondary bg-white" href="/invoices/new">
              <ClipboardList size={18} aria-hidden="true" />
              Create first invoice
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
        <div className="border-b border-line bg-white p-5 sm:p-6">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-ink">This week</h2>
            <p className="mt-1 text-sm font-medium text-moss">
              {formatDateAU(dashboardData.currentWeekStart)} - {formatDateAU(dashboardData.currentWeekEnd)}
            </p>
          </div>
        </div>
        <WeeklyPerformanceChart
          days={currentWeekDays}
          rollingAverageDailyMinutes={rolling30AverageDailyMinutes}
          hasEntries={currentWeekEntryCount > 0}
        />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2 [&>section:last-child]:lg:col-span-2">
        <DashboardWidget
          title="Top Active Projects"
          actionHref="/projects"
          actionLabel="Projects"
          emptyIcon={FolderKanban}
          emptyText="No active projects yet."
          accent="mint"
        >
          {topActiveProjects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="group block rounded-[10px] border border-line bg-white p-4 transition hover:border-mint/60 hover:bg-paper/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black tracking-tight text-ink">{project.title}</p>
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
            <article key={entry.id} className="rounded-[10px] border border-line bg-white p-3">
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
    mint: "text-white",
    gum: "text-[#ffb39e]"
  };
  const card = (
    <article className={`group min-h-40 border-t border-white/12 p-4 first:border-t-0 md:border-l md:border-t-0 ${tones[tone]} sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-white/60">{label}</p>
        <span className="grid size-9 place-items-center rounded-xl bg-white/10">
          <Icon size={19} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-5 text-3xl font-black tabular-nums tracking-tight text-white sm:text-4xl">{value}</p>
      <p className="mt-2 text-sm font-medium leading-5 text-white/58">{note}</p>
      {href ? (
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-white transition group-hover:gap-2">
          Review and invoice <ArrowRight size={16} aria-hidden="true" />
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
    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-white p-4">
        <div className="flex items-center gap-3">
          <span className={`h-8 w-1 rounded-full ${accents[accent]}`} aria-hidden="true" />
          <h2 className="text-xl font-black tracking-tight">{title}</h2>
        </div>
        <Link className="inline-flex items-center gap-1 text-sm font-bold text-mint" href={actionHref}>
          {actionLabel} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="grid gap-3 p-3">
        {hasChildren ? (
          children
        ) : (
          <article className="rounded-[10px] border border-line bg-paper/40 p-4 text-sm font-semibold text-moss">
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

function SetAsideChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-paper p-2.5">
      <p className="text-xs font-bold text-moss">{label}</p>
      <p className="mt-1 font-black tabular-nums text-ink">{value}</p>
    </div>
  );
}

function SnapshotMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-paper/70 p-2.5">
      <p className="text-[0.72rem] font-bold text-moss">{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums leading-6 text-ink">{value}</p>
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
          <p className="text-lg font-black tabular-nums text-ink">{formatMoney(row.valueCents)}</p>
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
