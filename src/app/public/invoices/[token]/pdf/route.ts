import { notFound } from "next/navigation";
import { pdfHeaders, publicInvoicePdfHeaders, renderPublicInvoicePdf } from "@/lib/invoice-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await renderPublicInvoicePdf(token);
  if (!result) notFound();

  return new Response(new Uint8Array(result.pdf), {
    headers: pdfHeaders(result.filename)
  });
}

export async function HEAD(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const headers = await publicInvoicePdfHeaders(token);
  if (!headers) notFound();

  return new Response(null, { headers });
}
