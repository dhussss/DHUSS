import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Archive, BriefcaseBusiness, Plus, RotateCcw, Search } from "lucide-react";
import { unarchiveProjectAction } from "@/app/actions";
import { requireUserId } from "@/lib/auth";
import { getProjectsPageData } from "@/lib/app-data";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";
import { ProjectStatusPill } from "@/components/StatusPill";
import { LiveTeamRefresh } from "@/components/LiveTeamRefresh";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ownerId = await requireUserId();
  const q = typeof params?.q === "string" ? params.q.trim() : "";
  const assignedSearch = q
    ? Prisma.sql`AND (project.title ILIKE ${`%${q}%`} OR client."businessName" ILIKE ${`%${q}%`})`
    : Prisma.empty;

  const [rows, assignedRows] = await Promise.all([
    getProjectsPageData(ownerId, q),
    prisma.$queryRaw<Array<{
      id: string;
      ownerId: string;
      payRateCents: number;
      employerName: string | null;
      projectId: string;
      projectTitle: string;
      clientBusinessName: string;
    }>>`
      SELECT
        assignment.id,
        assignment."ownerId",
        assignment."payRateCents",
        profile."tradingName" AS "employerName",
        project.id AS "projectId",
        project.title AS "projectTitle",
        client."businessName" AS "clientBusinessName"
      FROM "ProjectAssignment" assignment
      JOIN "TeamMember" member ON member.id = assignment."teamMemberId"
      JOIN "Project" project ON project.id = assignment."projectId"
      JOIN "Client" client ON client.id = project."clientId"
      LEFT JOIN "BusinessProfile" profile ON profile."ownerId" = assignment."ownerId"
      WHERE assignment.active = true
        AND member."userId" = ${ownerId}
        AND member.status = 'ACTIVE'
        AND project.status = 'ACTIVE'
        ${assignedSearch}
      ORDER BY project.title ASC
    `
  ]);
  const projects = rows.filter((project) => project.status === "ACTIVE");
  const archivedProjects = rows.filter((project) => project.status === "ARCHIVED");

  return (
    <main className="page-shell">
      <LiveTeamRefresh />
      <header className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-title">Projects</p>
          <h1 className="page-title">Active jobs</h1>
        </div>
        <Link href="/projects/new" className="tap-primary">
          <Plus size={20} aria-hidden="true" />
          Add New Project
        </Link>
      </header>

      <form className="search-panel mt-5 flex items-center gap-2">
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
          return (
            <Link key={project.id} href={`/projects/${project.id}`} className="card block transition hover:border-mint">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">{project.title}</h2>
                  <p className="mt-1 text-sm font-bold text-moss">{project.clientBusinessName}</p>
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
                  <dd className="mt-1 text-lg font-black">{formatHours(project.unbilledMinutes)}h</dd>
                </div>
                <div className="col-span-2 rounded-lg bg-paper p-3">
                  <dt className="font-bold text-moss">Unbilled value</dt>
                  <dd className="mt-1 text-2xl font-black">{formatMoney(project.unbilledValueCents)}</dd>
                </div>
              </dl>
            </Link>
          );
        })}
      </section>

      {assignedRows.length ? (
        <section className="mt-9">
          <div className="mb-3 flex items-center gap-2">
            <BriefcaseBusiness size={20} className="text-mint" aria-hidden="true" />
            <h2 className="text-xl font-black">Assigned projects</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {assignedRows.map((assignment) => (
              <Link key={assignment.id} href={`/projects/${assignment.projectId}`} className="card block border-mint/25 transition hover:border-mint">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black">{assignment.projectTitle}</h3>
                    <p className="mt-1 text-sm font-bold text-moss">{assignment.clientBusinessName}</p>
                  </div>
                  <span className="status-pill border-mint/30 bg-mint/10 text-mint">Assigned</span>
                </div>
                <p className="mt-4 rounded-lg bg-paper p-3 text-sm font-semibold text-moss">
                  Assigned by <strong className="text-ink">{assignment.employerName || "Employer"}</strong>
                </p>
                <p className="mt-3 text-sm font-bold text-moss">Your pay rate</p>
                <p className="mt-1 text-2xl font-black">{formatMoney(assignment.payRateCents)}/h</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-9">
        <div className="mb-3 flex items-center gap-2">
          <Archive size={20} className="text-moss" aria-hidden="true" />
          <h2 className="text-xl font-black">Archived projects</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {archivedProjects.length ? (
            archivedProjects.map((project) => {
              return (
                <article key={project.id} className="card">
                  <Link href={`/projects/${project.id}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black">{project.title}</h3>
                        <p className="mt-1 text-sm font-bold text-moss">{project.clientBusinessName}</p>
                      </div>
                      <ProjectStatusPill status={project.status} />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="font-bold text-moss">Unbilled hours</dt>
                        <dd className="mt-1 text-lg font-black">{formatHours(project.unbilledMinutes)}h</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-moss">Unbilled value</dt>
                        <dd className="mt-1 text-lg font-black">{formatMoney(project.unbilledValueCents)}</dd>
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
