import { redirect } from "next/navigation";
import { BriefcaseBusiness } from "lucide-react";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { requireUser } from "@/lib/auth";
import { centsToDollars } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ review?: string }>;
}) {
  const [{ review }, user] = await Promise.all([searchParams, requireUser()]);
  const profile = await prisma.businessProfile.findUnique({
    where: { ownerId: user.id },
    select: {
      onboardingCompletedAt: true,
      businessStructure: true,
      tradingName: true,
      contactName: true,
      defaultHourlyRateCents: true,
      paymentTermsDays: true,
      gstRegistered: true,
      invoicePrefix: true
    }
  });

  if (profile?.onboardingCompletedAt && review !== "1") redirect("/");

  return (
    <main className="min-h-screen bg-paper px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto mb-6 flex w-full max-w-3xl items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-ink text-white shadow-soft">
          <BriefcaseBusiness size={19} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-black text-ink">Trade Invoice Tracker</p>
          <p className="text-xs font-semibold text-moss">Quick setup</p>
        </div>
      </div>
      <OnboardingWizard
        initialValues={{
          businessStructure: profile?.businessStructure ?? null,
          tradingName: profile?.tradingName ?? "",
          contactName: profile?.contactName ?? "",
          defaultHourlyRate: profile?.defaultHourlyRateCents ? centsToDollars(profile.defaultHourlyRateCents) : "",
          paymentTermsDays: profile?.paymentTermsDays ?? 14,
          gstRegistered: profile?.gstRegistered ?? false,
          invoicePrefix: profile?.invoicePrefix ?? "INV-"
        }}
      />
    </main>
  );
}
