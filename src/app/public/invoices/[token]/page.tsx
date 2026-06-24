import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceBusinessDetails, InvoiceClientDetails, InvoiceDocumentData } from "@/lib/invoice-documents";
import { InvoiceDocumentView } from "@/components/InvoiceDocumentView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invoice",
  robots: {
    index: false,
    follow: false
  }
};

export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: {
      publicToken: token,
      publicTokenEnabled: true,
      status: { in: ["SENT", "PAID"] }
    },
    include: {
      project: { select: { title: true } },
      client: true,
      lineItems: { orderBy: { sortOrder: "asc" } }
    }
  });

  if (!invoice) notFound();

  const profile = invoice.ownerId
    ? await prisma.businessProfile.findUnique({
        where: { ownerId: invoice.ownerId }
      })
    : null;
  const business = businessDetails(invoice, profile);
  const client = clientDetails(invoice);
  let logoUrl: string | null = null;

  if (business.logoPath) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("business-logos").createSignedUrl(business.logoPath, 60 * 10);
    logoUrl = data?.signedUrl ?? null;
  }

  return (
    <main className="invoice-workspace print-shell min-h-screen px-4 py-6 print:p-0">
      <InvoiceDocumentView invoice={invoice} business={business} client={client} logoUrl={logoUrl} />
    </main>
  );
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
