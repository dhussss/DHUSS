import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { dateInputValue } from "@/lib/dates";
import { formatHours } from "@/lib/time";
import { EditTimeEntryForm } from "@/components/EditTimeEntryForm";

export const dynamic = "force-dynamic";

export default async function EditTimeEntryPage({
  params
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId } = await params;
  const entry = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    include: {
      project: {
        include: { client: true }
      }
    }
  });

  if (!entry || entry.projectId !== id) notFound();

  return (
    <main className="page-shell">
      <Link href={`/projects/${id}`} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Project
      </Link>

      <header>
        <p className="section-title">Edit hours</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">{entry.project.title}</h1>
        <p className="mt-1 font-bold text-moss">{entry.project.client.businessName}</p>
      </header>

      <section className="mt-6 max-w-2xl">
        {entry.billingStatus === "UNBILLED" ? (
          <EditTimeEntryForm
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
        ) : (
          <article className="card text-sm font-bold text-moss">
            This time entry has already been billed, so it cannot be edited from the project log.
          </article>
        )}
      </section>
    </main>
  );
}
