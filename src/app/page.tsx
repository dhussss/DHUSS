import Link from "next/link";
import { ArrowRight, Banknote, ClipboardList, FileClock, ReceiptText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buildPaidWeeklyTotals, unbilledTimeValue } from "@/lib/dashboard";
import { formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";
import { InvoiceStatusPill } from "@/components/StatusPill";
import { LogTimeSheet } from "@/components/LogTimeSheet";
import { SummaryCard } from "@/components/SummaryCard";
import { WeeklyPaidChart } from "@/components/WeeklyPaidChart";

export default async function DashboardPage() {
  const [projects, sentInvoices, paidInvoices, unbilledEntries, unbilledItems, recentEntries] = await Promise.all([
    prisma.project.findMany({
      where: { status: "ACTIVE" },
      include: { client: true },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.invoice.findMany({
      where: { status: "SENT" },
      include: { project: true, client: true },
      orderBy: { invoiceDate: "desc" }
    }),
    prisma.invoice.findMany({
      where: { status: "PAID", paymentDate: { not: null } },
      orderBy: { paymentDate: "desc" }
    }),
    prisma.timeEntry.findMany({
      where: { billingStatus: "UNBILLED" },
      include: { project: { include: { client: true } } },
      orderBy: { date: "desc" }
    }),
    prisma.expenseItem.findMany({
      where: { billingStatus: "UNBILLED" },
      include: { project: true },
      orderBy: { datePurchased: "desc" }
    }),
    prisma.timeEntry.findMany({
      take: 5,
      include: { project: { include: { client: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    })
  ]);

  const pendingPaymentCents = sentInvoices.reduce((sum, invoice) => sum + invoice.grandTotalCents, 0);
  const pendingInvoicesCents =
    unbilledTimeValue(unbilledEntries) + unbilledItems.reduce((sum, item) => sum + item.totalCostCents, 0);
  const paidWeeks = buildPaidWeeklyTotals(paidInvoices);

  return (
    <main className="page-shell">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-title">Trade Invoice Tracker</p>
          <h1 className="mt-2 text-3xl font-black tracking-normal sm:text-4xl">Today&apos;s work and invoices</h1>
        </div>
        <LogTimeSheet projects={projects} />
      </header>

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
          note={`${unbilledEntries.length} time entries, ${unbilledItems.length} items`}
          icon={ReceiptText}
        />
      </section>

      <div className="mt-6">
        <WeeklyPaidChart weeks={paidWeeks} />
      </div>

      <section className="mt-7 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black tracking-normal">Recent hours</h2>
            <Link className="inline-flex items-center gap-1 text-sm font-bold text-mint" href="/hours-export">
              Export <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-3">
            {recentEntries.map((entry) => (
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
            ))}
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
