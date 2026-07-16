import Link from "next/link";
import { Banknote, Eye, Mail, Plus, RotateCcw, Search } from "lucide-react";
import { markInvoicePaidAction, markInvoiceUnpaidAction } from "@/app/actions";
import { requireUserId } from "@/lib/auth";
import { getInvoicesPageData } from "@/lib/app-data";
import { formatDateAU, todayInPerth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
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
  const q = typeof params?.q === "string" ? params.q.trim() : "";
  const ownerId = await requireUserId();
  const invoices = await getInvoicesPageData(ownerId, status, q);
  const today = todayInPerth();

  return (
    <main className="page-shell">
      <header className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-title">Invoices</p>
          <h1 className="page-title">Invoice history</h1>
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
            href={filter === "ALL" ? `/invoices${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/invoices?status=${filter.toLowerCase()}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`status-pill shrink-0 ${filter === status ? "border-mint bg-mint text-white" : "border-line bg-white text-moss"}`}
          >
            {filter.toLowerCase()}
          </Link>
        ))}
      </nav>

      <form className="search-panel mt-4 flex flex-col gap-2 sm:flex-row" action="/invoices">
        {status !== "ALL" ? <input type="hidden" name="status" value={status.toLowerCase()} /> : null}
        <label className="flex-1">
          Search invoices
          <input name="q" defaultValue={q} placeholder="Invoice number, client, or project" />
        </label>
        <button className="tap-secondary self-end" type="submit">
          <Search size={18} aria-hidden="true" />
          Search
        </button>
      </form>

      <section className="mt-6 grid gap-3">
        {invoices.map((invoice) => {
          const dueDate = invoice.dueDate;
          const overdue = invoice.status === "SENT" && dueDate && dueDate < today;

          return (
          <article key={invoice.id} className={`card transition hover:border-mint ${overdue ? "border-gum/50 bg-gum/5" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black">{invoice.invoiceNumber}</h2>
                  {overdue ? <span className="status-pill border-gum bg-gum/10 text-gum">overdue</span> : null}
                </div>
                <p className="mt-1 text-sm font-bold text-moss">
                  {invoice.project.title} - {invoice.client.businessName}
                </p>
                  <p className="mt-1 text-xs font-semibold text-moss">{invoice.mode.toLowerCase()} invoice</p>
              </div>
              <InvoiceStatusPill status={invoice.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div>
                <p className="text-xs font-semibold text-moss">Date range</p>
                <p className="mt-1 text-sm font-bold">
                  {formatDateAU(invoice.dateRangeStart)} - {formatDateAU(invoice.dateRangeEnd)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-moss">Invoice date</p>
                <p className="mt-1 text-sm font-bold">{formatDateAU(invoice.invoiceDate)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-moss">Due date</p>
                <p className={`mt-1 text-sm font-bold ${overdue ? "text-gum" : ""}`}>{dueDate ? formatDateAU(dueDate) : "Not set"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-moss">Total</p>
                <p className="mt-1 text-lg font-black">{formatMoney(invoice.grandTotalCents)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-moss">Hours</p>
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
              <Link href={`/invoices/${invoice.id}/email`} className="tap-secondary flex-1">
                <Mail size={18} aria-hidden="true" />
                Email Invoice
              </Link>
              {invoice.status === "PAID" ? (
                <form action={markInvoiceUnpaidAction} className="flex-1">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <ConfirmSubmitButton
                    className="tap-secondary w-full"
                    message={`Mark ${invoice.invoiceNumber} as unpaid? It will move back to sent and appear as outstanding again.`}
                    pendingLabel="Marking unpaid..."
                    showDefaultIcon={false}
                  >
                    <RotateCcw size={18} aria-hidden="true" />
                    Mark Unpaid
                  </ConfirmSubmitButton>
                </form>
              ) : (
                <form action={markInvoicePaidAction} className="flex-1">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <SubmitButton className="tap-primary w-full bg-mint hover:bg-ink" pendingLabel="Marking paid..." disabled={invoice.status === "VOID"}>
                    <Banknote size={18} aria-hidden="true" />
                    Mark Paid
                  </SubmitButton>
                </form>
              )}
            </div>
          </article>
          );
        })}
        {invoices.length === 0 ? (
          <p className="rounded-lg border border-line bg-white p-4 text-sm font-bold text-moss">
            No {status === "ALL" ? "" : status.toLowerCase()} invoices yet.
          </p>
        ) : null}
      </section>
    </main>
  );
}
