import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Banknote, Eye, Mail, MessageSquare, RotateCcw, Send, XCircle } from "lucide-react";
import {
  deleteInvoiceAction,
  markInvoicePaidAction,
  markInvoiceSentAction,
  unvoidInvoiceAction,
  voidInvoiceAction
} from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";
import { InvoiceStatusPill } from "@/components/StatusPill";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      project: true,
      client: true,
      lineItems: { orderBy: { sortOrder: "asc" } }
    }
  });

  if (!invoice) notFound();

  return (
    <main className="page-shell">
      <Link href="/invoices" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Invoices
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="section-title">Invoice</p>
            <InvoiceStatusPill status={invoice.status} />
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-normal">{invoice.invoiceNumber}</h1>
          <p className="mt-1 font-bold text-moss">
            {invoice.project.title} - {invoice.client.businessName}
          </p>
        </div>
        <p className="text-3xl font-black">{formatMoney(invoice.grandTotalCents)}</p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <article className="card">
          <p className="text-sm font-bold text-moss">Invoice date</p>
          <p className="mt-2 text-xl font-black">{formatDateAU(invoice.invoiceDate)}</p>
        </article>
        <article className="card">
          <p className="text-sm font-bold text-moss">Work range</p>
          <p className="mt-2 text-xl font-black">
            {formatDateAU(invoice.dateRangeStart)} - {formatDateAU(invoice.dateRangeEnd)}
          </p>
        </article>
        <article className="card">
          <p className="text-sm font-bold text-moss">Paid date</p>
          <p className="mt-2 text-xl font-black">{invoice.paymentDate ? formatDateAU(invoice.paymentDate) : "Not paid"}</p>
        </article>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-3">
          <h2 className="text-xl font-black tracking-normal">Summary lines</h2>
          {invoice.lineItems.map((line) => (
            <article key={line.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{line.description}</p>
                  <p className="mt-1 text-sm text-moss">
                    {line.date ? formatDateAU(line.date) : "No date"}
                    {line.notes ? ` - ${line.notes}` : ""}
                  </p>
                </div>
                <p className="font-black">{formatMoney(line.totalAmountCents)}</p>
              </div>
              <p className="mt-2 text-sm font-bold text-moss">
                {line.type === "LABOUR"
                  ? `${formatHours(line.hoursMinutes ?? 0)}h at ${formatMoney(line.unitAmountCents)}/h`
                  : `Qty ${Number(line.quantity ?? 0)} at ${formatMoney(line.unitAmountCents)}`}
              </p>
            </article>
          ))}
        </div>

        <aside className="grid h-fit gap-4">
          <section className="card">
            <p className="section-title">Totals</p>
            <dl className="mt-4 grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <dt className="font-bold text-moss">Hours</dt>
                <dd className="font-black">{Number(invoice.totalHours)}h</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-bold text-moss">Labour</dt>
                <dd className="font-black">{formatMoney(invoice.labourTotalCents)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-bold text-moss">Items</dt>
                <dd className="font-black">{formatMoney(invoice.itemTotalCents)}</dd>
              </div>
              <div className="border-t border-line pt-3">
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-bold text-moss">Grand total</dt>
                  <dd className="text-2xl font-black">{formatMoney(invoice.grandTotalCents)}</dd>
                </div>
              </div>
            </dl>
          </section>

          <section className="grid gap-2">
            <button className="tap-secondary" type="button" disabled>
              <Eye size={20} aria-hidden="true" />
              Preview Invoice
            </button>
            <button className="tap-secondary" type="button" disabled>
              <Mail size={20} aria-hidden="true" />
              Email Invoice
            </button>
            <button className="tap-secondary" type="button" disabled>
              <MessageSquare size={20} aria-hidden="true" />
              Text Invoice
            </button>

            <form action={markInvoiceSentAction}>
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <button className="tap-primary w-full" type="submit" disabled={invoice.status === "PAID" || invoice.status === "VOID"}>
                <Send size={20} aria-hidden="true" />
                Mark Sent
              </button>
            </form>
            <form action={markInvoicePaidAction}>
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <button className="tap-primary w-full bg-mint hover:bg-ink" type="submit" disabled={invoice.status === "PAID" || invoice.status === "VOID"}>
                <Banknote size={20} aria-hidden="true" />
                Mark Paid
              </button>
            </form>
            {invoice.status === "VOID" ? (
              <form action={unvoidInvoiceAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button className="tap-secondary w-full" type="submit">
                  <RotateCcw size={20} aria-hidden="true" />
                  Unvoid Invoice
                </button>
              </form>
            ) : (
              <form action={voidInvoiceAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button className="tap-danger w-full" type="submit">
                  <XCircle size={20} aria-hidden="true" />
                  Void Invoice
                </button>
              </form>
            )}

            <form action={deleteInvoiceAction}>
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <ConfirmSubmitButton
                className="tap-danger w-full"
                message={`Delete ${invoice.invoiceNumber} permanently? This cannot be undone and linked time/items will return to unbilled.`}
              >
                Delete Invoice
              </ConfirmSubmitButton>
            </form>
          </section>
        </aside>
      </section>
    </main>
  );
}
