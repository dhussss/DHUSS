import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  ClipboardList,
  Clock3,
  FileClock,
  FilePlus2,
  FolderKanban,
  LogOut,
  ReceiptText,
  Sparkles,
  Timer,
  TrendingUp,
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Children, type ReactNode } from "react";
import { logoutAction } from "@/app/actions";
import { LogTimeSheet } from "@/components/LogTimeSheet";
import { requireUserId } from "@/lib/auth";
import { getDashboardData, type DashboardData } from "@/lib/app-data";
import { dateInputValue, formatDateAU, previousWeekMondayToSunday, todayInPerth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
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
    prisma.businessProfile.findUnique({ where: { ownerId }, select: { id: true, tradingName: true, contactName: true } })
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

  return (
    <main className="page-shell max-w-[92rem]">
      <section className="overflow-hidden rounded-lg border border-ink/10 bg-ink text-white shadow-soft">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(15,159,143,0.42),transparent_34rem),linear-gradient(135deg,rgba(255,255,255,0.12),transparent_38%)] p-4 sm:p-6 lg:p-7">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-black uppercase text-mint">
                <Sparkles size={17} aria-hidden="true" />
                Command Centre
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-normal sm:text-5xl">Morning, {displayName}</h1>
              <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-white/75">
                {todayLabel}. This is the live cockpit for hours, invoices, and work ready to bill.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:w-[31rem]">
              <LogTimeSheet projects={projects} buttonLabel="Log Work" />
              <Link className="tap-secondary border-white/20 bg-white/10 text-white hover:border-mint hover:text-white" href="/invoices/new">
                <FilePlus2 size={20} aria-hidden="true" />
                Invoice
              </Link>
              <Link className="tap-secondary border-white/20 bg-white/10 text-white hover:border-mint hover:text-white" href="/projects/new">
                <FolderKanban size={20} aria-hidden="true" />
                Project
              </Link>
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
              tone="yolk"
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

        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-black/15 px-4 py-3 sm:px-6 lg:px-7">
          <AdminLink href="/business-profile" icon={Building2} label="Profile" />
          <form action={logoutAction}>
            <button className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold text-white/75 transition hover:bg-white/10 hover:text-white" type="submit">
              <LogOut size={16} aria-hidden="true" />
              Logout
            </button>
          </form>
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
        <WeekCalendar days={currentWeekDays} hasEntries={currentWeekEntryCount > 0} />
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
          accent="yolk"
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
  tone: "mint" | "yolk" | "gum";
  href?: string;
}) {
  const tones = {
    mint: "from-mint/30 to-white/10 text-mint",
    yolk: "from-yolk/30 to-white/10 text-yolk",
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

function AdminLink({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold text-white/75 transition hover:bg-white/10 hover:text-white">
      <Icon size={16} aria-hidden="true" />
      {label}
    </Link>
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

function WeekCalendar({ days, hasEntries }: { days: DashboardData["currentWeekDays"]; hasEntries: boolean }) {
  return (
    <section>
      <div className="overflow-x-auto p-4 sm:p-5">
        <div className="grid min-w-[82rem] grid-cols-7 items-stretch gap-3">
          {days.map((day) => {
            const dayTarget = 8 * 60;
            const progress = Math.min((day.totalMinutes / dayTarget) * 100, 100);
            const projectChips = day.projects.slice(0, 2);
            const extraProjectCount = Math.max(day.projects.length - projectChips.length, 0);
            const entryLabel = `${day.entryCount} entr${day.entryCount === 1 ? "y" : "ies"}`;

            return (
              <article
                key={day.date}
                className={`flex h-full min-h-[21rem] flex-col rounded-lg border p-5 shadow-soft ${
                  day.isToday ? "border-mint bg-mint/10 ring-2 ring-mint/20" : "border-line bg-white"
                }`}
              >
                <header className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-moss">{day.dayName}</p>
                    {day.isToday ? <span className="rounded-full border border-mint bg-white px-2.5 py-1 text-[0.65rem] font-black uppercase leading-none text-mint">Today</span> : null}
                  </div>
                  <p className="text-3xl font-black tracking-normal text-ink">{day.dateLabel}</p>
                </header>

                <div className="mt-6 grid gap-3">
                  <div className="rounded-lg border border-line bg-paper p-3">
                    <p className="text-lg font-black text-ink">{formatHours(day.totalMinutes)}h logged</p>
                    <p className="mt-1 text-sm font-bold text-moss">{formatMoney(day.billableValueCents)} billable</p>
                  </div>

                  <div className="h-2.5 overflow-hidden rounded-full bg-paper">
                    <div className={`h-full rounded-full ${day.isToday ? "bg-yolk" : "bg-mint"}`} style={{ width: `${Math.max(progress, day.totalMinutes ? 8 : 0)}%` }} />
                  </div>
                </div>

                <div className="mt-5 grid gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-moss">Projects</p>
                  {projectChips.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {projectChips.map((project) => (
                        <span key={project} className="max-w-full break-words rounded-full bg-paper px-2.5 py-1.5 text-xs font-bold leading-4 text-moss">
                          {project}
                        </span>
                      ))}
                      {extraProjectCount ? <span className="rounded-full bg-paper px-2.5 py-1.5 text-xs font-black leading-4 text-moss">+{extraProjectCount} more</span> : null}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-line bg-paper/50 p-3 text-sm font-bold text-moss">No work logged</p>
                  )}
                </div>

                <div className="mt-auto pt-5">
                  <p className="rounded-lg border border-line bg-white/80 px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-moss">{entryLabel}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {!hasEntries ? (
        <div className="border-t border-line bg-mint/10 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black text-ink">No hours logged this week yet</p>
              <p className="mt-1 text-sm font-bold text-moss">Start with today&apos;s first entry and the week planner will fill in.</p>
            </div>
            <Link href="/projects" className="tap-secondary bg-white">
              <Timer size={18} aria-hidden="true" />
              Choose Project
            </Link>
          </div>
        </div>
      ) : null}
    </section>
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
  accent: "mint" | "yolk" | "gum" | "ink";
  children: ReactNode;
}) {
  const hasChildren = Children.toArray(children).some(Boolean);
  const accents = {
    mint: "bg-mint",
    yolk: "bg-yolk",
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
  const rows = [
    { label: "Overdue", data: snapshots.overdue, tone: "gum" as const, icon: AlertTriangle },
    { label: "Sent", data: snapshots.sent, tone: "mint" as const, icon: Banknote },
    { label: "Draft", data: snapshots.draft, tone: "yolk" as const, icon: FileClock },
    { label: "Paid This Month", data: snapshots.paidThisMonth, tone: "ink" as const, icon: TrendingUp }
  ];

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <Link key={row.label} href={row.label === "Paid This Month" ? "/invoices?status=paid" : `/invoices?status=${row.label.toLowerCase().split(" ")[0]}`} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white p-3 transition hover:border-mint">
          <div className="flex items-center gap-3">
            <span className={`grid size-10 place-items-center rounded-lg ${snapshotTone(row.tone)}`}>
              <row.icon size={19} aria-hidden="true" />
            </span>
            <div>
              <p className="font-black text-ink">{row.label}</p>
              <p className="text-sm font-bold text-moss">{row.data.count} invoice{row.data.count === 1 ? "" : "s"}</p>
            </div>
          </div>
          <p className="text-lg font-black text-ink">{formatMoney(row.data.valueCents)}</p>
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
