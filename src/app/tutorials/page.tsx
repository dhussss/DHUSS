import { BookOpenCheck } from "lucide-react";
import { TutorialLibrary } from "@/components/TutorialLibrary";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TutorialsPage() {
  const ownerId = await requireUserId();
  const profile = await prisma.businessProfile.findUnique({ where: { ownerId }, select: { businessStructure: true } });

  return (
    <main className="page-shell">
      <header className="page-header">
        <div className="flex items-center gap-2 text-moss"><BookOpenCheck size={20} aria-hidden="true" /><p className="section-title">Tutorials</p></div>
        <h1 className="page-title">A quick guide when you need it</h1>
        <p className="page-subtitle">Choose a workflow for a short refresher, then jump directly into the relevant part of the app.</p>
      </header>
      <section className="mt-5"><TutorialLibrary showTeam={profile?.businessStructure === "EMPLOYER"} /></section>
    </main>
  );
}
