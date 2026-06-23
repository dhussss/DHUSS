import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Mail, Send } from "lucide-react";
import { sendInvoiceEmailAction } from "@/app/actions";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { defaultInvoiceEmailBody, invoiceDueDate, renderTemplate } from "@/lib/invoice-documents";
import type { InvoiceBusinessDetails, InvoiceClientDetails, InvoiceDocumentData } from "@/lib/invoice-documents";
import { formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { SubmitButton } from "@/components/SubmitButton";
import { InvoiceStatusPill } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function InvoiceEmailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const sent = query?.sent === "1";
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
  const providerReady = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
  const fullPublicUrl = invoice.publicTokenEnabled && invoice.publicToken ? absoluteAppUrl(`/public/invoices/${invoice.publicToken}`) : null;
  const canCreatePublicUrl = Boolean(appBaseUrl());
  const templateValues = {
    invoiceNumber: invoice.invoiceNumber,
    businessName: business.name,
    clientName: client.contactName || client.businessName,
    clientBusinessName: client.businessName,
    projectTitle: invoice.project.title,
    projectName: invoice.project.title,
    total: formatMoney(invoice.grandTotalCents),
    totalDue: formatMoney(invoice.grandTotalCents),
    dueDate: formatDateAU(dueDate)
  };
  const subjectTemplate = profile?.defaultInvoiceEmailSubjectTemplate || "Invoice {{invoiceNumber}} – {{businessName}}";
  const bodyTemplate = profile?.defaultInvoiceEmailBody || business.defaultInvoiceEmailMessage || defaultInvoiceEmailBody(invoice, business, client);
  const subject = renderTemplate(subjectTemplate, templateValues);
  const body = renderTemplate(bodyTemplate, templateValues);
  const disabledReason = !canSend
    ? "Mark this invoice as sent before emailing it."
    : !providerReady
      ? "Email provider settings are missing."
      : !client.email
        ? "Add an email address to this client before sending."
        : "";

  return (
    <main className="page-shell">
      <div className="mb-5">
        <Link href={`/invoices/${invoice.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-mint">
          <ArrowLeft size={18} aria-hidden="true" />
          Invoice
        </Link>
      </div>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-title">Email invoice</p>
          <h1 className="mt-2 text-3xl font-black tracking-normal">{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-sm font-bold text-moss">
            {invoice.project.title} - {client.businessName}
          </p>
        </div>
        <InvoiceStatusPill status={invoice.status} />
      </header>

      {sent ? (
        <section className="mt-5 rounded-lg border border-mint/30 bg-mint/10 p-4 text-sm font-bold text-moss">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} aria-hidden="true" />
            Invoice email sent.
          </div>
        </section>
      ) : null}

      {disabledReason ? (
        <section className="mt-5 rounded-lg border border-gum/30 bg-gum/10 p-4 text-sm font-bold text-gum">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} aria-hidden="true" />
            {disabledReason}
          </div>
        </section>
      ) : null}

      <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <form action={sendInvoiceEmailAction} className="card grid gap-4">
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              To
              <input name="to" type="email" defaultValue={client.email ?? ""} placeholder="client@example.com" required />
            </label>
            <label>
              CC
              <input name="cc" type="text" placeholder="optional@example.com" />
            </label>
          </div>
          <label>
            BCC
            <input name="bcc" type="text" placeholder="optional@example.com" />
          </label>
          <label>
            Subject
            <input name="subject" defaultValue={subject} required />
          </label>
          <label>
            Message
            <textarea name="message" defaultValue={body} rows={9} required />
          </label>

          <label className="flex min-h-12 grid-cols-[auto_1fr] items-center gap-3 rounded-lg border border-line bg-paper px-3 py-2 text-sm font-bold text-ink">
            <input
              name="includePublicLink"
              type="checkbox"
              defaultChecked={canSend && canCreatePublicUrl}
              disabled={!canSend || !canCreatePublicUrl}
              className="h-5 min-h-0 w-5"
            />
            Include secure client invoice link
          </label>

          <SubmitButton className="tap-primary w-full" pendingLabel="Sending..." disabled={Boolean(disabledReason)}>
            <Send size={20} aria-hidden="true" />
            Send Invoice Email
          </SubmitButton>
        </form>

        <aside className="grid gap-4">
          <section className="card">
            <p className="section-title">Invoice summary</p>
            <dl className="mt-4 grid gap-3 text-sm font-bold">
              <SummaryLine label="Client" value={client.businessName} />
              <SummaryLine label="Project" value={invoice.project.title} />
              <SummaryLine label="Due date" value={formatDateAU(dueDate)} />
              <SummaryLine label="Total" value={formatMoney(invoice.grandTotalCents)} strong />
              <SummaryLine label="Sent count" value={String(invoice.emailSendCount)} />
              {invoice.lastEmailedAt ? <SummaryLine label="Last emailed" value={formatDateAU(invoice.lastEmailedAt)} /> : null}
            </dl>
          </section>

          <section className="card">
            <p className="section-title">Client link</p>
            {fullPublicUrl ? (
              <Link href={fullPublicUrl} target="_blank" rel="noreferrer" className="tap-secondary mt-4 w-full">
                <ExternalLink size={18} aria-hidden="true" />
                Open Link
              </Link>
            ) : (
              <p className="mt-4 rounded-lg border border-line bg-paper p-3 text-sm font-bold text-moss">
                A link will be created when this email sends.
              </p>
            )}
          </section>

          <section className="card">
            <p className="section-title">Sender</p>
            <div className="mt-4 grid gap-2 text-sm font-bold text-moss">
              <p className="flex items-center gap-2 text-ink">
                <Mail size={18} aria-hidden="true" />
                {business.name}
              </p>
              {profile?.replyToEmail || profile?.email || business.email ? <p>Replies go to {profile?.replyToEmail || profile?.email || business.email}</p> : null}
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
