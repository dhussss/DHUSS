import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail } from "lucide-react";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPreparedInvoiceEmailBody, invoiceDueDate, renderTemplate } from "@/lib/invoice-documents";
import type { InvoiceBusinessDetails, InvoiceClientDetails, InvoiceDocumentData } from "@/lib/invoice-documents";
import { formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { InvoiceStatusPill } from "@/components/StatusPill";
import { EmailComposer } from "@/components/EmailComposer";

export const dynamic = "force-dynamic";

export default async function InvoiceEmailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const business = businessDetails(invoice, profile);
  const client = clientDetails(invoice);
  const dueDate = invoiceDueDate(invoice);
  const canSend = invoice.status === "SENT" || invoice.status === "PAID";
  const fullPublicUrl = invoice.publicTokenEnabled && invoice.publicToken ? absoluteAppUrl(`/public/invoices/${invoice.publicToken}`) : null;
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
  const subject = renderTemplate(subjectTemplate, templateValues);
  const body = buildPreparedInvoiceEmailBody({
    invoice,
    business,
    client,
    publicUrl: fullPublicUrl,
    greeting: profile?.defaultEmailGreeting,
    intro: profile?.defaultEmailIntro,
    paymentLine: profile?.defaultEmailPaymentLine,
    signOff: profile?.defaultEmailSignOff,
    includePaymentDetails: profile?.includePaymentDetailsInEmail ?? false,
    includeInvoiceSummary: profile?.includeInvoiceSummaryInEmail ?? false,
    includePublicInvoiceLink: profile?.includePublicInvoiceLinkInEmail ?? true
  });
  const disabledReason = !canSend
    ? "Mark this invoice as sent before emailing it."
    : !client.email
      ? "Add an email address to this client before preparing the email."
      : "";

  return (
    <main className="page-shell">
      <div className="mb-5">
        <Link href={`/invoices/${invoice.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-mint">
          <ArrowLeft size={18} aria-hidden="true" />
          Invoice
        </Link>
      </div>

      <header className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-title">Email invoice</p>
          <h1 className="page-title">Prepare email</h1>
          <p className="mt-1 text-xl font-black tracking-normal">{invoice.invoiceNumber}</p>
          <p className="mt-1 text-sm font-bold text-moss">
            {invoice.project.title} - {client.businessName}
          </p>
        </div>
        <InvoiceStatusPill status={invoice.status} />
      </header>

      <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <EmailComposer invoiceId={invoice.id} initialTo={client.email ?? ""} initialSubject={subject} initialBody={body} disabledReason={disabledReason} />

        <aside className="grid gap-4">
          <section className="card">
            <p className="section-title">Invoice summary</p>
            <div className="mt-3 rounded-lg border border-mint/25 bg-mint/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-moss">Amount due</p>
              <p className="mt-1 text-3xl font-black tracking-normal text-ink">{formatMoney(invoice.grandTotalCents)}</p>
              <div className="mt-3">
                <InvoiceStatusPill status={invoice.status} />
              </div>
            </div>
            <dl className="mt-4 grid gap-3 text-sm font-bold">
              <SummaryLine label="Invoice" value={invoice.invoiceNumber} />
              <SummaryLine label="Client" value={client.businessName} />
              <SummaryLine label="Project" value={invoice.project.title} />
              <SummaryLine label="Due date" value={formatDateAU(dueDate)} />
              <SummaryLine label="Status" value={statusLabel(invoice.status)} />
            </dl>
          </section>

          <section className="card">
            <p className="section-title">Client link</p>
            {fullPublicUrl ? (
              <div className="mt-4 grid gap-3">
                <p className="rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm font-bold text-moss">
                  Public invoice link is active{profile?.includePublicInvoiceLinkInEmail ?? true ? " and will be included in the email." : ", but email inclusion is turned off in Business Profile."}
                </p>
                <Link href={fullPublicUrl} target="_blank" rel="noreferrer" className="tap-secondary w-full">
                  <ExternalLink size={18} aria-hidden="true" />
                  Open Link
                </Link>
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-line bg-paper p-3 text-sm font-bold text-moss">
                No active client link. The email stays short and plain text.
              </p>
            )}
          </section>

          <section className="card">
            <p className="section-title">Sender</p>
            <div className="mt-4 grid gap-2 text-sm font-bold text-moss">
              <p className="flex items-center gap-2 text-ink">
                <Mail size={18} aria-hidden="true" />
                Your email app
              </p>
              <p>The message opens in the signed-in device’s default mail app and sends from that user’s own email account.</p>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function SummaryLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line pb-2 last:border-b-0 last:pb-0">
      <dt className="text-moss">{label}</dt>
      <dd className={strong ? "text-lg font-black text-ink" : "text-right text-ink"}>{value}</dd>
    </div>
  );
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function appBaseUrl() {
  const configured = process.env.APP_BASE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const vercelUrl = process.env.VERCEL_URL?.replace(/\/$/, "");
  return vercelUrl ? `https://${vercelUrl}` : "";
}

function absoluteAppUrl(path: string) {
  const baseUrl = appBaseUrl();
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

function snapshot(frozen: boolean, frozenValue: string | null | undefined, liveValue: string | null | undefined) {
  return frozen ? frozenValue ?? liveValue ?? null : liveValue ?? null;
}

function businessDetails(
  invoice: InvoiceDocumentData & {
    businessNameSnapshot: string | null;
    businessLegalNameSnapshot: string | null;
    businessAbnSnapshot: string | null;
    businessContactNameSnapshot: string | null;
    businessEmailSnapshot: string | null;
    businessPhoneSnapshot: string | null;
    businessAddressSnapshot: string | null;
    businessWebsiteSnapshot: string | null;
    businessBankAccountNameSnapshot: string | null;
    businessBsbSnapshot: string | null;
    businessAccountNumberSnapshot: string | null;
    businessGstRegisteredSnapshot: boolean;
    businessGstRateSnapshot: unknown;
    businessLogoPathSnapshot: string | null;
    businessDefaultInvoiceNotesSnapshot: string | null;
    businessDefaultInvoiceEmailMessageSnapshot: string | null;
    businessSignatureFooterSnapshot: string | null;
  },
  profile: {
    tradingName: string;
    legalName: string | null;
    abn: string | null;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    website: string | null;
    bankAccountName: string | null;
    bsb: string | null;
    accountNumber: string | null;
    gstRegistered: boolean;
    gstRate: unknown;
    logoPath: string | null;
    defaultInvoiceNotes: string | null;
    defaultInvoiceEmailMessage: string | null;
    signatureFooter: string | null;
  } | null
): InvoiceBusinessDetails {
  const frozen = invoice.status !== "DRAFT";

  return {
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
}

function clientDetails(
  invoice: InvoiceDocumentData & {
    clientBusinessNameSnapshot: string | null;
    clientContactNameSnapshot: string | null;
    clientEmailSnapshot: string | null;
    clientPhoneSnapshot: string | null;
    clientAddressSnapshot: string | null;
    clientAbnSnapshot: string | null;
    client: {
      businessName: string;
      contactName: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      abn: string | null;
    };
  }
): InvoiceClientDetails {
  const frozen = invoice.status !== "DRAFT";

  return {
    businessName: snapshot(frozen, invoice.clientBusinessNameSnapshot, invoice.client.businessName) ?? invoice.client.businessName,
    contactName: snapshot(frozen, invoice.clientContactNameSnapshot, invoice.client.contactName),
    email: snapshot(frozen, invoice.clientEmailSnapshot, invoice.client.email),
    phone: snapshot(frozen, invoice.clientPhoneSnapshot, invoice.client.phone),
    address: snapshot(frozen, invoice.clientAddressSnapshot, invoice.client.address),
    abn: snapshot(frozen, invoice.clientAbnSnapshot, invoice.client.abn)
  };
}
