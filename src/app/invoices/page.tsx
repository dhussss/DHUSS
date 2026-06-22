import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { InvoiceStatusPill } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      dateRangeStart: true,
      dateRangeEnd: true,
      invoiceDate: true,
      grandTotalCents: true,
      totalHours: true,
      project: { select: { title: true } },
      client: { select: { businessName: true } }
    },
    orderBy: [{ invoiceDate: "desc" }, { invoiceNumber: "desc" }]
  });

  return (
    <main className="page-shell">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-title">Invoices</p>
          <h1 className="mt-2 text-3xl font-black tracking-normal">Invoice history</h1>
        </div>
        <Link href="/invoices/new" className="tap-primary">
          <Plus size={20} aria-hidden="true" />
          Create New Invoice
        </Link>
      </header>

      <section className="mt-6 grid gap-3">
        {invoices.map((invoice) => (
          <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="card block transition hover:border-mint">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-normal">{invoice.invoiceNumber}</h2>
                <p className="mt-1 text-sm font-bold text-moss">
                  {invoice.project.title} - {invoice.client.businessName}
                </p>
              </div>
              <InvoiceStatusPill status={invoice.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs font-bold uppercase text-moss">Date range</p>
                <p className="mt-1 text-sm font-bold">
                  {formatDateAU(invoice.dateRangeStart)} - {formatDateAU(invoice.dateRangeEnd)}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-moss">Invoice date</p>
                <p className="mt-1 text-sm font-bold">{formatDateAU(invoice.invoiceDate)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-moss">Total</p>
                <p className="mt-1 text-lg font-black">{formatMoney(invoice.grandTotalCents)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-moss">Hours</p>
                <p className="mt-1 text-lg font-black">{Number(invoice.totalHours)}h</p>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
