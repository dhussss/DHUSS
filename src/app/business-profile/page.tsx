import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { centsToDollars } from "@/lib/money";
import { BusinessProfileForm } from "@/components/BusinessProfileForm";

export const dynamic = "force-dynamic";

export default async function BusinessProfilePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ownerId = await requireUserId();
  const profile = await prisma.businessProfile.findUnique({ where: { ownerId } });
  let logoUrl: string | null = null;

  if (profile?.logoPath) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("business-logos").createSignedUrl(profile.logoPath, 60 * 10);
    logoUrl = data?.signedUrl ?? null;
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="section-title">Business Profile</p>
        <h1 className="page-title">Invoice identity</h1>
        <p className="page-subtitle">
          These details are private to your account and will be used for your invoices.
        </p>
      </header>

      <section className="mt-6 max-w-4xl">
        <BusinessProfileForm
          logoUrl={logoUrl}
          saved={params?.saved === "1"}
          profile={{
            tradingName: profile?.tradingName ?? "",
            invoicePrefix: profile?.invoicePrefix ?? "INV-",
            legalName: profile?.legalName ?? "",
            abn: profile?.abn ?? "",
            acn: profile?.acn ?? "",
            contactName: profile?.contactName ?? "",
            email: profile?.email ?? "",
            phone: profile?.phone ?? "",
            address: profile?.address ?? "",
            website: profile?.website ?? "",
            defaultHourlyRate: profile?.defaultHourlyRateCents ? centsToDollars(profile.defaultHourlyRateCents) : "",
            gstRegistered: profile?.gstRegistered ?? false,
            gstRate: profile ? String(Number(profile.gstRate)) : "10",
            bankAccountName: profile?.bankAccountName ?? "",
            bsb: profile?.bsb ?? "",
            accountNumber: profile?.accountNumber ?? "",
            paymentTermsDays: profile?.paymentTermsDays ?? 14,
            defaultInvoiceNotes: profile?.defaultInvoiceNotes ?? "",
            defaultInvoiceEmailMessage: profile?.defaultInvoiceEmailMessage ?? "",
            defaultInvoiceEmailSubjectTemplate: profile?.defaultInvoiceEmailSubjectTemplate ?? "",
            defaultInvoiceEmailBody: profile?.defaultInvoiceEmailBody ?? "",
            defaultInvoiceGreeting: profile?.defaultInvoiceGreeting ?? "",
            defaultInvoiceBody: profile?.defaultInvoiceBody ?? "",
            defaultInvoiceSignOff: profile?.defaultInvoiceSignOff ?? "",
            defaultInvoiceFooter: profile?.defaultInvoiceFooter ?? "",
            defaultEmailGreeting: profile?.defaultEmailGreeting ?? "",
            defaultEmailIntro: profile?.defaultEmailIntro ?? "",
            defaultEmailPaymentLine: profile?.defaultEmailPaymentLine ?? "",
            defaultEmailSignOff: profile?.defaultEmailSignOff ?? "",
            includePaymentDetailsInEmail: profile?.includePaymentDetailsInEmail ?? false,
            includeInvoiceSummaryInEmail: profile?.includeInvoiceSummaryInEmail ?? false,
            includePublicInvoiceLinkInEmail: profile?.includePublicInvoiceLinkInEmail ?? true,
            replyToEmail: profile?.replyToEmail ?? "",
            signatureFooter: profile?.signatureFooter ?? ""
          }}
        />
      </section>
    </main>
  );
}
