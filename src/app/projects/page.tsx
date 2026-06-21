import Link from "next/link";
import { Archive, Plus, RotateCcw, Search } from "lucide-react";
import { unarchiveProjectAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { unbilledTimeValue } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";
import { ProjectStatusPill } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q.trim() : "";

  const searchWhere = q
    ? [
        { title: { contains: q } },
        { client: { businessName: { contains: q } } },
        { client: { contactName: { contains: q } } }
      ]
    : undefined;

  const [projects, archivedProjects] = await Promise.all([
    prisma.project.findMany({
      where: {
        status: "ACTIVE",
        OR: searchWhere
      },
      include: {
        client: true,
        timeEntries: { where: { billingStatus: "UNBILLED" } },
        expenseItems: { where: { billingStatus: "UNBILLED" } }
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.project.findMany({
      where: {
        status: "ARCHIVED",
        OR: searchWhere
      },
      include: {
        client: true,
        timeEntries: { where: { billingStatus: "UNBILLED" } },
        expenseItems: { where: { billingStatus: "UNBILLED" } }
      },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  return (
    <main className="page-shell">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-title">Projects</p>
          <h1 className="mt-2 text-3xl font-black tracking-normal">Active jobs</h1>
        </div>
        <Link href="/projects/new" className="tap-primary">
          <Plus size={20} aria-hidden="true" />
          Add New Project
        </Link>
      </header>

      <form className="mt-5 flex items-center gap-2 rounded-lg border border-line bg-white p-2">
        <Search size={20} className="ml-2 text-moss" aria-hidden="true" />
        <input
          className="min-h-10 border-0 bg-transparent p-2 shadow-none focus:shadow-none"
          name="q"
          defaultValue={q}
          placeholder="Search projects or clients"
        />
      </form>

      <section className="mt-5 grid gap-3 md:grid-cols-2">
        {projects.map((project) => {
          const unbilledMinutes = project.timeEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
          const unbilledValue =
            unbilledTimeValue(project.timeEntries) +
            project.expenseItems.reduce((sum, item) => sum + item.totalCostCents, 0);

          return (
            <Link key={project.id} href={`/projects/${project.id}`} className="card block transition hover:border-mint">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-normal">{project.title}</h2>
                  <p className="mt-1 text-sm font-bold text-moss">{project.client.businessName}</p>
                </div>
                <ProjectStatusPill status={project.status} />
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="font-bold text-moss">Rate</dt>
                  <dd className="mt-1 text-lg font-black">{formatMoney(project.currentHourlyRateCents)}/h</dd>
                </div>
                <div>
                  <dt className="font-bold text-moss">Unbilled hours</dt>
                  <dd className="mt-1 text-lg font-black">{formatHours(unbilledMinutes)}h</dd>
                </div>
                <div className="col-span-2 rounded-lg bg-paper p-3">
                  <dt className="font-bold text-moss">Unbilled value</dt>
                  <dd className="mt-1 text-2xl font-black">{formatMoney(unbilledValue)}</dd>
                </div>
              </dl>
            </Link>
          );
        })}
      </section>

      <section className="mt-9">
        <div className="mb-3 flex items-center gap-2">
          <Archive size={20} className="text-moss" aria-hidden="true" />
          <h2 className="text-xl font-black tracking-normal">Archived projects</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {archivedProjects.length ? (
            archivedProjects.map((project) => {
              const unbilledMinutes = project.timeEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
              const unbilledValue =
                unbilledTimeValue(project.timeEntries) +
                project.expenseItems.reduce((sum, item) => sum + item.totalCostCents, 0);

              return (
                <article key={project.id} className="card">
                  <Link href={`/projects/${project.id}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black tracking-normal">{project.title}</h3>
                        <p className="mt-1 text-sm font-bold text-moss">{project.client.businessName}</p>
                      </div>
                      <ProjectStatusPill status={project.status} />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="font-bold text-moss">Unbilled hours</dt>
                        <dd className="mt-1 text-lg font-black">{formatHours(unbilledMinutes)}h</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-moss">Unbilled value</dt>
                        <dd className="mt-1 text-lg font-black">{formatMoney(unbilledValue)}</dd>
                      </div>
                    </dl>
                  </Link>
                  <form action={unarchiveProjectAction} className="mt-4">
                    <input type="hidden" name="projectId" value={project.id} />
                    <button className="tap-secondary w-full" type="submit">
                      <RotateCcw size={20} aria-hidden="true" />
                      Unarchive Project
                    </button>
                  </form>
                </article>
              );
            })
          ) : (
            <article className="card text-sm font-bold text-moss">No archived projects.</article>
          )}
        </div>
      </section>
    </main>
  );
}
