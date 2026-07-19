import Link from "next/link";
import { AlertTriangle, Banknote, CalendarClock, CircleDollarSign, Eye, FileText, Mail, Plus, RotateCcw, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { markInvoicePaidAction, markInvoiceUnpaidAction } from "@/app/actions";
import { requireUserId } from "@/lib/auth";
import { getInvoiceCollectionsSummary, getInvoicesPageData } from "@/lib/app-data";
import { formatDateAU, todayInPerth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { InvoiceStatusPill } from "@/components/StatusPill";
import { SubmitButton } from "@/components/SubmitButton";
import { LearnHowLink } from "@/components/LearnHowLink";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const filters = ["ALL", "DRAFT", "SENT", "OVERDUE", "PAID", "VOID"] as const;

function statusParam(params: SearchParams | undefined) {
  const value = params?.status;
  const status = typeof value === "string" ? value.toUpperCase() : "ALL";
  return filters.includes(status as (typeof filters)[number]) ? (status as (typeof filters)[number]) : "ALL";
}

function agingParam(params: SearchParams | undefined) {
  const value = params?.aging;
  return value === "recent" ? "RECENT" as const : value === "31plus" ? "OLD" as const : "ALL" as const;
}

export default async function InvoicesPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const status = statusParam(params);
  const aging = agingParam(params);
  const q = typeof params?.q === "string" ? params.q.trim() : "";
  const ownerId = await requireUserId();
  const [invoices, collections] = await Promise.all([
    getInvoicesPageData(ownerId, status, q, aging),
    getInvoiceCollectionsSummary(ownerId)
  ]);
  const today = todayInPerth();

  return (
    <main className="page-shell">
      <header className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-title">Invoices</p>
          <h1 className="page-title">Invoice history</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3"><LearnHowLink tutorialKey="creating-invoices">Learn how invoices work</LearnHowLink><Link href="/invoices/new" className="tap-primary"><Plus size={20} aria-hidden="true" />Create New Invoice</Link></div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Invoice collections overview">
        <CollectionsMetric
          href="/invoices?status=sent"
          icon={CircleDollarSign}
          label="Outstanding"
          value={formatMoney(collections.outstanding.valueCents)}
          note={`${collections.outstanding.count} awaiting payment`}
        />
        <CollectionsMetric
          href="/invoices?status=sent"
          icon={CalendarClock}
          label="Due next 7 days"
          value={formatMoney(collections.dueSoon.valueCents)}
          note={`${collections.dueSoon.count} invoice${collections.dueSoon.count === 1 ? "" : "s"}`}
        />
        <CollectionsMetric
          href="/invoices?status=overdue&aging=recent"
          icon={AlertTriangle}
          label="Overdue 1–30 days"
          value={formatMoney(collections.overdueRecent.valueCents)}
          note={`${collections.overdueRecent.count} to follow up`}
          urgent={collections.overdueRecent.count > 0}
        />
        <CollectionsMetric
          href="/invoices?status=overdue&aging=31plus"
          icon={AlertTriangle}
          label="Overdue 31+ days"
          value={formatMoney(collections.overdueOld.valueCents)}
          note={`${collections.overdueOld.count} need attention`}
          urgent={collections.overdueOld.count > 0}
        />
      </section>

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
        {status === "OVERDUE" && aging !== "ALL" ? <input type="hidden" name="aging" value={aging === "OLD" ? "31plus" : "recent"} /> : null}
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
              <Link href={`/invoices/${invoice.id}/email${overdue ? "?mode=reminder" : ""}`} className="tap-secondary flex-1">
                <Mail size={18} aria-hidden="true" />
                {overdue ? "Follow Up" : "Email Invoice"}
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
          status === "ALL" && !q ? (
            <div className="grid justify-items-start gap-3 p-5 sm:p-6"><span className="icon-tile"><FileText size={19} aria-hidden="true" /></span><div><h2 className="text-lg font-semibold text-ink">Invoices turn recorded work into a payment request</h2><p className="mt-1 max-w-xl text-sm font-medium leading-6 text-moss">Log hours and expenses against a project first, then create a draft from everything still marked unbilled.</p></div><div className="flex flex-wrap gap-2"><Link href="/invoices/new" className="tap-primary"><Plus size={17} aria-hidden="true" />Create an invoice</Link><LearnHowLink tutorialKey="creating-invoices">See the workflow</LearnHowLink></div></div>
          ) : <div className="empty-collection">No {status === "ALL" ? "" : status.toLowerCase()} invoices found.</div>
        ) : null}
      </section>
    </main>
  );
}

function CollectionsMetric({ href, icon: Icon, label, value, note, urgent = false }: { href: string; icon: LucideIcon; label: string; value: string; note: string; urgent?: boolean }) {
  return (
    <Link href={href} className={`rounded-lg border bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift ${urgent ? "border-gum/35" : "border-line"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-xs font-semibold ${urgent ? "text-gum" : "text-moss"}`}>{label}</p>
        <Icon size={18} className={urgent ? "text-gum" : "text-mint"} aria-hidden="true" />
      </div>
      <strong className={`mt-3 block text-2xl font-semibold ${urgent ? "text-gum" : "text-ink"}`}>{value}</strong>
      <small className="mt-1 block text-xs font-medium text-moss">{note}</small>
    </Link>
  );
}
