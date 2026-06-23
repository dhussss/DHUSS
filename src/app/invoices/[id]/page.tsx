import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Banknote, RotateCcw, Send, Trash2, XCircle } from "lucide-react";
import {
  deleteInvoiceAction,
  markInvoicePaidAction,
  markInvoiceSentAction,
  unvoidInvoiceAction,
  voidInvoiceAction
} from "@/app/actions";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";
import { InvoiceStatusPill } from "@/components/StatusPill";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import { InvoiceExportActions } from "@/components/InvoiceExportActions";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerId = await requireUserId();
  const [invoice, profile] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id, ownerId },
      include: {
        project: true,
        client: true,
        lineItems: { orderBy: { sortOrder: "asc" } }
      }
    }),
    prisma.businessProfile.findUnique({ where: { ownerId } })
  ]);

  if (!invoice) notFound();

  const frozen = invoice.status !== "DRAFT";
  const business = {
    name: snapshot(frozen, invoice.businessNameSnapshot, profile?.tradingName) ?? "Business profile not set",
    legalName: snapshot(frozen, invoice.businessLegalNameSnapshot, profile?.legalName),
    contactName: snapshot(frozen, invoice.businessContactNameSnapshot, profile?.contactName),
    abn: snapshot(frozen, invoice.businessAbnSnapshot, profile?.abn),
    email: snapshot(frozen, invoice.businessEmailSnapshot, profile?.email),
    phone: snapshot(frozen, invoice.businessPhoneSnapshot, profile?.phone),
    address: snapshot(frozen, invoice.businessAddressSnapshot, profile?.address),
    website: snapshot(frozen, invoice.businessWebsiteSnapshot, profile?.website),
    bankAccountName: snapshot(frozen, invoice.businessBankAccountNameSnapshot, profile?.bankAccountName),
    bsb: snapshot(frozen, invoice.businessBsbSnapshot, profile?.bsb),
    accountNumber: snapshot(frozen, invoice.businessAccountNumberSnapshot, profile?.accountNumber),
    gstRegistered: (frozen ? invoice.businessGstRegisteredSnapshot : null) ?? profile?.gstRegistered ?? false,
    gstRate: Number((frozen ? invoice.businessGstRateSnapshot : null) ?? profile?.gstRate ?? 0),
    logoPath: snapshot(frozen, invoice.businessLogoPathSnapshot, profile?.logoPath),
    defaultInvoiceNotes: snapshot(frozen, invoice.businessDefaultInvoiceNotesSnapshot, profile?.defaultInvoiceNotes),
    defaultInvoiceEmailMessage: snapshot(frozen, invoice.businessDefaultInvoiceEmailMessageSnapshot, profile?.defaultInvoiceEmailMessage),
    signatureFooter: snapshot(frozen, invoice.businessSignatureFooterSnapshot, profile?.signatureFooter)
  };
  const client = {
    businessName: snapshot(frozen, invoice.clientBusinessNameSnapshot, invoice.client.businessName) ?? invoice.client.businessName,
    contactName: snapshot(frozen, invoice.clientContactNameSnapshot, invoice.client.contactName),
    email: snapshot(frozen, invoice.clientEmailSnapshot, invoice.client.email),
    phone: snapshot(frozen, invoice.clientPhoneSnapshot, invoice.client.phone),
    address: snapshot(frozen, invoice.clientAddressSnapshot, invoice.client.address),
    abn: snapshot(frozen, invoice.clientAbnSnapshot, invoice.client.abn)
  };

  let logoUrl: string | null = null;
  if (business.logoPath) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("business-logos").createSignedUrl(business.logoPath, 60 * 10);
    logoUrl = data?.signedUrl ?? null;
  }

  const dueDate = invoice.dueDate ?? addDays(invoice.invoiceDate, invoice.paymentTermsDays);
  const labourSubtotalCents = invoice.labourTotalCents;
  const expensesSubtotalCents = invoice.expensesSubtotalCents || invoice.itemTotalCents;
  const subtotalCents = invoice.subtotalCents || labourSubtotalCents + expensesSubtotalCents;
  const totalDurationMinutes = invoice.totalDurationMinutes || Math.round(Number(invoice.totalHours) * 60);
  const labourLines = invoice.lineItems.filter((line) => line.type === "LABOUR");
  const expenseLines = invoice.lineItems.filter((line) => line.type === "EXPENSE");
  const invoiceTitle = business.gstRegistered ? "Tax Invoice" : "Invoice";
  const finaliseWarnings = invoice.status === "DRAFT" ? invoiceWarnings(profile, client) : [];
  const confirmationMessage = finaliseWarnings.length
    ? `This invoice has warnings: ${finaliseWarnings.join(" ")} Continue anyway?`
    : "";

  const invoiceText = buildInvoiceText({
    invoice,
    invoiceTitle,
    business,
    client,
    dueDate,
    subtotalCents,
    totalDurationMinutes
  });
  const emailText = buildEmailText({
    invoiceNumber: invoice.invoiceNumber,
    business,
    client,
    projectTitle: invoice.project.title,
    total: formatMoney(invoice.grandTotalCents),
    dueDate
  });

  return (
    <main className="page-shell invoice-workspace">
      <div className="no-print mb-5">
        <Link href="/invoices" className="inline-flex items-center gap-2 text-sm font-bold text-mint">
          <ArrowLeft size={18} aria-hidden="true" />
          Invoices
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,210mm)_20rem] xl:items-start xl:justify-center">
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
                <h1 className="mt-2 text-2xl font-black tracking-normal text-ink sm:text-3xl">{business.name}</h1>
                {business.legalName ? <p className="mt-1 text-sm font-bold text-moss">{business.legalName}</p> : null}
                {business.abn ? <p className="mt-1 text-sm font-bold text-moss">ABN {business.abn}</p> : null}
              </div>
            </div>

            <div className="grid gap-2 text-left sm:text-right">
              <div className="no-print sm:justify-self-end">
                <InvoiceStatusPill status={invoice.status} />
              </div>
              <p className="text-xs font-bold uppercase text-moss">Invoice number</p>
              <p className="text-3xl font-black tracking-normal text-ink">{invoice.invoiceNumber}</p>
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
                <h2 className="mt-1 text-xl font-black tracking-normal text-ink">{invoice.mode === "SIMPLE" ? "Simple invoice summary" : "Detailed work summary"}</h2>
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
                  {invoice.mode === "SIMPLE" && labourSubtotalCents > 0 ? (
                    <InvoiceRow
                      description={`Labour for ${invoice.project.title}`}
                      detail={`${formatDateAU(invoice.dateRangeStart)} - ${formatDateAU(invoice.dateRangeEnd)}`}
                      mutedDetail="Daily hours and hourly rates hidden for simple invoice mode."
                      amount={formatMoney(labourSubtotalCents)}
                    />
                  ) : null}

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

        <aside className="no-print grid h-fit gap-3">
          {finaliseWarnings.length ? (
            <section className="rounded-lg border border-gum/30 bg-gum/10 p-4 text-sm font-bold text-gum">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle size={18} aria-hidden="true" />
                Review before sending
              </div>
              <ul className="grid gap-1">
                {finaliseWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="card">
            <p className="section-title">Actions</p>
            <div className="mt-4">
              <InvoiceExportActions invoiceText={invoiceText} emailText={emailText} />
            </div>
          </section>

          <section className="grid gap-2">
            <form action={markInvoiceSentAction}>
              <input type="hidden" name="invoiceId" value={invoice.id} />
              {finaliseWarnings.length ? <input type="hidden" name="confirmIncomplete" value="on" /> : null}
              {finaliseWarnings.length ? (
                <ConfirmSubmitButton
                  className="tap-primary w-full"
                  message={confirmationMessage}
                  pendingLabel="Marking sent..."
                  disabled={invoice.status !== "DRAFT"}
                  showDefaultIcon={false}
                >
                  <Send size={20} aria-hidden="true" />
                  Mark Sent
                </ConfirmSubmitButton>
              ) : (
                <SubmitButton className="tap-primary w-full" pendingLabel="Marking sent..." disabled={invoice.status !== "DRAFT"}>
                  <Send size={20} aria-hidden="true" />
                  Mark Sent
                </SubmitButton>
              )}
            </form>
            <form action={markInvoicePaidAction}>
              <input type="hidden" name="invoiceId" value={invoice.id} />
              {finaliseWarnings.length ? <input type="hidden" name="confirmIncomplete" value="on" /> : null}
              {finaliseWarnings.length ? (
                <ConfirmSubmitButton
                  className="tap-primary w-full bg-mint hover:bg-ink"
                  message={confirmationMessage}
                  pendingLabel="Marking paid..."
                  disabled={invoice.status === "PAID" || invoice.status === "VOID"}
                  showDefaultIcon={false}
                >
                  <Banknote size={20} aria-hidden="true" />
                  Mark Paid
                </ConfirmSubmitButton>
              ) : (
                <SubmitButton className="tap-primary w-full bg-mint hover:bg-ink" pendingLabel="Marking paid..." disabled={invoice.status === "PAID" || invoice.status === "VOID"}>
                  <Banknote size={20} aria-hidden="true" />
                  Mark Paid
                </SubmitButton>
              )}
            </form>
            {invoice.status === "VOID" ? (
              <form action={unvoidInvoiceAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <SubmitButton className="tap-secondary w-full" pendingLabel="Restoring...">
                  <RotateCcw size={20} aria-hidden="true" />
                  Unvoid Invoice
                </SubmitButton>
              </form>
            ) : (
              <form action={voidInvoiceAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <SubmitButton className="tap-danger w-full" pendingLabel="Voiding...">
                  <XCircle size={20} aria-hidden="true" />
                  Void Invoice
                </SubmitButton>
              </form>
            )}

            <form action={deleteInvoiceAction}>
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <ConfirmSubmitButton
                className="tap-danger w-full"
                message={`Delete ${invoice.invoiceNumber} permanently? This cannot be undone and linked time/items will return to unbilled.`}
                pendingLabel="Deleting..."
                showDefaultIcon={false}
              >
                <Trash2 size={20} aria-hidden="true" />
                Delete Invoice
              </ConfirmSubmitButton>
            </form>
          </section>
        </aside>
      </div>
    </main>
  );
}

function snapshot(frozen: boolean, frozenValue: string | null | undefined, liveValue: string | null | undefined) {
  return frozen ? frozenValue ?? liveValue ?? null : liveValue ?? null;
}

function invoiceWarnings(
  profile: {
    tradingName: string;
    abn: string | null;
    gstRegistered: boolean;
    bankAccountName: string | null;
    bsb: string | null;
    accountNumber: string | null;
  } | null,
  client: { email: string | null }
) {
  if (!profile) return ["Business profile is missing."];

  return [
    !profile.abn ? "Business ABN is missing." : "",
    profile.gstRegistered && !profile.abn ? "GST is enabled but ABN is missing." : "",
    !profile.bankAccountName || !profile.bsb || !profile.accountNumber ? "Bank payment details are incomplete." : "",
    !client.email ? "Client email is missing." : ""
  ].filter(Boolean);
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
      <td className="text-right font-black text-ink">{amount}</td>
    </tr>
  );
}

function TotalLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? "font-black text-ink" : "font-bold text-moss"}>{label}</dt>
      <dd className={strong ? "text-2xl font-black text-ink" : "font-black text-ink"}>{value}</dd>
    </div>
  );
}

type InvoiceTextSource = {
  invoiceNumber: string;
  project: { title: string };
  dateRangeStart: Date;
  dateRangeEnd: Date;
  invoiceDate: Date;
  mode: "SIMPLE" | "DETAILED";
  labourTotalCents: number;
  gstCents: number;
  grandTotalCents: number;
  lineItems: {
    type: "LABOUR" | "EXPENSE";
    description: string;
    date: Date | null;
    hoursMinutes: number | null;
    unitAmountCents: number;
    totalAmountCents: number;
    quantity: unknown;
    notes: string | null;
  }[];
};

type ExportBusiness = {
  name: string;
  contactName: string | null;
  abn: string | null;
  bankAccountName: string | null;
  bsb: string | null;
  accountNumber: string | null;
  defaultInvoiceEmailMessage: string | null;
};

type ExportClient = {
  businessName: string;
  contactName: string | null;
};

function buildInvoiceText({
  invoice,
  invoiceTitle,
  business,
  client,
  dueDate,
  subtotalCents,
  totalDurationMinutes
}: {
  invoice: InvoiceTextSource;
  invoiceTitle: string;
  business: ExportBusiness;
  client: ExportClient;
  dueDate: Date;
  subtotalCents: number;
  totalDurationMinutes: number;
}) {
  const lines = [
    `${invoiceTitle} ${invoice.invoiceNumber}`,
    `Business: ${business.name}`,
    business.abn ? `ABN: ${business.abn}` : "",
    `Client: ${client.businessName}`,
    `Project: ${invoice.project.title}`,
    `Date range: ${formatDateAU(invoice.dateRangeStart)} - ${formatDateAU(invoice.dateRangeEnd)}`,
    `Issue date: ${formatDateAU(invoice.invoiceDate)}`,
    `Due date: ${formatDateAU(dueDate)}`,
    "",
    "Line items"
  ];

  if (invoice.mode === "SIMPLE") {
    if (invoice.labourTotalCents > 0) {
      lines.push(`- Labour for ${invoice.project.title}: ${formatMoney(invoice.labourTotalCents)}`);
      lines.push(`  ${formatDateAU(invoice.dateRangeStart)} - ${formatDateAU(invoice.dateRangeEnd)}`);
    }
  } else {
    for (const line of invoice.lineItems.filter((item) => item.type === "LABOUR")) {
      lines.push(
        `- ${line.date ? formatDateAU(line.date) : line.description}: ${formatHours(line.hoursMinutes ?? 0)} hrs at ${formatMoney(line.unitAmountCents)}/h - ${formatMoney(line.totalAmountCents)}`
      );
      if (line.notes) lines.push(`  ${line.notes}`);
    }
  }

  for (const line of invoice.lineItems.filter((item) => item.type === "EXPENSE")) {
    lines.push(`- ${line.description}: Qty ${Number(line.quantity ?? 0)} at ${formatMoney(line.unitAmountCents)} - ${formatMoney(line.totalAmountCents)}`);
    if (line.notes) lines.push(`  ${line.notes}`);
  }

  lines.push("", `Labour: ${formatMoney(invoice.labourTotalCents)}`);
  const expenseTotal = subtotalCents - invoice.labourTotalCents;
  if (expenseTotal > 0) lines.push(`Expenses/materials: ${formatMoney(expenseTotal)}`);
  lines.push(`Subtotal: ${formatMoney(subtotalCents)}`);
  if (invoice.gstCents > 0) lines.push(`GST: ${formatMoney(invoice.gstCents)}`);
  lines.push(`Total due: ${formatMoney(invoice.grandTotalCents)}`, `Payment reference: ${invoice.invoiceNumber}`, "");

  if (business.bankAccountName || business.bsb || business.accountNumber) {
    lines.push("Payment details");
    if (business.bankAccountName) lines.push(`Account name: ${business.bankAccountName}`);
    if (business.bsb) lines.push(`BSB: ${business.bsb}`);
    if (business.accountNumber) lines.push(`Account: ${business.accountNumber}`);
  }

  if (invoice.mode === "SIMPLE" && totalDurationMinutes > 0) {
    lines.push("", "Simple invoice mode hides daily/hourly labour detail.");
  }

  return lines.filter(Boolean).join("\n");
}

function buildEmailText({
  invoiceNumber,
  business,
  client,
  projectTitle,
  total,
  dueDate
}: {
  invoiceNumber: string;
  business: ExportBusiness;
  client: ExportClient;
  projectTitle: string;
  total: string;
  dueDate: Date;
}) {
  const greetingName = client.contactName || client.businessName;
  const customMessage = business.defaultInvoiceEmailMessage?.trim();

  return [
    `Subject: Invoice ${invoiceNumber} - ${business.name}`,
    "",
    `Hi ${greetingName},`,
    "",
    customMessage || `Please find invoice ${invoiceNumber} for work completed on ${projectTitle}.`,
    "",
    `Invoice number: ${invoiceNumber}`,
    `Project: ${projectTitle}`,
    `Total amount due: ${total}`,
    `Due date: ${formatDateAU(dueDate)}`,
    "",
    "Payment details:",
    business.bankAccountName ? `Account name: ${business.bankAccountName}` : "",
    business.bsb ? `BSB: ${business.bsb}` : "",
    business.accountNumber ? `Account: ${business.accountNumber}` : "",
    `Payment reference: ${invoiceNumber}`,
    "",
    "The invoice is attached or included below for your records.",
    "",
    "Thanks,",
    business.contactName || business.name
  ]
    .filter(Boolean)
    .join("\n");
}
