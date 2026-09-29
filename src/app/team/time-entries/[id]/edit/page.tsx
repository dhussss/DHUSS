import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { EditTimeEntryForm } from "@/components/EditTimeEntryForm";
import { requireUserId } from "@/lib/auth";
import { dateInputValue } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { formatHours } from "@/lib/time";
import { teamTimeEntryEditBlockReason } from "@/lib/payroll";

export const dynamic = "force-dynamic";

export default async function EditTeamTimeEntryPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const userId = await requireUserId();
  const entry = await prisma.timeEntry.findFirst({
    where: {
      id,
      teamMemberId: { not: null },
      OR: [
        { ownerId: userId },
        { createdByUserId: userId, teamMember: { userId } }
      ]
    },
    select: {
      id: true,
      ownerId: true,
      projectId: true,
      date: true,
      startTime: true,
      endTime: true,
      durationMinutes: true,
      notes: true,
      billingStatus: true,
      paymentStatus: true,
      workerDisplayNameSnapshot: true,
      teamMemberId: true,
      project: { select: { title: true, client: { select: { businessName: true } } } }
    }
  });
  if (!entry?.teamMemberId) notFound();

  const isOwner = entry.ownerId === userId;
  const fallback = isOwner ? `/team/${entry.teamMemberId}` : `/projects/${entry.projectId}`;
  const requestedReturnTo = typeof query?.returnTo === "string" && query.returnTo.startsWith("/") && !query.returnTo.startsWith("//")
    ? query.returnTo
    : fallback;
  const editBlockReason = teamTimeEntryEditBlockReason(entry);
  const canEdit = editBlockReason === null;

  return (
    <main className="page-shell">
      <Link href={requestedReturnTo} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Back
      </Link>
      <header className="page-header">
        <p className="section-title">Correct team hours</p>
        <h1 className="page-title">{entry.workerDisplayNameSnapshot || "Subcontractor"}</h1>
        <p className="page-subtitle">{entry.project.title} · {entry.project.client.businessName}</p>
      </header>

      <section className="mt-6 max-w-2xl">
        {canEdit ? (
          <>
            <div className="mb-4 rounded-lg border border-line bg-paper p-3 text-sm font-medium leading-6 text-moss">
              Correct the date, duration or notes. The agreed pay and client rates remain locked to the original entry.
            </div>
            <EditTimeEntryForm
              team
              returnTo={requestedReturnTo}
              entry={{
                id: entry.id,
                projectId: entry.projectId,
                dateValue: dateInputValue(entry.date),
                startTime: entry.startTime,
                endTime: entry.endTime,
                durationHours: formatHours(entry.durationMinutes),
                notes: entry.notes ?? ""
              }}
            />
          </>
        ) : (
          <div className="card flex items-start gap-3 text-sm font-bold text-moss">
            <LockKeyhole size={20} className="shrink-0 text-mint" aria-hidden="true" />
            <p>{editBlockReason === "billed" ? "These hours are already on an invoice. Unbill or void that invoice before correcting the source entry." : "These hours have been paid. Reverse the wage payment before correcting the source entry."}</p>
          </div>
        )}
      </section>
    </main>
  );
}
