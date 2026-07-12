import type { ReactNode } from "react";
import { formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";
import { invoiceDueDate, invoiceSubtotals } from "@/lib/invoice-documents";
import type { InvoiceBusinessDetails, InvoiceClientDetails, InvoiceDocumentData } from "@/lib/invoice-documents";
import { InvoiceStatusPill } from "@/components/StatusPill";

export function InvoiceDocumentView({
  invoice,
  business,
  client,
  logoUrl,
  showStatus = false
}: {
  invoice: InvoiceDocumentData;
  business: InvoiceBusinessDetails;
  client: InvoiceClientDetails;
  logoUrl?: string | null;
  showStatus?: boolean;
}) {
  const dueDate = invoiceDueDate(invoice);
  const { labourSubtotalCents, expensesSubtotalCents, subtotalCents } = invoiceSubtotals(invoice);
  const labourLines = invoice.lineItems.filter((line) => line.type === "LABOUR");
  const expenseLines = invoice.lineItems.filter((line) => line.type === "EXPENSE");
  const invoiceTitle = business.gstRegistered ? "Tax Invoice" : "Invoice";
  const simpleLabourGroups = labourLines.reduce((groups, line) => {
    const worker = line.workerNameSnapshot || "Owner";
    const current = groups.get(worker) || { minutes: 0, totalCents: 0 };
    current.minutes += line.hoursMinutes || 0;
    current.totalCents += line.totalAmountCents;
    groups.set(worker, current);
    return groups;
  }, new Map<string, { minutes: number; totalCents: number }>());

  return (
    <article className="invoice-sheet invoice-print">
      <header className="invoice-header">
        <div className="flex min-w-0 items-start gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={`${business.name} logo`} className="h-20 w-20 rounded-md border border-line bg-white object-contain print:h-16 print:w-16" />
          ) : (
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-md border border-line bg-paper text-xl font-black text-moss print:h-16 print:w-16">
              {business.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-mint">{invoiceTitle}</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">{business.name}</h1>
            {business.legalName ? <p className="mt-1 text-sm font-bold text-moss">{business.legalName}</p> : null}
            {business.abn ? <p className="mt-1 text-sm font-bold text-moss">ABN {business.abn}</p> : null}
          </div>
        </div>

        <div className="grid gap-2 text-left sm:text-right">
          {showStatus ? (
            <div className="no-print sm:justify-self-end">
              <InvoiceStatusPill status={invoice.status} />
            </div>
          ) : null}
          <p className="text-xs font-bold uppercase text-moss">Invoice number</p>
          <p className="text-3xl font-black tracking-tight text-ink">{invoice.invoiceNumber}</p>
          <p className="text-sm font-bold text-moss">Issued {formatDateAU(invoice.invoiceDate)}</p>
        </div>
      </header>

      <section className="invoice-address-grid">
        <InfoBlock title="From">
          <strong>{business.name}</strong>
          {business.contactName ? <span>{business.contactName}</span> : null}
          {business.address ? <span className="whitespace-pre-line">{business.address}</span> : null}
          {business.email ? <span>{business.email}</span> : null}
          {business.phone ? <span>{business.phone}</span> : null}
          {business.website ? <span>{business.website}</span> : null}
        </InfoBlock>

        <InfoBlock title="Bill To">
          <strong>{client.businessName}</strong>
          {client.contactName ? <span>{client.contactName}</span> : null}
          {client.abn ? <span>ABN {client.abn}</span> : null}
          {client.address ? <span className="whitespace-pre-line">{client.address}</span> : null}
          {client.email ? <span>{client.email}</span> : null}
          {client.phone ? <span>{client.phone}</span> : null}
        </InfoBlock>
      </section>

      <section className="invoice-meta-grid">
        <Detail label="Issue date" value={formatDateAU(invoice.invoiceDate)} />
        <Detail label="Due date" value={formatDateAU(dueDate)} />
        <Detail label="Project" value={invoice.project.title} />
        <Detail label="Work period" value={`${formatDateAU(invoice.dateRangeStart)} - ${formatDateAU(invoice.dateRangeEnd)}`} />
        <Detail label="Terms" value={`${invoice.paymentTermsDays} days`} />
        <Detail label="Reference" value={invoice.invoiceNumber} />
      </section>

      <section className="invoice-lines-section">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-moss">Line items</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-ink">{invoice.mode === "SIMPLE" ? "Invoice summary" : "Detailed work summary"}</h2>
          </div>
          <span className="status-pill border-line bg-paper text-moss">{invoice.mode.toLowerCase()}</span>
        </div>

        <div className="invoice-table-wrap">
          <table className="invoice-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Details</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.mode === "SIMPLE"
                ? [...simpleLabourGroups.entries()].map(([worker, summary]) => (
                    <InvoiceRow key={worker} description={`${worker} - labour`} detail={`${formatHours(summary.minutes)}h for ${invoice.project.title}`} amount={formatMoney(summary.totalCents)} />
                  ))
                : null}

              {invoice.mode === "DETAILED"
                ? labourLines.map((line) => (
                    <InvoiceRow
                      key={line.id}
                      description={line.description}
                      detail={`${line.date ? formatDateAU(line.date) : "No date"} - ${formatHours(line.hoursMinutes ?? 0)}h at ${formatMoney(line.unitAmountCents)}/h`}
                      mutedDetail={line.notes}
                      amount={formatMoney(line.totalAmountCents)}
                    />
                  ))
                : null}

              {expenseLines.length ? (
                <tr className="invoice-section-row">
                  <td colSpan={3}>Expenses and materials</td>
                </tr>
              ) : null}

              {expenseLines.map((line) => (
                <InvoiceRow
                  key={line.id}
                  description={line.description}
                  detail={`${line.date ? formatDateAU(line.date) : "No date"} - Qty ${Number(line.quantity ?? 0)} at ${formatMoney(line.unitAmountCents)}`}
                  mutedDetail={line.notes}
                  amount={formatMoney(line.totalAmountCents)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="invoice-totals-section">
        <div className="invoice-note-box">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-moss">Notes</p>
          <p className="mt-2 text-sm font-bold text-ink">
            {business.defaultInvoiceNotes || "Thank you for your business. Please use the invoice number as the payment reference."}
          </p>
          {business.signatureFooter ? <p className="mt-3 text-sm font-bold text-moss">{business.signatureFooter}</p> : null}
        </div>

        <dl className="invoice-total-card">
          <TotalLine label="Labour subtotal" value={formatMoney(labourSubtotalCents)} />
          <TotalLine label="Expenses subtotal" value={formatMoney(expensesSubtotalCents)} />
          <TotalLine label="Subtotal" value={formatMoney(subtotalCents)} />
          {business.gstRegistered ? <TotalLine label={`GST (${business.gstRate}%)`} value={formatMoney(invoice.gstCents)} /> : null}
          <div className="mt-2 border-t border-line pt-3">
            <TotalLine label="Total amount due" value={formatMoney(invoice.grandTotalCents)} strong />
          </div>
        </dl>
      </section>

      <footer className="invoice-footer">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-moss">Payment details</p>
          <div className="mt-3 grid gap-1 text-sm font-bold text-ink">
            {business.bankAccountName ? <p>Account name: {business.bankAccountName}</p> : null}
            {business.bsb ? <p>BSB: {business.bsb}</p> : null}
            {business.accountNumber ? <p>Account: {business.accountNumber}</p> : null}
            <p>Payment reference: {invoice.invoiceNumber}</p>
          </div>
        </div>
        <div className="rounded-md bg-white/75 p-4 text-sm font-bold text-ink">
          <p>Payment is due by {formatDateAU(dueDate)}.</p>
          <p className="mt-1 text-moss">Thank you for choosing {business.name}.</p>
        </div>
      </footer>
    </article>
  );
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="invoice-info-block">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-moss">{title}</p>
      <div className="mt-3 grid gap-1 text-sm font-bold text-ink">{children}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-moss">{label}</p>
      <p className="mt-1 text-sm font-black text-ink">{value}</p>
    </div>
  );
}

function InvoiceRow({
  description,
  detail,
  mutedDetail,
  amount
}: {
  description: string;
  detail: string;
  mutedDetail?: string | null;
  amount: string;
}) {
  return (
    <tr>
      <td>
        <p className="font-black text-ink">{description}</p>
        {mutedDetail ? <p className="mt-1 text-xs font-bold text-moss">{mutedDetail}</p> : null}
      </td>
      <td className="font-bold text-moss">{detail}</td>
      <td className="text-right font-black tabular-nums text-ink">{amount}</td>
    </tr>
  );
}

function TotalLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? "font-black text-ink" : "font-bold text-moss"}>{label}</dt>
      <dd className={strong ? "text-2xl font-black tabular-nums text-ink" : "font-black tabular-nums text-ink"}>{value}</dd>
    </div>
  );
}
