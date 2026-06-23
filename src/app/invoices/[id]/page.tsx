import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Banknote, ExternalLink, Link2, Mail, RefreshCcw, RotateCcw, Send, Trash2, XCircle } from "lucide-react";
import {
  deleteInvoiceAction,
  enableInvoicePublicLinkAction,
  markInvoicePaidAction,
  markInvoiceSentAction,
  regenerateInvoicePublicLinkAction,
  revokeInvoicePublicLinkAction,
  unvoidInvoiceAction,
  voidInvoiceAction
} from "@/app/actions";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";
import { buildInvoicePlainText } from "@/lib/invoice-documents";
import { InvoiceStatusPill } from "@/components/StatusPill";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import { CopyTextButton, InvoiceExportActions } from "@/components/InvoiceExportActions";

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
  const labourLines = invoice.lineItems.filter((line) => line.type === "LABOUR");
  const expenseLines = invoice.lineItems.filter((line) => line.type === "EXPENSE");
  const invoiceTitle = business.gstRegistered ? "Tax Invoice" : "Invoice";
  const finaliseWarnings = invoice.status === "DRAFT" ? invoiceWarnings(profile, client) : [];
  const confirmationMessage = finaliseWarnings.length
    ? `This invoice has warnings: ${finaliseWarnings.join(" ")} Continue anyway?`
    : "";
  const publicInvoicePath = invoice.publicToken ? `/public/invoices/${invoice.publicToken}` : null;
  const publicInvoiceUrl = invoice.publicTokenEnabled && publicInvoicePath ? absoluteAppUrl(publicInvoicePath) : null;
  const canSharePublicLink = invoice.status === "SENT" || invoice.status === "PAID";

  const invoiceText = buildInvoicePlainText({
    invoice,
    business,
    client,
    publicUrl: publicInvoiceUrl
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
            <div className="mt-4 grid gap-2">
              <Link href={`/invoices/${invoice.id}/email`} className="tap-primary w-full">
                <Mail size={20} aria-hidden="true" />
                Prepare Email
              </Link>
              <InvoiceExportActions invoiceText={invoiceText} />
            </div>
          </section>

          <section className="card">
            <p className="section-title">Client invoice link</p>
            <div className="mt-4 grid gap-2">
              {publicInvoiceUrl ? (
                <>
                  <p className="break-all rounded-lg border border-line bg-paper p-3 text-xs font-bold text-moss">{publicInvoiceUrl}</p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    <CopyTextButton value={publicInvoiceUrl} label="Client link" copiedLabel="Client link copied.">
                      <Link2 size={18} aria-hidden="true" />
                      Copy Link
                    </CopyTextButton>
                    <Link href={publicInvoiceUrl} className="tap-secondary w-full" target="_blank" rel="noreferrer">
                      <ExternalLink size={18} aria-hidden="true" />
                      Open
                    </Link>
                  </div>
                  <form action={regenerateInvoicePublicLinkAction}>
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <ConfirmSubmitButton
                      className="tap-secondary w-full"
                      message="Regenerate this invoice link? The current client link will stop working."
                      pendingLabel="Regenerating..."
                      showDefaultIcon={false}
                    >
                      <RefreshCcw size={18} aria-hidden="true" />
                      Regenerate Link
                    </ConfirmSubmitButton>
                  </form>
                  <form action={revokeInvoicePublicLinkAction}>
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <ConfirmSubmitButton
                      className="tap-danger w-full"
                      message="Revoke this client invoice link? Anyone with the current link will lose access."
                      pendingLabel="Revoking..."
                      showDefaultIcon={false}
                    >
                      <XCircle size={18} aria-hidden="true" />
                      Revoke Link
                    </ConfirmSubmitButton>
                  </form>
                </>
              ) : canSharePublicLink ? (
                <form action={enableInvoicePublicLinkAction}>
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <SubmitButton className="tap-secondary w-full" pendingLabel="Creating link...">
                    <Link2 size={18} aria-hidden="true" />
                    Create Client Link
                  </SubmitButton>
                </form>
              ) : (
                <p className="rounded-lg border border-line bg-paper p-3 text-sm font-bold text-moss">
                  Mark this invoice as sent before creating a client link.
                </p>
              )}
              {invoice.publicTokenEnabled && !publicInvoiceUrl ? (
                <p className="rounded-lg border border-gum/30 bg-gum/10 p-3 text-sm font-bold text-gum">
                  Set APP_BASE_URL in production so the app can build full client invoice links.
                </p>
              ) : null}
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

function absoluteAppUrl(path: string) {
  const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "") || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}` : "");
  return baseUrl ? `${baseUrl}${path}` : path;
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
