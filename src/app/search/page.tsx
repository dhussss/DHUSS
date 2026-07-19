import Link from "next/link";
import { ArrowRight, FileText, FolderKanban, Search, UsersRound } from "lucide-react";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { InvoiceStatusPill } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string }>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const ownerId = await requireUserId();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const canSearch = query.length >= 2;

  const [clients, projects, invoices] = canSearch
    ? await Promise.all([
        prisma.client.findMany({
          where: {
            ownerId,
            OR: [
              { businessName: { contains: query, mode: "insensitive" } },
              { contactName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } }
            ]
          },
          select: { id: true, businessName: true, contactName: true, email: true, _count: { select: { projects: true } } },
          orderBy: { updatedAt: "desc" },
          take: 8
        }),
        prisma.project.findMany({
          where: {
            AND: [
              {
                OR: [
                  { ownerId },
                  { teamAssignments: { some: { active: true, teamMember: { userId: ownerId, status: "ACTIVE" } } } }
                ]
              },
              {
                OR: [
                  { title: { contains: query, mode: "insensitive" } },
                  { client: { businessName: { contains: query, mode: "insensitive" } } }
                ]
              }
            ]
          },
          select: { id: true, ownerId: true, title: true, status: true, client: { select: { businessName: true } } },
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
          take: 8
        }),
        prisma.invoice.findMany({
          where: {
            ownerId,
            OR: [
              { invoiceNumber: { contains: query, mode: "insensitive" } },
              { client: { businessName: { contains: query, mode: "insensitive" } } },
              { project: { title: { contains: query, mode: "insensitive" } } }
            ]
          },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            grandTotalCents: true,
            client: { select: { businessName: true } },
            project: { select: { title: true } }
          },
          orderBy: { updatedAt: "desc" },
          take: 8
        })
      ])
    : [[], [], []];

  const resultCount = clients.length + projects.length + invoices.length;

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="section-title">Finder</p>
        <h1 className="page-title">Find anything</h1>
        <p className="page-subtitle">Search clients, jobs and invoices from one place. Assigned jobs are included for subcontractors.</p>
      </header>

      <form action="/search" className="mt-4 flex gap-2" role="search">
        <label className="sr-only" htmlFor="global-search">Search clients, projects and invoices</label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-moss" size={19} aria-hidden="true" />
          <input
            id="global-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Client, project or invoice number"
            className="pl-10"
            autoComplete="off"
            autoFocus
          />
        </div>
        <button type="submit" className="tap-primary px-5">Search</button>
      </form>

      {!query ? (
        <div className="mt-6 rounded-lg border border-line bg-white p-5 text-sm font-medium leading-6 text-moss shadow-soft">
          Start with at least two letters or numbers. Try a client name, job name, phone number, email address, or invoice number.
        </div>
      ) : !canSearch ? (
        <p className="mt-5 rounded-lg border border-yolk/30 bg-yolk/10 p-4 text-sm font-semibold text-ink">Enter at least two characters to search.</p>
      ) : resultCount === 0 ? (
        <div className="mt-6 rounded-lg border border-line bg-white p-6 text-center shadow-soft">
          <Search className="mx-auto text-moss" size={24} aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold text-ink">No matches for “{query}”</h2>
          <p className="mt-1 text-sm text-moss">Check the spelling or try a shorter business, project, or invoice name.</p>
        </div>
      ) : (
        <div className="mt-7 grid gap-7">
          <SearchSection title="Clients" icon={UsersRound} count={clients.length}>
            {clients.map((client) => (
              <Link key={client.id} href={`/clients/${client.id}`} className="finder-row">
                <span className="icon-tile"><UsersRound size={18} aria-hidden="true" /></span>
                <span className="min-w-0"><strong>{client.businessName}</strong><small>{client.contactName || client.email || "Client record"} · {client._count.projects} project{client._count.projects === 1 ? "" : "s"}</small></span>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            ))}
          </SearchSection>

          <SearchSection title="Projects" icon={FolderKanban} count={projects.length}>
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="finder-row">
                <span className="icon-tile"><FolderKanban size={18} aria-hidden="true" /></span>
                <span className="min-w-0"><strong>{project.title}</strong><small>{project.client.businessName} · {project.ownerId === ownerId ? project.status.toLowerCase() : "assigned to you"}</small></span>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            ))}
          </SearchSection>

          <SearchSection title="Invoices" icon={FileText} count={invoices.length}>
            {invoices.map((invoice) => (
              <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="finder-row">
                <span className="icon-tile"><FileText size={18} aria-hidden="true" /></span>
                <span className="min-w-0"><strong>{invoice.invoiceNumber}</strong><small>{invoice.project.title} · {invoice.client.businessName}</small></span>
                <span className="text-right"><b className="block text-sm text-ink">{formatMoney(invoice.grandTotalCents)}</b><InvoiceStatusPill status={invoice.status} /></span>
              </Link>
            ))}
          </SearchSection>
        </div>
      )}
    </main>
  );
}

function SearchSection({ title, icon: Icon, count, children }: { title: string; icon: typeof Search; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <section aria-labelledby={`finder-${title.toLowerCase()}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon size={19} className="text-mint" aria-hidden="true" />
        <h2 id={`finder-${title.toLowerCase()}`} className="text-lg font-semibold text-ink">{title}</h2>
        <span className="status-pill ml-auto">{count}</span>
      </div>
      <div className="collection-panel">{children}</div>
    </section>
  );
}
