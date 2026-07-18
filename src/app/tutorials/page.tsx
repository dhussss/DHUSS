import { BookOpenCheck, Route } from "lucide-react";
import { TutorialLibrary } from "@/components/TutorialLibrary";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function paramValue(params: SearchParams | undefined, key: string) {
  const value = params?.[key];
  return typeof value === "string" ? value : "";
}

export default async function TutorialsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = await searchParams;
  const ownerId = await requireUserId();
  const [profile, progress] = await Promise.all([
    prisma.businessProfile.findUnique({ where: { ownerId }, select: { businessStructure: true } }),
    prisma.tutorialProgress.findMany({
      where: { ownerId },
      select: { tutorialKey: true, status: true, currentStep: true, completedAt: true }
    })
  ]);
  const step = Math.max(0, Number(paramValue(params, "step") || "1") - 1);

  return (
    <main className="page-shell">
      <header className="page-header">
        <div className="flex items-center gap-2 text-moss"><BookOpenCheck size={20} aria-hidden="true" /><p className="section-title">Tutorials</p></div>
        <h1 className="page-title">Learn the whole workflow</h1>
        <p className="page-subtitle">Short, practical walkthroughs that explain what each area does, why it matters and how information moves through your business.</p>
      </header>
      <section className="mt-5 flex items-start gap-3 rounded-xl border border-mint/20 bg-mint/10 p-4 text-sm font-medium leading-6 text-moss">
        <Route className="mt-0.5 shrink-0 text-mint" size={20} aria-hidden="true" />
        <p><strong className="text-ink">New here?</strong> Start with “From first client to paid invoice”. It gives you the product model first, then the library lets you learn each workflow when you need it.</p>
      </section>
      <section className="mt-5">
        <TutorialLibrary
          showTeam={profile?.businessStructure === "EMPLOYER"}
          initialGuide={paramValue(params, "guide")}
          initialStep={Number.isFinite(step) ? step : 0}
          initialProgress={progress.map((item) => ({ ...item, completedAt: item.completedAt?.toISOString() ?? null }))}
        />
      </section>
    </main>
  );
}
