import Link from "next/link";
import { Banknote, Eye, Plus } from "lucide-react";
import { markInvoicePaidAction } from "@/app/actions";
import { requireUserId } from "@/lib/auth";
import { getInvoicesPageData } from "@/lib/app-data";
import { formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";
import { InvoiceStatusPill } from "@/components/StatusPill";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const filters = ["ALL", "DRAFT", "SENT", "PAID", "VOID"] as const;

function statusParam(params: SearchParams | undefined) {
  const value = params?.status;
  const status = typeof value === "string" ? value.toUpperCase() : "ALL";
  return filters.includes(status as (typeof filters)[number]) ? (status as (typeof filters)[number]) : "ALL";
}

export default async function InvoicesPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const status = statusParam(params);
  const ownerId = await requireUserId();
  const invoices = await getInvoicesPageData(ownerId, status);

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

      <nav className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Invoice filters">
        {filters.map((filter) => (
          <Link
            key={filter}
            href={filter === "ALL" ? "/invoices" : `/invoices?status=${filter.toLowerCase()}`}
            className={`status-pill shrink-0 ${filter === status ? "border-mint bg-mint text-white" : "border-line bg-white text-moss"}`}
          >
            {filter.toLowerCase()}
          </Link>
        ))}
      </nav>

      <section className="mt-6 grid gap-3">
        {invoices.map((invoice) => (
          <article key={invoice.id} className="card transition hover:border-mint">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-normal">{invoice.invoiceNumber}</h2>
                <p className="mt-1 text-sm font-bold text-moss">
                  {invoice.project.title} - {invoice.client.businessName}
                </p>
                <p className="mt-1 text-xs font-bold uppercase text-moss">{invoice.mode.toLowerCase()} invoice</p>
              </div>
              <InvoiceStatusPill status={invoice.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
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
                <p className="text-xs font-bold uppercase text-moss">Due date</p>
                <p className="mt-1 text-sm font-bold">{invoice.dueDate ? formatDateAU(invoice.dueDate) : "Not set"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-moss">Total</p>
                <p className="mt-1 text-lg font-black">{formatMoney(invoice.grandTotalCents)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-moss">Hours</p>
                <p className="mt-1 text-lg font-black">
                  {invoice.totalDurationMinutes ? formatHours(invoice.totalDurationMinutes) : Number(invoice.totalHours)}h
                </p>
              </div>
            </div>
            {invoice.paymentDate ? <p className="mt-3 text-sm font-bold text-moss">Paid {formatDateAU(invoice.paymentDate)}</p> : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link href={`/invoices/${invoice.id}`} className="tap-secondary flex-1">
                <Eye size={18} aria-hidden="true" />
                View
              </Link>
              <form action={markInvoicePaidAction} className="flex-1">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <SubmitButton className="tap-primary w-full bg-mint hover:bg-ink" pendingLabel="Marking paid..." disabled={invoice.status === "PAID" || invoice.status === "VOID"}>
                  <Banknote size={18} aria-hidden="true" />
                  Mark Paid
                </SubmitButton>
              </form>
            </div>
          </article>
        ))}
        {invoices.length === 0 ? (
          <p className="rounded-lg border border-line bg-white p-4 text-sm font-bold text-moss">
            No {status === "ALL" ? "" : status.toLowerCase()} invoices yet.
          </p>
        ) : null}
      </section>
    </main>
  );
}
