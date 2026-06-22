import Link from "next/link";
import { ArrowRight, Banknote, Building2, ClipboardList, Download, FileClock, LogOut, ReceiptText, ShieldCheck } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { requireUserId } from "@/lib/auth";
import { buildPaidWeeklyTotals } from "@/lib/dashboard";
import { getDashboardData } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import { dateInputValue, formatDateAU, previousWeekMondayToSunday } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";
import { InvoiceStatusPill } from "@/components/StatusPill";
import { LogTimeSheet } from "@/components/LogTimeSheet";
import { SummaryCard } from "@/components/SummaryCard";
import { WeeklyPaidChart } from "@/components/WeeklyPaidChart";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ownerId = await requireUserId();
  const previousWeek = previousWeekMondayToSunday();
  const previousWeekExportLink = `/hours-export?start=${dateInputValue(previousWeek.start)}&end=${dateInputValue(previousWeek.end)}`;

  const [dashboardData, profile] = await Promise.all([
    getDashboardData(ownerId),
    prisma.businessProfile.findUnique({ where: { ownerId }, select: { id: true } })
  ]);
  const { projects, sentInvoices, paidInvoices, previousWeekEntries, unbilledEntryCount, unbilledItemCount, pendingPaymentCents, pendingInvoicesCents } =
    dashboardData;
  const paidWeeks = buildPaidWeeklyTotals(paidInvoices);
  const showSetup = !profile || projects.length === 0 || (unbilledEntryCount === 0 && unbilledItemCount === 0 && sentInvoices.length === 0);

  return (
    <main className="page-shell">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-title">Trade Invoice Tracker</p>
          <h1 className="mt-2 text-3xl font-black tracking-normal sm:text-4xl">Today&apos;s work and invoices</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a className="tap-secondary" href="/backup">
            <Download size={20} aria-hidden="true" />
            Export Backup
          </a>
          <Link className="tap-secondary" href="/business-profile">
            <Building2 size={20} aria-hidden="true" />
            Profile
          </Link>
          <Link className="tap-secondary" href="/audit-log">
            <ShieldCheck size={20} aria-hidden="true" />
            Audit
          </Link>
          <form action={logoutAction}>
            <button className="tap-secondary w-full" type="submit">
              <LogOut size={20} aria-hidden="true" />
              Logout
            </button>
          </form>
          <LogTimeSheet projects={projects} />
        </div>
      </header>

      {showSetup ? (
        <section className="mt-6 rounded-lg border border-mint/30 bg-mint/10 p-4">
          <p className="section-title">Setup</p>
          <h2 className="mt-1 text-xl font-black tracking-normal">Get ready to invoice</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Link className="tap-secondary bg-white" href="/business-profile">
              <Building2 size={18} aria-hidden="true" />
              Business Profile
            </Link>
            <Link className="tap-secondary bg-white" href="/projects/new">
              <ReceiptText size={18} aria-hidden="true" />
              First Client / Project
            </Link>
            <Link className="tap-secondary bg-white" href="/invoices/new">
              <ClipboardList size={18} aria-hidden="true" />
              First Invoice
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <SummaryCard
          label="Pending Payment"
          value={formatMoney(pendingPaymentCents)}
          note={`${sentInvoices.length} sent invoice${sentInvoices.length === 1 ? "" : "s"}`}
          icon={Banknote}
        />
        <SummaryCard
          label="Pending Invoices"
          value={formatMoney(pendingInvoicesCents)}
          note={`${unbilledEntryCount} time entries, ${unbilledItemCount} items`}
          icon={ReceiptText}
        />
      </section>

      <div className="mt-6">
        <WeeklyPaidChart weeks={paidWeeks} />
      </div>

      <section className="mt-7 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black tracking-normal">Previous Week Hours</h2>
              <p className="mt-1 text-sm font-bold text-moss">
                {formatDateAU(previousWeek.start)} - {formatDateAU(previousWeek.end)}
              </p>
            </div>
            <Link className="inline-flex items-center gap-1 text-sm font-bold text-mint" href={previousWeekExportLink}>
              Export <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-3">
            {previousWeekEntries.length ? (
              previousWeekEntries.map((entry) => (
                <article key={entry.id} className="card">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold">{entry.project.title}</p>
                      <p className="mt-1 text-sm text-moss">{entry.project.client.businessName}</p>
                    </div>
                    <span className="rounded-lg bg-paper px-2.5 py-1 text-sm font-black text-ink">
                      {formatHours(entry.durationMinutes)}h
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-moss">
                    {formatDateAU(entry.date)}
                    {entry.notes ? ` - ${entry.notes}` : ""}
                  </p>
                </article>
              ))
            ) : (
              <article className="card flex items-center gap-3 text-moss">
                <FileClock size={20} aria-hidden="true" />
                No hours logged for the previous week.
              </article>
            )}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black tracking-normal">Outstanding</h2>
            <Link className="inline-flex items-center gap-1 text-sm font-bold text-mint" href="/invoices">
              Invoices <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-3">
            {sentInvoices.length ? (
              sentInvoices.map((invoice) => (
                <article key={invoice.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{invoice.invoiceNumber}</p>
                      <p className="mt-1 text-sm text-moss">{invoice.project.title}</p>
                    </div>
                    <InvoiceStatusPill status={invoice.status} />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-moss">
                      <ClipboardList size={16} aria-hidden="true" />
                      {formatDateAU(invoice.invoiceDate)}
                    </span>
                    <span className="text-lg font-black">{formatMoney(invoice.grandTotalCents)}</span>
                  </div>
                </article>
              ))
            ) : (
              <article className="card flex items-center gap-3 text-moss">
                <FileClock size={20} aria-hidden="true" />
                No sent invoices waiting on payment.
              </article>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
