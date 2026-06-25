import { SettingsForm } from "@/components/SettingsForm";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ownerId = await requireUserId();
  const profile = await prisma.businessProfile.findUnique({
    where: { ownerId },
    select: {
      taxSetAsideEnabled: true,
      customTaxPercentageOverride: true,
      includeGstInTaxEstimate: true,
      includeSuperInSetAsidePlanning: true,
      superPlanningEnabled: true,
      superContributionPercentage: true,
      superFundName: true,
      superMemberNumber: true,
      themeAccent: true,
      themeMode: true
    }
  });

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="section-title">Settings</p>
        <h1 className="page-title">App preferences</h1>
        <p className="page-subtitle">Theme, tax planning, and super estimate settings live here. Business and invoice identity stays in Business Profile.</p>
      </header>

      <section className="mt-6 max-w-4xl">
        <SettingsForm
          settings={{
            taxSetAsideEnabled: profile?.taxSetAsideEnabled ?? true,
            customTaxPercentageOverride: profile?.customTaxPercentageOverride ? String(Number(profile.customTaxPercentageOverride)) : "",
            includeGstInTaxEstimate: profile?.includeGstInTaxEstimate ?? false,
            includeSuperInSetAsidePlanning: profile?.includeSuperInSetAsidePlanning ?? false,
            superPlanningEnabled: profile?.superPlanningEnabled ?? false,
            superContributionPercentage: profile ? String(Number(profile.superContributionPercentage)) : "11.5",
            superFundName: profile?.superFundName ?? "",
            superMemberNumber: profile?.superMemberNumber ?? "",
            themeAccent: profile?.themeAccent ?? "emerald",
            themeMode: profile?.themeMode ?? "system"
          }}
        />
      </section>
    </main>
  );
}
