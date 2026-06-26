import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Banknote, ExternalLink, Link2, RefreshCcw, RotateCcw, Send, Trash2, XCircle } from "lucide-react";
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
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { EmailInvoiceButton } from "@/components/EmailInvoiceButton";
import { InvoiceDocumentView } from "@/components/InvoiceDocumentView";
import { CopyTextButton } from "@/components/InvoiceExportActions";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUserId } from "@/lib/auth";
import { invoiceBusinessDetails, invoiceClientDetails, invoicePdfFileName } from "@/lib/invoice-data";
import { buildPreparedInvoiceEmailBody, invoiceDueDate, renderTemplate } from "@/lib/invoice-documents";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerId = await requireUserId();
  const [invoice, profile] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id, ownerId },
      include: {
        project: { select: { title: true } },
        client: true,
        lineItems: { orderBy: { sortOrder: "asc" } }
      }
    }),
    prisma.businessProfile.findUnique({ where: { ownerId } })
  ]);

  if (!invoice) notFound();

  const business = invoiceBusinessDetails(invoice, profile);
  const client = invoiceClientDetails(invoice);
  let logoUrl: string | null = null;

  if (business.logoPath) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("business-logos").createSignedUrl(business.logoPath, 60 * 10);
    logoUrl = data?.signedUrl ?? null;
  }

  const finaliseWarnings = invoice.status === "DRAFT" ? invoiceWarnings(profile, client) : [];
  const confirmationMessage = finaliseWarnings.length
    ? `This invoice has warnings: ${finaliseWarnings.join(" ")} Continue anyway?`
    : "";
  const publicInvoicePath = invoice.publicToken ? `/public/invoices/${invoice.publicToken}` : null;
  const publicInvoiceUrl = invoice.publicTokenEnabled && publicInvoicePath ? absoluteAppUrl(publicInvoicePath) : null;
  const canSharePublicLink = invoice.status === "SENT" || invoice.status === "PAID";
  const pdfHref = `/invoices/${invoice.id}/pdf`;
  const pdfFileName = invoicePdfFileName(invoice.invoiceNumber);
  const dueDate = invoiceDueDate(invoice);
  const templateValues = {
    invoiceNumber: invoice.invoiceNumber,
    businessName: business.name,
    clientName: client.contactName || client.businessName,
    clientBusinessName: client.businessName,
    projectTitle: invoice.project.title,
    projectName: invoice.project.title,
    total: formatMoney(invoice.grandTotalCents),
    totalDue: formatMoney(invoice.grandTotalCents),
    amountDue: formatMoney(invoice.grandTotalCents),
    dueDate: formatEmailDate(dueDate),
    senderName: business.contactName || business.name
  };
  const subjectTemplate = profile?.defaultInvoiceEmailSubjectTemplate || "Invoice {{invoiceNumber}} from {{businessName}}";
  const emailSubject = renderTemplate(subjectTemplate, templateValues);
  const emailBody = buildPreparedInvoiceEmailBody({
    invoice,
    business,
    client,
    publicUrl: publicInvoiceUrl,
    greeting: profile?.defaultEmailGreeting,
    intro: profile?.defaultEmailIntro,
    paymentLine: profile?.defaultEmailPaymentLine,
    signOff: profile?.defaultEmailSignOff,
    includePaymentDetails: profile?.includePaymentDetailsInEmail ?? false,
    includeInvoiceSummary: profile?.includeInvoiceSummaryInEmail ?? false,
    includePublicInvoiceLink: profile?.includePublicInvoiceLinkInEmail ?? true
  });
  const emailDisabledReason = !client.email ? "Add an email address to this client before emailing the invoice." : "";
  const smsBody = buildInvoiceSmsBody({
    invoiceNumber: invoice.invoiceNumber,
    projectName: invoice.project.title,
    amountDue: formatMoney(invoice.grandTotalCents),
    dueDate: formatEmailDate(dueDate),
    businessName: business.name,
    publicInvoiceUrl
  });
  const smsDisabledReason = !client.phone ? "Add a phone number to this client before texting the invoice." : "";

  return (
    <main className="page-shell invoice-workspace">
      <div className="no-print mb-5">
        <Link href="/invoices" className="inline-flex items-center gap-2 text-sm font-bold text-mint">
          <ArrowLeft size={18} aria-hidden="true" />
          Invoices
        </Link>
      </div>

      <div className="invoice-layout grid gap-5 xl:grid-cols-[minmax(0,210mm)_20rem] xl:items-start xl:justify-center">
        <InvoiceDocumentView invoice={invoice} business={business} client={client} logoUrl={logoUrl} showStatus />

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
            <p className="section-title">Send workflow</p>
            <div className="mt-4 grid gap-2">
              <p className="text-sm font-bold text-moss">Open a prefilled email or SMS addressed to this client.</p>
              <EmailInvoiceButton
                invoiceId={invoice.id}
                pdfHref={pdfHref}
                pdfFileName={pdfFileName}
                to={client.email ?? ""}
                phone={client.phone ?? ""}
                subject={emailSubject}
                body={emailBody}
                smsBody={smsBody}
                disabledReason={emailDisabledReason}
                smsDisabledReason={smsDisabledReason}
              />
              <p className="rounded-lg border border-line bg-paper p-3 text-xs font-bold leading-5 text-moss">
                Email opens with To, Subject and Message filled in. Browsers cannot attach a PDF through mail links, so the PDF downloads for attaching if your mail app needs it.
              </p>
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
            <p className="section-title">2. Mark status</p>
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
                  Mark as Sent
                </ConfirmSubmitButton>
              ) : (
                <SubmitButton className="tap-primary w-full" pendingLabel="Marking sent..." disabled={invoice.status !== "DRAFT"}>
                  <Send size={20} aria-hidden="true" />
                  Mark as Sent
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

function absoluteAppUrl(path: string) {
  const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "") || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}` : "");
  return baseUrl ? `${baseUrl}${path}` : path;
}

function formatEmailDate(date: Date | string | number) {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(value);
}

function buildInvoiceSmsBody({
  invoiceNumber,
  projectName,
  amountDue,
  dueDate,
  businessName,
  publicInvoiceUrl
}: {
  invoiceNumber: string;
  projectName: string;
  amountDue: string;
  dueDate: string;
  businessName: string;
  publicInvoiceUrl: string | null;
}) {
  return [
    `${businessName}: Invoice ${invoiceNumber} for ${projectName}.`,
    `Amount due: ${amountDue}. Due date: ${dueDate}.`,
    publicInvoiceUrl ? `View invoice: ${publicInvoiceUrl}` : "Please refer to the invoice PDF for details."
  ].join(" ");
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
