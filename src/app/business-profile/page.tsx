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
      <header>
        <p className="section-title">Business Profile</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">Invoice identity</h1>
        <p className="mt-2 max-w-2xl text-sm font-bold text-moss">
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
            replyToEmail: profile?.replyToEmail ?? "",
            themeAccent: profile?.themeAccent ?? "emerald",
            themeMode: profile?.themeMode ?? "system",
            signatureFooter: profile?.signatureFooter ?? ""
          }}
        />
      </section>
    </main>
  );
}
