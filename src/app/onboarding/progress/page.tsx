import { redirect } from "next/navigation";
import { BriefcaseBusiness, Check, Clock3, FileText, FolderKanban, UserRound } from "lucide-react";
import { finishOnboardingAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUserId } from "@/lib/auth";
import { dateInputValue } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OnboardingProgressPage() {
  const ownerId = await requireUserId();
  const [profile, client, project, timeEntry, invoice] = await Promise.all([
    prisma.businessProfile.findUnique({
      where: { ownerId },
      select: { businessStructure: true, onboardingCompletedAt: true }
    }),
    prisma.client.findFirst({ where: { ownerId }, select: { id: true }, orderBy: { createdAt: "asc" } }),
    prisma.project.findFirst({ where: { ownerId }, select: { id: true }, orderBy: { createdAt: "asc" } }),
    prisma.timeEntry.findFirst({ where: { ownerId }, select: { projectId: true, date: true }, orderBy: { createdAt: "desc" } }),
    prisma.invoice.findFirst({ where: { ownerId }, select: { id: true }, orderBy: { createdAt: "desc" } })
  ]);

  if (profile?.onboardingCompletedAt) redirect("/");
  if (!profile?.businessStructure) redirect("/onboarding");
  if (!client) redirect("/clients/new?onboarding=1");
  if (!project) redirect(`/projects/new?onboarding=1&clientId=${client.id}`);
  if (!timeEntry) redirect(`/projects/${project.id}?onboarding=1`);
  if (!invoice) {
    const date = dateInputValue(timeEntry.date);
    redirect(`/invoices/new?onboarding=1&projectId=${timeEntry.projectId}&dateRangeStart=${date}&dateRangeEnd=${date}`);
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-ink text-white shadow-soft"><BriefcaseBusiness size={19} aria-hidden="true" /></span>
          <div><p className="text-sm font-black text-ink">Trade Invoice Tracker</p><p className="text-xs font-semibold text-moss">Guided setup</p></div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-lift">
          <div className="p-5 text-center sm:p-8">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-mint text-white shadow-soft"><Check size={28} aria-hidden="true" /></span>
            <p className="section-title mt-5">First workflow complete</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">You have done the whole job flow</h1>
            <p className="mx-auto mt-3 max-w-lg text-sm font-medium leading-6 text-moss">Your invoice is still a draft, so nothing has been sent. You can now use the app normally and revisit any guide from More.</p>

            <div className="mx-auto mt-6 grid max-w-lg gap-2 text-left">
              <CompletedLine icon={UserRound} text="Created a client" />
              <CompletedLine icon={FolderKanban} text="Created a project" />
              <CompletedLine icon={Clock3} text="Logged real work" />
              <CompletedLine icon={FileText} text="Created an invoice draft" />
            </div>
          </div>
          <form action={finishOnboardingAction} className="border-t border-line bg-paper/50 p-4 sm:px-8 sm:py-5">
            <SubmitButton className="tap-primary w-full" pendingLabel="Opening your dashboard...">Open my dashboard<Check size={18} aria-hidden="true" /></SubmitButton>
          </form>
        </section>
      </div>
    </main>
  );
}

function CompletedLine({ icon: Icon, text }: { icon: typeof UserRound; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-paper/40 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-mint/10 text-mint"><Icon size={18} aria-hidden="true" /></span>
      <span className="text-sm font-black text-ink">{text}</span>
      <Check className="ml-auto text-mint" size={18} aria-hidden="true" />
    </div>
  );
}
