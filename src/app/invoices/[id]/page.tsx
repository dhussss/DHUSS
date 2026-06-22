import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Banknote, RotateCcw, Send, Trash2, XCircle } from "lucide-react";
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

  const isSnapshotInvoice = invoice.status !== "DRAFT";
  const business = {
    name: (isSnapshotInvoice ? invoice.businessNameSnapshot : null) ?? profile?.tradingName ?? "Business profile not set",
    legalName: (isSnapshotInvoice ? invoice.businessLegalNameSnapshot : null) ?? profile?.legalName ?? null,
    abn: (isSnapshotInvoice ? invoice.businessAbnSnapshot : null) ?? profile?.abn ?? null,
    email: (isSnapshotInvoice ? invoice.businessEmailSnapshot : null) ?? profile?.email ?? null,
    phone: (isSnapshotInvoice ? invoice.businessPhoneSnapshot : null) ?? profile?.phone ?? null,
    address: (isSnapshotInvoice ? invoice.businessAddressSnapshot : null) ?? profile?.address ?? null,
    bankAccountName: (isSnapshotInvoice ? invoice.businessBankAccountNameSnapshot : null) ?? profile?.bankAccountName ?? null,
    bsb: (isSnapshotInvoice ? invoice.businessBsbSnapshot : null) ?? profile?.bsb ?? null,
    accountNumber: (isSnapshotInvoice ? invoice.businessAccountNumberSnapshot : null) ?? profile?.accountNumber ?? null,
    gstRegistered: (isSnapshotInvoice ? invoice.businessGstRegisteredSnapshot : null) ?? profile?.gstRegistered ?? false,
    gstRate: Number((isSnapshotInvoice ? invoice.businessGstRateSnapshot : null) ?? profile?.gstRate ?? 0),
    logoPath: (isSnapshotInvoice ? invoice.businessLogoPathSnapshot : null) ?? profile?.logoPath ?? null
  };
  const client = {
    businessName: (isSnapshotInvoice ? invoice.clientBusinessNameSnapshot : null) ?? invoice.client.businessName,
    contactName: (isSnapshotInvoice ? invoice.clientContactNameSnapshot : null) ?? invoice.client.contactName,
    email: (isSnapshotInvoice ? invoice.clientEmailSnapshot : null) ?? invoice.client.email,
    phone: (isSnapshotInvoice ? invoice.clientPhoneSnapshot : null) ?? invoice.client.phone,
    address: (isSnapshotInvoice ? invoice.clientAddressSnapshot : null) ?? invoice.client.address,
    abn: (isSnapshotInvoice ? invoice.clientAbnSnapshot : null) ?? invoice.client.abn
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
    businessName: business.name,
    clientName: client.contactName || client.businessName,
    total: formatMoney(invoice.grandTotalCents),
    dueDate,
    bankAccountName: business.bankAccountName,
    bsb: business.bsb,
    accountNumber: business.accountNumber
  });

  return (
    <main className="page-shell print-shell">
      <div className="no-print">
        <Link href="/invoices" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
          <ArrowLeft size={18} aria-hidden="true" />
          Invoices
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <article className="invoice-print rounded-lg border border-line bg-white p-5 shadow-soft sm:p-8">
          <header className="flex flex-col gap-6 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={`${business.name} logo`} className="h-20 w-20 rounded-lg border border-line bg-white object-contain" />
              ) : null}
              <div>
                <p className="section-title">{invoiceTitle}</p>
                <h1 className="mt-2 text-3xl font-black tracking-normal">{invoice.invoiceNumber}</h1>
                <div className="mt-3">
                  <p className="text-lg font-black">{business.name}</p>
                  {business.legalName ? <p className="text-sm font-bold text-moss">{business.legalName}</p> : null}
                  {business.abn ? <p className="text-sm font-bold text-moss">ABN {business.abn}</p> : null}
                </div>
              </div>
            </div>
            <div className="grid gap-2 text-left sm:text-right">
              <InvoiceStatusPill status={invoice.status} />
              <p className="text-3xl font-black">{formatMoney(invoice.grandTotalCents)}</p>
              <p className="text-sm font-bold text-moss">Due {formatDateAU(dueDate)}</p>
            </div>
          </header>

          <section className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase text-moss">From</p>
              <div className="mt-2 grid gap-1 text-sm font-bold">
                {business.address ? <p className="whitespace-pre-line">{business.address}</p> : null}
                {business.email ? <p>{business.email}</p> : null}
                {business.phone ? <p>{business.phone}</p> : null}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-moss">Bill to</p>
              <div className="mt-2 grid gap-1 text-sm font-bold">
                <p className="text-base font-black">{client.businessName}</p>
                {client.contactName ? <p>{client.contactName}</p> : null}
                {client.abn ? <p>ABN {client.abn}</p> : null}
                {client.address ? <p className="whitespace-pre-line">{client.address}</p> : null}
                {client.email ? <p>{client.email}</p> : null}
                {client.phone ? <p>{client.phone}</p> : null}
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-3 rounded-lg border border-line bg-paper/60 p-4 sm:grid-cols-4">
            <Detail label="Issue date" value={formatDateAU(invoice.invoiceDate)} />
            <Detail label="Due date" value={formatDateAU(dueDate)} />
            <Detail label="Project" value={invoice.project.title} />
            <Detail label="Work range" value={`${formatDateAU(invoice.dateRangeStart)} - ${formatDateAU(invoice.dateRangeEnd)}`} />
          </section>

          <section className="mt-7">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black tracking-normal">Line items</h2>
              <span className="status-pill border-line bg-paper text-moss">{invoice.mode.toLowerCase()}</span>
            </div>

            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-paper text-xs uppercase text-moss">
                  <tr>
                    <th className="p-3">Description</th>
                    <th className="hidden p-3 sm:table-cell">Qty/Hours</th>
                    <th className="hidden p-3 sm:table-cell">Rate</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.mode === "SIMPLE" && labourSubtotalCents > 0 ? (
                    <tr className="border-t border-line">
                      <td className="p-3">
                        <p className="font-bold">Labour for {invoice.project.title}</p>
                        <p className="text-xs font-bold text-moss">
                          {formatDateAU(invoice.dateRangeStart)} - {formatDateAU(invoice.dateRangeEnd)}
                        </p>
                      </td>
                      <td className="hidden p-3 font-bold text-moss sm:table-cell">{formatHours(totalDurationMinutes)}h</td>
                      <td className="hidden p-3 font-bold text-moss sm:table-cell">Included</td>
                      <td className="p-3 text-right font-black">{formatMoney(labourSubtotalCents)}</td>
                    </tr>
                  ) : null}

                  {invoice.mode === "DETAILED"
                    ? labourLines.map((line) => (
                        <InvoiceRow
                          key={line.id}
                          description={line.description}
                          detail={`${line.date ? formatDateAU(line.date) : "No date"}${line.notes ? ` - ${line.notes}` : ""}`}
                          quantity={`${formatHours(line.hoursMinutes ?? 0)}h`}
                          rate={`${formatMoney(line.unitAmountCents)}/h`}
                          total={formatMoney(line.totalAmountCents)}
                        />
                      ))
                    : null}

                  {expenseLines.map((line) => (
                    <InvoiceRow
                      key={line.id}
                      description={line.description}
                      detail={`${line.date ? formatDateAU(line.date) : "No date"}${line.notes ? ` - ${line.notes}` : ""}`}
                      quantity={`Qty ${Number(line.quantity ?? 0)}`}
                      rate={formatMoney(line.unitAmountCents)}
                      total={formatMoney(line.totalAmountCents)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 grid gap-5 sm:grid-cols-[1fr_18rem]">
            <div className="grid gap-4">
              {invoice.summary ? (
                <div>
                  <p className="text-xs font-bold uppercase text-moss">Notes</p>
                  <p className="mt-2 text-sm font-bold text-moss">{invoice.summary}</p>
                </div>
              ) : null}
              <div>
                <p className="text-xs font-bold uppercase text-moss">Payment details</p>
                <div className="mt-2 grid gap-1 text-sm font-bold">
                  {business.bankAccountName ? <p>Account name: {business.bankAccountName}</p> : null}
                  {business.bsb ? <p>BSB: {business.bsb}</p> : null}
                  {business.accountNumber ? <p>Account: {business.accountNumber}</p> : null}
                  <p>Payment terms: {invoice.paymentTermsDays} days</p>
                </div>
              </div>
            </div>

            <dl className="grid h-fit gap-3 rounded-lg border border-line bg-paper/70 p-4">
              <TotalLine label="Labour" value={formatMoney(labourSubtotalCents)} />
              <TotalLine label="Expenses" value={formatMoney(expensesSubtotalCents)} />
              <TotalLine label="Subtotal" value={formatMoney(subtotalCents)} />
              {business.gstRegistered ? <TotalLine label={`GST (${business.gstRate}%)`} value={formatMoney(invoice.gstCents)} /> : null}
              <div className="border-t border-line pt-3">
                <TotalLine label="Total payable" value={formatMoney(invoice.grandTotalCents)} strong />
              </div>
            </dl>
          </section>
        </article>

        <aside className="no-print grid h-fit gap-3">
          <section className="card">
            <p className="section-title">Actions</p>
            <div className="mt-4">
              <InvoiceExportActions invoiceText={invoiceText} emailText={emailText} />
            </div>
          </section>

          <section className="grid gap-2">
            <form action={markInvoiceSentAction}>
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <SubmitButton className="tap-primary w-full" pendingLabel="Marking sent..." disabled={invoice.status !== "DRAFT"}>
                <Send size={20} aria-hidden="true" />
                Mark Sent
              </SubmitButton>
            </form>
            <form action={markInvoicePaidAction}>
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <SubmitButton className="tap-primary w-full bg-mint hover:bg-ink" pendingLabel="Marking paid..." disabled={invoice.status === "PAID" || invoice.status === "VOID"}>
                <Banknote size={20} aria-hidden="true" />
                Mark Paid
              </SubmitButton>
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-moss">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

function InvoiceRow({
  description,
  detail,
  quantity,
  rate,
  total
}: {
  description: string;
  detail: string;
  quantity: string;
  rate: string;
  total: string;
}) {
  return (
    <tr className="border-t border-line">
      <td className="p-3">
        <p className="font-bold">{description}</p>
        <p className="text-xs font-bold text-moss">{detail}</p>
      </td>
      <td className="hidden p-3 font-bold text-moss sm:table-cell">{quantity}</td>
      <td className="hidden p-3 font-bold text-moss sm:table-cell">{rate}</td>
      <td className="p-3 text-right font-black">{total}</td>
    </tr>
  );
}

function TotalLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="font-bold text-moss">{label}</dt>
      <dd className={strong ? "text-xl font-black" : "font-black"}>{value}</dd>
    </div>
  );
}

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
  business: Record<string, string | number | boolean | null>;
  client: Record<string, string | null>;
  dueDate: Date;
  subtotalCents: number;
  totalDurationMinutes: number;
}) {
  const lines = [
    `${invoiceTitle} ${invoice.invoiceNumber}`,
    `From: ${business.name}`,
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
      lines.push(`- Labour for ${invoice.project.title}: ${formatHours(totalDurationMinutes)} hrs - ${formatMoney(invoice.labourTotalCents)}`);
    }
  } else {
    for (const line of invoice.lineItems.filter((item) => item.type === "LABOUR")) {
      lines.push(`- ${line.description}: ${formatHours(line.hoursMinutes ?? 0)} hrs at ${formatMoney(line.unitAmountCents)}/h - ${formatMoney(line.totalAmountCents)}`);
      if (line.notes) lines.push(`  ${line.notes}`);
    }
  }

  for (const line of invoice.lineItems.filter((item) => item.type === "EXPENSE")) {
    lines.push(`- ${line.description}: Qty ${Number(line.quantity ?? 0)} at ${formatMoney(line.unitAmountCents)} - ${formatMoney(line.totalAmountCents)}`);
    if (line.notes) lines.push(`  ${line.notes}`);
  }

  lines.push("", `Subtotal: ${formatMoney(subtotalCents)}`);
  if (invoice.gstCents > 0) lines.push(`GST: ${formatMoney(invoice.gstCents)}`);
  lines.push(`Total due: ${formatMoney(invoice.grandTotalCents)}`, "");

  if (business.bankAccountName || business.bsb || business.accountNumber) {
    lines.push("Payment details");
    if (business.bankAccountName) lines.push(`Account name: ${business.bankAccountName}`);
    if (business.bsb) lines.push(`BSB: ${business.bsb}`);
    if (business.accountNumber) lines.push(`Account: ${business.accountNumber}`);
  }

  return lines.filter(Boolean).join("\n");
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
    hoursMinutes: number | null;
    unitAmountCents: number;
    totalAmountCents: number;
    quantity: unknown;
    notes: string | null;
  }[];
};

function buildEmailText({
  invoiceNumber,
  businessName,
  clientName,
  total,
  dueDate,
  bankAccountName,
  bsb,
  accountNumber
}: {
  invoiceNumber: string;
  businessName: string;
  clientName: string;
  total: string;
  dueDate: Date;
  bankAccountName: string | null;
  bsb: string | null;
  accountNumber: string | null;
}) {
  return [
    `Subject: Invoice ${invoiceNumber} - ${businessName}`,
    "",
    `Hi ${clientName},`,
    "",
    `Please find invoice ${invoiceNumber} for ${total}, due ${formatDateAU(dueDate)}.`,
    "The invoice is attached or included below for your records.",
    "",
    "Payment details:",
    bankAccountName ? `Account name: ${bankAccountName}` : "",
    bsb ? `BSB: ${bsb}` : "",
    accountNumber ? `Account: ${accountNumber}` : "",
    "",
    "Thanks,",
    businessName
  ]
    .filter(Boolean)
    .join("\n");
}
