import { requireUserId } from "@/lib/auth";
import { getHoursExportData } from "@/lib/app-data";
import { HoursExportClient } from "@/components/HoursExportClient";
import { LearnHowLink } from "@/components/LearnHowLink";

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
  const ownerId = await requireUserId();
  const { projects, entries } = await getHoursExportData(ownerId);

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="section-title">Hours Export</p>
        <h1 className="page-title">Text report generator</h1>
        <p className="page-subtitle">Prepare a project and date-range report for payroll, client records or your accountant.</p>
        <LearnHowLink tutorialKey="exporting-hours" className="mt-2">Learn how Hours Export works</LearnHowLink>
      </header>

      <section className="mt-6 max-w-3xl">
        <HoursExportClient
          projects={projects.map((project) => ({
            id: project.id,
            title: project.title,
            client: project.client,
            unbilledMinutes: project.unbilledMinutes
          }))}
          defaultProjectId={paramValue(params, "projectId")}
          defaultStart={paramValue(params, "start") || paramValue(params, "dateRangeStart")}
          defaultEnd={paramValue(params, "end") || paramValue(params, "dateRangeEnd")}
          entries={entries.map((entry) => ({
            id: entry.id,
            projectId: entry.projectId,
            date: new Date(entry.date).toISOString(),
            durationMinutes: entry.durationMinutes,
            notes: entry.notes
          }))}
        />
      </section>
    </main>
  );
}
