import { prisma } from "@/lib/prisma";
import { HoursExportClient } from "@/components/HoursExportClient";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function paramValue(params: SearchParams | undefined, key: string) {
  const value = params?.[key];
  return typeof value === "string" ? value : "";
}

export default async function HoursExportPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [projects, entries] = await Promise.all([
    prisma.project.findMany({
      where: { status: "ACTIVE" },
      include: {
        client: true,
        timeEntries: { where: { billingStatus: "UNBILLED" } }
      },
      orderBy: { title: "asc" }
    }),
    prisma.timeEntry.findMany({
      orderBy: { date: "asc" }
    })
  ]);

  return (
    <main className="page-shell">
      <header>
        <p className="section-title">Hours Export</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">Text report generator</h1>
      </header>

      <section className="mt-6 max-w-3xl">
        <HoursExportClient
          projects={projects.map((project) => ({
            id: project.id,
            title: project.title,
            client: project.client.businessName,
            unbilledMinutes: project.timeEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0)
          }))}
          defaultProjectId={paramValue(params, "projectId")}
          defaultStart={paramValue(params, "start") || paramValue(params, "dateRangeStart")}
          defaultEnd={paramValue(params, "end") || paramValue(params, "dateRangeEnd")}
          entries={entries.map((entry) => ({
            id: entry.id,
            projectId: entry.projectId,
            date: entry.date.toISOString(),
            durationMinutes: entry.durationMinutes,
            notes: entry.notes
          }))}
        />
      </section>
    </main>
  );
}
