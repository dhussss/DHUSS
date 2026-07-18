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
const filters = ["ALL", "DRAFT", "SENT", "OVERDUE", "PAID", "VOID"] as const;

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

      <nav className="filter-tabs mt-5" aria-label="Invoice filters">
        {filters.map((filter) => (
          <Link
            key={filter}
            href={filter === "ALL" ? `/invoices${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/invoices?status=${filter.toLowerCase()}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={filter === status ? "is-active" : ""}
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

      <section className="collection-panel mt-5">
        {invoices.map((invoice) => {
          const dueDate = invoice.dueDate;
          const overdue = invoice.status === "SENT" && dueDate && dueDate < today;

          return (
          <article key={invoice.id} className={`collection-row invoice-collection-row ${overdue ? "bg-gum/[0.025]" : ""}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2"><h2 className="collection-title">{invoice.invoiceNumber}</h2>{overdue ? <span className="status-pill border-gum/30 bg-gum/10 text-gum">Overdue</span> : null}</div>
              <p className="collection-subtitle">{invoice.project.title} · {invoice.client.businessName}</p>
            </div>
            <dl className="collection-meta"><dt>Due</dt><dd className={overdue ? "text-gum" : ""}>{dueDate ? formatDateAU(dueDate) : "Not set"}</dd></dl>
            <dl className="collection-meta"><dt>Hours</dt><dd>{invoice.totalDurationMinutes ? formatHours(invoice.totalDurationMinutes) : Number(invoice.totalHours)}h</dd></dl>
            <div><span className="collection-value">{formatMoney(invoice.grandTotalCents)}</span><div className="mt-1"><InvoiceStatusPill status={invoice.status} /></div></div>
            <div className="collection-actions">
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
          <div className="empty-collection">No {status === "ALL" ? "" : status.toLowerCase()} invoices yet.</div>
        ) : null}
      </section>
    </main>
  );
}
