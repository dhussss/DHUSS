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

      <section className="collection-panel mt-5" aria-label="Active projects">
        {projects.map((project) => {
          return (
            <Link key={project.id} href={`/projects/${project.id}`} className="collection-row project-collection-row">
              <div className="min-w-0"><h2 className="collection-title">{project.title}</h2><p className="collection-subtitle">{project.clientBusinessName}</p></div>
              <dl className="collection-meta"><dt>Rate</dt><dd>{formatMoney(project.currentHourlyRateCents)}/h</dd></dl>
              <dl className="collection-meta"><dt>Unbilled hours</dt><dd>{formatHours(project.unbilledMinutes)}h</dd></dl>
              <span className="collection-value">{formatMoney(project.unbilledValueCents)}</span>
              <ProjectStatusPill status={project.status} />
            </Link>
          );
        })}
        {!projects.length ? <div className="empty-collection">No active projects found.</div> : null}
      </section>

      {assignedRows.length ? (
        <section className="mt-9">
          <div className="collection-section-header">
            <BriefcaseBusiness size={20} className="text-mint" aria-hidden="true" />
            <h2 className="text-xl font-black">Assigned projects</h2>
          </div>
          <div className="collection-panel">
            {assignedRows.map((assignment) => (
              <Link key={assignment.id} href={`/projects/${assignment.projectId}`} className="collection-row project-collection-row">
                <div className="min-w-0"><h3 className="collection-title">{assignment.projectTitle}</h3><p className="collection-subtitle">{assignment.clientBusinessName} · Assigned by {assignment.employerName || "Employer"}</p></div>
                <dl className="collection-meta"><dt>Your pay rate</dt><dd>{formatMoney(assignment.payRateCents)}/h</dd></dl>
                <span />
                <span className="collection-value">{formatMoney(assignment.payRateCents)}/h</span>
                <span className="status-pill border-mint/30 bg-mint/10 text-mint">Assigned</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <details className="archive-disclosure">
        <summary><span className="inline-flex items-center gap-2"><Archive size={18} aria-hidden="true" />Archived projects</span><span>{archivedProjects.length}</span></summary>
        <div className="collection-panel">
          {archivedProjects.length ? (
            archivedProjects.map((project) => {
              return (
                <article key={project.id} className="collection-row project-collection-row">
                  <Link href={`/projects/${project.id}`} className="min-w-0"><h3 className="collection-title">{project.title}</h3><p className="collection-subtitle">{project.clientBusinessName}</p></Link>
                  <dl className="collection-meta"><dt>Unbilled hours</dt><dd>{formatHours(project.unbilledMinutes)}h</dd></dl>
                  <dl className="collection-meta"><dt>Unbilled value</dt><dd>{formatMoney(project.unbilledValueCents)}</dd></dl>
                  <ProjectStatusPill status={project.status} />
                  <form action={unarchiveProjectAction}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <button className="tap-secondary" type="submit">
                      <RotateCcw size={17} aria-hidden="true" />Unarchive
                    </button>
                  </form>
                </article>
              );
            })
          ) : (
            <div className="empty-collection">No archived projects.</div>
          )}
        </div>
      </details>
    </main>
  );
}
