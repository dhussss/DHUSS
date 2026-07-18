import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Plus,
  ReceiptText,
  UsersRound,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LogTimeSheet } from "@/components/LogTimeSheet";
import { WeeklyPerformanceChart } from "@/components/WeeklyPerformanceChart";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { markTeamMemberPaidAction } from "@/app/team/actions";
import { requireUserId } from "@/lib/auth";
import { getDashboardData } from "@/lib/app-data";
import { dateInputValue, formatDateAU, previousWeekMondayToSunday, todayInPerth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { calculateSetAsidePlanning } from "@/lib/planning";
import { formatHours } from "@/lib/time";
import { LearnHowLink } from "@/components/LearnHowLink";

export const dynamic = "force-dynamic";

type DashboardSearchParams = Promise<{
  wagePaid?: string;
  timeSaved?: string;
  assignedTimeSaved?: string;
  onboarding?: string;
}>;

export default async function DashboardPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  const { wagePaid, timeSaved, assignedTimeSaved, onboarding } = await searchParams;
  const ownerId = await requireUserId();
  const today = todayInPerth();
  const previousWeek = previousWeekMondayToSunday(today);
  const previousWeekExportLink = `/hours-export?start=${dateInputValue(previousWeek.start)}&end=${dateInputValue(previousWeek.end)}`;
  const dashboardData = await getDashboardData(ownerId);
  const profile = dashboardData.profile;

  if (!profile?.onboardingCompletedAt) redirect("/onboarding");

  const {
    projects,
    assignedProjects,
    unpaidWageGroups,
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

  const displayName = profile.contactName || profile.tradingName || "there";
  const firstName = displayName.split(/\s+/)[0] || displayName;
  const showSetup = projects.length === 0 || (unbilledEntryCount === 0 && unbilledItemCount === 0 && sentInvoices.length === 0);
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
  const overdueInvoice = sentInvoices.find((invoice) => invoice.dueDate && new Date(invoice.dueDate) < today);

  return (
    <main className="page-shell dashboard-shell">
      <DashboardNotices
        onboarding={onboarding}
        wagePaid={wagePaid}
        timeSaved={timeSaved}
        assignedTimeSaved={assignedTimeSaved}
      />

      <header className="dashboard-header">
        <div>
          <p className="text-sm text-moss">{todayLabel}</p>
          <h1>Good morning, {firstName}</h1>
        </div>
        <div className="dashboard-actions">
          <div className="dashboard-log-action">
            <LogTimeSheet projects={projects} assignedProjects={assignedProjects} buttonLabel="Log work" />
          </div>
          <Link className="tap-secondary" href="/invoices/new"><ReceiptText size={17} aria-hidden="true" />New invoice</Link>
          <Link className="tap-secondary" href="/projects/new"><FolderKanban size={17} aria-hidden="true" />New project</Link>
        </div>
      </header>

      <section className="position-ledger" aria-labelledby="position-title">
        <div className="position-heading">
          <p id="position-title">Today&apos;s position</p>
          <Link href="/invoices?status=sent">View outstanding <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        <div className="position-grid">
          <PositionMetric
            label="Outstanding"
            value={formatMoney(pendingPaymentCents)}
            note={overdueInvoiceCount ? `${overdueInvoiceCount} overdue` : `${invoiceSnapshots.sent.count} awaiting payment`}
            tone={overdueInvoiceCount ? "danger" : "accent"}
            primary
          />
          <PositionMetric label="This week" value={`${formatHours(totalCurrentWeekMinutes)}h`} note={`${currentWeekEntryCount} logged entries`} />
          <PositionMetric label="Billable" value={formatMoney(totalCurrentWeekBillableCents)} note="Work logged this week" />
          <PositionMetric label="Ready to invoice" value={formatMoney(pendingInvoicesCents)} note={`${unbilledEntryCount + unbilledItemCount} unbilled items`} href="/invoices/new" />
        </div>
        <Link href="/insights" className="set-aside-row">
          <span className="set-aside-icon"><WalletCards size={17} aria-hidden="true" /></span>
          <span>Tax set-aside estimate</span>
          <strong>{formatMoney(setAside.combinedWeeklyCents)}</strong>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </section>

      {unpaidWageGroups.length ? (
        <section className="attention-strip" aria-labelledby="wages-title">
          <div className="attention-strip-heading">
            <span className="semantic-icon warning"><WalletCards size={18} aria-hidden="true" /></span>
            <div><p className="text-xs font-semibold text-yolk">Employee pay due</p><h2 id="wages-title">Unpaid wages</h2></div>
          </div>
          <div className="attention-strip-list">
            {unpaidWageGroups.map((group) => (
              <article key={`${group.teamMemberId}:${group.projectId}`} className="wage-row">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{group.employee}</p>
                  <Link href={`/projects/${group.projectId}`} className="text-sm text-mint">{group.project}</Link>
                  <p className="mt-1 text-xs text-moss">{formatHours(group.minutes)}h unpaid · {formatHours(group.billedMinutes)}h billed</p>
                </div>
                <strong>{formatMoney(group.wagesCents)}</strong>
                <form action={markTeamMemberPaidAction}>
                  <input type="hidden" name="teamMemberId" value={group.teamMemberId} />
                  <input type="hidden" name="projectId" value={group.projectId} />
                  <input type="hidden" name="returnTo" value="/?wagePaid=1" />
                  <ConfirmSubmitButton className="tap-secondary" message={`Mark ${formatMoney(group.wagesCents)} for ${group.employee} on ${group.project} as paid? This will add a wages expense.`} pendingLabel="Recording..." showDefaultIcon={false}>Mark paid</ConfirmSubmitButton>
                </form>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {showSetup ? (
        <section className="setup-row">
          <div><p className="text-sm font-semibold text-mint">Getting started · {setupStepsComplete}/3</p><h2>{setupProgress}% ready for your first invoice</h2></div>
          <div className="setup-actions">
            <Link href="/business-profile"><Building2 size={17} />Business profile</Link>
            <Link href="/projects/new"><UsersRound size={17} />Add project</Link>
            <Link href="/invoices/new"><Plus size={17} />Create invoice</Link>
          </div>
        </section>
      ) : null}

      <section className="week-workspace" aria-labelledby="week-title">
        <div className="week-workspace-header">
          <div>
            <p className="text-sm font-semibold text-mint">Current week</p>
            <h2 id="week-title">Your week at a glance</h2>
            <p>{formatDateAU(dashboardData.currentWeekStart)} – {formatDateAU(dashboardData.currentWeekEnd)}</p>
            <LearnHowLink tutorialKey="weekly-planner">Learn how to review your week</LearnHowLink>
          </div>
          <div className="week-totals">
            <span><strong>{formatHours(totalCurrentWeekMinutes)}h</strong><small>logged</small></span>
            <span><strong>{formatMoney(totalCurrentWeekBillableCents)}</strong><small>billable</small></span>
          </div>
        </div>
        <WeeklyPerformanceChart days={currentWeekDays} rollingAverageDailyMinutes={rolling30AverageDailyMinutes} hasEntries={currentWeekEntryCount > 0} />
      </section>

      <section className="dashboard-workspace-grid">
        <section className="ledger-panel" aria-labelledby="attention-title">
          <PanelHeader title="Needs attention" href="/invoices" linkLabel="View invoices" />
          <div className="ledger-list">
            {overdueInvoice ? (
              <AttentionRow
                icon={AlertCircle}
                tone="danger"
                title={overdueInvoice.invoiceNumber}
                meta={`${overdueInvoice.project.title} · ${overdueInvoice.client.businessName}`}
                value={formatMoney(overdueInvoice.grandTotalCents)}
                note="Overdue"
                href={`/invoices/${overdueInvoice.id}`}
              />
            ) : null}
            {topActiveProjects[0] ? (
              <AttentionRow
                icon={Clock3}
                tone="warning"
                title={topActiveProjects[0].title}
                meta={`${formatHours(topActiveProjects[0].unbilledMinutes)}h unbilled`}
                value={formatMoney(topActiveProjects[0].unbilledValueCents)}
                note="Ready to invoice"
                href={`/projects/${topActiveProjects[0].id}`}
              />
            ) : null}
            {!overdueInvoice && !topActiveProjects[0] ? <EmptyRow icon={CheckCircle2} text="Nothing needs attention right now." /> : null}
          </div>
          <div className="invoice-flow" aria-label="Invoice status snapshot">
            <InvoiceFlowItem label="Draft" value={invoiceSnapshots.draft.valueCents} count={invoiceSnapshots.draft.count} href="/invoices?status=draft" />
            <InvoiceFlowItem label="Sent" value={invoiceSnapshots.sent.valueCents} count={invoiceSnapshots.sent.count} href="/invoices?status=sent" />
            <InvoiceFlowItem label="Paid this month" value={invoiceSnapshots.paidThisMonth.valueCents} count={invoiceSnapshots.paidThisMonth.count} href="/invoices?status=paid" />
          </div>
        </section>

        <section className="ledger-panel" aria-labelledby="active-title">
          <PanelHeader title="Active work" href="/projects" linkLabel="View projects" />
          <div className="active-work-head" aria-hidden="true"><span>Project</span><span>Hours</span><span>Unbilled</span></div>
          <div className="ledger-list">
            {topActiveProjects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="active-work-row">
                <span className="min-w-0"><strong>{project.title}</strong><small>{project.client.businessName}</small></span>
                <span>{formatHours(project.unbilledMinutes)}h</span>
                <span>{formatMoney(project.unbilledValueCents)}</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            ))}
            {!topActiveProjects.length ? <EmptyRow icon={FolderKanban} text="No active projects yet." /> : null}
          </div>
          <Link href={previousWeekExportLink} className="previous-week-row">
            <span><strong>Previous week</strong><small>{previousWeekEntries.length} entries ready to export</small></span>
            <span>Export hours <ArrowRight size={15} /></span>
          </Link>
        </section>
      </section>
    </main>
  );
}

function DashboardNotices({ onboarding, wagePaid, timeSaved, assignedTimeSaved }: { onboarding?: string; wagePaid?: string; timeSaved?: string; assignedTimeSaved?: string }) {
  const message = onboarding === "complete"
    ? "Setup complete. Your workspace is ready."
    : wagePaid === "1"
      ? "Wage payment recorded and added to expenses."
      : assignedTimeSaved === "1"
        ? "Hours submitted to the assigning contractor."
        : timeSaved === "1"
          ? "Hours saved and included in your totals."
          : null;
  if (!message) return null;
  return <div className="dashboard-notice" role="status"><CheckCircle2 size={17} aria-hidden="true" />{message}</div>;
}

function PositionMetric({ label, value, note, tone = "default", primary = false, href }: { label: string; value: string; note: string; tone?: "default" | "accent" | "danger"; primary?: boolean; href?: string }) {
  const content = <><p>{label}</p><strong className={`${tone === "danger" ? "text-gum" : tone === "accent" ? "text-mint" : ""}`}>{value}</strong><small>{note}</small>{href ? <span>Review <ArrowRight size={14} /></span> : null}</>;
  const className = `position-metric ${primary ? "is-primary" : ""}`;
  return href ? <Link href={href} className={className}>{content}</Link> : <div className={className}>{content}</div>;
}

function PanelHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return <header className="ledger-panel-header"><h2>{title}</h2><Link href={href}>{linkLabel}<ArrowRight size={14} /></Link></header>;
}

function AttentionRow({ icon: Icon, tone, title, meta, value, note, href }: { icon: LucideIcon; tone: "danger" | "warning"; title: string; meta: string; value: string; note: string; href: string }) {
  return <Link href={href} className="attention-row"><span className={`semantic-icon ${tone}`}><Icon size={18} /></span><span className="min-w-0"><strong>{title}</strong><small>{meta}</small><em>{note}</em></span><b>{value}</b><ArrowRight size={15} /></Link>;
}

function InvoiceFlowItem({ label, value, count, href }: { label: string; value: number; count: number; href: string }) {
  return <Link href={href}><span>{label}<small>{count} invoice{count === 1 ? "" : "s"}</small></span><strong>{formatMoney(value)}</strong></Link>;
}

function EmptyRow({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return <div className="empty-ledger-row"><Icon size={18} /><span>{text}</span></div>;
}
