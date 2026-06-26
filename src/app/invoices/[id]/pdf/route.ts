import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { invoiceBusinessDetails, invoiceClientDetails, invoicePdfFileName } from "@/lib/invoice-data";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const logo = await loadLogoBuffer(business.logoPath);
  const pdf = await renderInvoicePdf({ invoice, business, client, logo });
  const filename = invoicePdfFileName(invoice.invoiceNumber);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}

async function loadLogoBuffer(logoPath: string | null) {
  if (!logoPath) return null;

  try {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("business-logos").createSignedUrl(logoPath, 60 * 5);
    if (!data?.signedUrl) return null;

    const response = await fetch(data.signedUrl);
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || (!contentType.includes("png") && !contentType.includes("jpeg") && !contentType.includes("jpg"))) {
      return null;
    }

    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}
