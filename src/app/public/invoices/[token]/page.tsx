import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { invoiceBusinessDetails, invoiceClientDetails } from "@/lib/invoice-data";
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
  const business = invoiceBusinessDetails(invoice, profile);
  const client = invoiceClientDetails(invoice);
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
