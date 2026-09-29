import Link from "next/link";
import { ArrowLeft, ArrowRight, RotateCcw, Search, WalletCards } from "lucide-react";
import { requireUserId } from "@/lib/auth";
import { formatDateAU, todayInPerth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { formatHours, labourTotalCents } from "@/lib/time";

export const dynamic = "force-dynamic";

type PayrollStatus = "DUE" | "PAID" | "REVERSED";

function payrollStatus(value: string | string[] | undefined): PayrollStatus {
  return value === "paid" ? "PAID" : value === "reversed" ? "REVERSED" : "DUE";
}

function financialYearStart(date: Date) {
  return new Date(Date.UTC(date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1, 6, 1));
}

export default async function PayrollRegisterPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ownerId = await requireUserId();
  const status = payrollStatus(params?.status);
  const q = typeof params?.q === "string" ? params.q.trim().slice(0, 80) : "";
  const today = todayInPerth();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const fyStart = financialYearStart(today);

  const [unpaidEntries, payments] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        ownerId,
        teamMemberId: { not: null },
        approvalStatus: "APPROVED",
        paymentStatus: "UNPAID"
      },
      select: {
        id: true,
        date: true,
        durationMinutes: true,
        payRateCentsSnapshot: true,
        teamMember: { select: { id: true, displayName: true } },
        project: { select: { id: true, title: true } }
      },
      orderBy: { date: "asc" }
    }),
    prisma.wagePayment.findMany({
      where: { ownerId },
      select: {
        id: true,
        status: true,
        paidAt: true,
        reversedAt: true,
        reversalNote: true,
        reference: true,
        minutes: true,
        amountCents: true,
        teamMember: { select: { id: true, displayName: true } },
        project: { select: { id: true, title: true } },
        _count: { select: { timeEntries: true } }
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }]
    })
  ]);

  const allDueCents = unpaidEntries.reduce((sum, entry) => sum + labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0), 0);
  const activePayments = payments.filter((payment) => payment.status === "PAID");
  const paidThisMonthCents = activePayments.filter((payment) => payment.paidAt >= monthStart && payment.paidAt <= today).reduce((sum, payment) => sum + payment.amountCents, 0);
  const paidThisFinancialYearCents = activePayments.filter((payment) => payment.paidAt >= fyStart && payment.paidAt <= today).reduce((sum, payment) => sum + payment.amountCents, 0);
  const searchNeedle = q.toLocaleLowerCase("en-AU");
  const matchingUnpaidEntries = q
    ? unpaidEntries.filter((entry) => `${entry.teamMember?.displayName || ""} ${entry.project.title}`.toLocaleLowerCase("en-AU").includes(searchNeedle))
    : unpaidEntries;
  const matchingPayments = q
    ? payments.filter((payment) => `${payment.teamMember.displayName} ${payment.project.title} ${payment.reference || ""}`.toLocaleLowerCase("en-AU").includes(searchNeedle))
    : payments;
  const dueGroups = Array.from(matchingUnpaidEntries.reduce((groups, entry) => {
    if (!entry.teamMember) return groups;
    const key = `${entry.teamMember.id}:${entry.project.id}`;
    const current = groups.get(key) || {
      teamMemberId: entry.teamMember.id,
      employee: entry.teamMember.displayName,
      projectId: entry.project.id,
      project: entry.project.title,
      minutes: 0,
      amountCents: 0,
      entryCount: 0,
      oldestDate: entry.date
    };
    current.minutes += entry.durationMinutes;
    current.amountCents += labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0);
    current.entryCount += 1;
    if (entry.date < current.oldestDate) current.oldestDate = entry.date;
    groups.set(key, current);
    return groups;
  }, new Map<string, { teamMemberId: string; employee: string; projectId: string; project: string; minutes: number; amountCents: number; entryCount: number; oldestDate: Date }>()).values()).sort((a, b) => b.amountCents - a.amountCents);
  const visiblePayments = status === "PAID"
    ? matchingPayments.filter((payment) => payment.status === "PAID")
    : status === "REVERSED"
      ? matchingPayments.filter((payment) => payment.status === "VOID")
      : [];

  return (
    <main className="page-shell">
      <Link href="/team" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint"><ArrowLeft size={18} aria-hidden="true" />Team</Link>
      <header className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="section-title">Payroll</p><h1 className="page-title">Wage register</h1><p className="page-subtitle">Reconcile what is still owed with every recorded payment and reversal.</p></div>
        <Link href="/team" className="tap-secondary">Manage team <ArrowRight size={17} aria-hidden="true" /></Link>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Payroll totals">
        <PayrollMetric label="Currently due" value={formatMoney(allDueCents)} note={`${unpaidEntries.length} unpaid shift${unpaidEntries.length === 1 ? "" : "s"}`} urgent={allDueCents > 0} />
        <PayrollMetric label="Paid this month" value={formatMoney(paidThisMonthCents)} note="Active payments" />
        <PayrollMetric label="Paid this financial year" value={formatMoney(paidThisFinancialYearCents)} note={`${activePayments.length} payment records`} />
      </section>

      <nav className="filter-tabs mt-5" aria-label="Payroll filters">
        <Link href={`/team/payments${q ? `?q=${encodeURIComponent(q)}` : ""}`} className={status === "DUE" ? "is-active" : ""}>Due</Link>
        <Link href={`/team/payments?status=paid${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={status === "PAID" ? "is-active" : ""}>Paid</Link>
        <Link href={`/team/payments?status=reversed${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={status === "REVERSED" ? "is-active" : ""}>Reversed</Link>
      </nav>

      <form className="search-panel mt-4 flex flex-col gap-2 sm:flex-row" action="/team/payments">
        {status !== "DUE" ? <input type="hidden" name="status" value={status.toLowerCase()} /> : null}
        <label className="flex-1">Search payroll<input name="q" defaultValue={q} placeholder="Subcontractor, project, or payment reference" /></label>
        <button className="tap-secondary self-end" type="submit"><Search size={18} aria-hidden="true" />Search</button>
      </form>

      <section className="collection-panel mt-5">
        {status === "DUE" ? dueGroups.map((group) => (
          <Link key={`${group.teamMemberId}:${group.projectId}`} href={`/team/${group.teamMemberId}`} className="collection-row payroll-row">
            <span className="semantic-icon warning"><WalletCards size={18} aria-hidden="true" /></span>
            <span className="min-w-0"><strong className="collection-title">{group.employee}</strong><small className="collection-subtitle">{group.project} · oldest shift {formatDateAU(group.oldestDate)}</small></span>
            <span className="collection-meta"><small>{group.entryCount} shift{group.entryCount === 1 ? "" : "s"}</small><strong>{formatHours(group.minutes)}h</strong></span>
            <strong className="collection-value">{formatMoney(group.amountCents)}</strong>
            <ArrowRight size={17} className="text-mint" aria-hidden="true" />
          </Link>
        )) : visiblePayments.map((payment) => (
          <Link key={payment.id} href={`/team/${payment.teamMember.id}`} className={`collection-row payroll-row ${payment.status === "VOID" ? "opacity-70" : ""}`}>
            <span className={`semantic-icon ${payment.status === "VOID" ? "danger" : "success"}`}>{payment.status === "VOID" ? <RotateCcw size={18} aria-hidden="true" /> : <WalletCards size={18} aria-hidden="true" />}</span>
            <span className="min-w-0"><strong className="collection-title">{payment.teamMember.displayName}</strong><small className="collection-subtitle">{payment.project.title} · {payment.status === "VOID" ? `reversed ${payment.reversedAt ? formatDateAU(payment.reversedAt) : ""}` : `paid ${formatDateAU(payment.paidAt)}`}</small></span>
            <span className="collection-meta"><small>{payment._count.timeEntries} shift{payment._count.timeEntries === 1 ? "" : "s"}</small><strong>{formatHours(payment.minutes)}h</strong></span>
            <span className="text-right"><strong className={`collection-value ${payment.status === "VOID" ? "line-through" : ""}`}>{formatMoney(payment.amountCents)}</strong><small className="mt-1 block text-xs font-medium text-moss">{payment.reference || payment.reversalNote || "No reference"}</small></span>
            <ArrowRight size={17} className="text-mint" aria-hidden="true" />
          </Link>
        ))}
        {(status === "DUE" ? dueGroups.length : visiblePayments.length) === 0 ? (
          <div className="empty-collection">{q ? "No payroll records match this search." : status === "DUE" ? "No wages are currently due." : status === "PAID" ? "No wage payments recorded yet." : "No reversed payments."}</div>
        ) : null}
      </section>
    </main>
  );
}

function PayrollMetric({ label, value, note, urgent = false }: { label: string; value: string; note: string; urgent?: boolean }) {
  return <article className={`rounded-lg border bg-white p-4 shadow-soft ${urgent ? "border-yolk/60" : "border-line"}`}><p className="text-xs font-semibold text-moss">{label}</p><strong className="mt-2 block text-2xl font-semibold tabular-nums text-ink">{value}</strong><small className="mt-1 block text-xs font-medium text-moss">{note}</small></article>;
}
