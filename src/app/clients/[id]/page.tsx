import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, Edit, FilePlus, FileText, Mail, Phone, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { InvoiceStatusPill, ProjectStatusPill } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

function detail(value: string | null | undefined) {
  return value?.trim() ? value : "Not recorded";
}

export default async function ClientDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ownerId = await requireUserId();
  const client = await prisma.client.findFirst({
    where: { id, ownerId },
    select: {
      id: true,
      businessName: true,
      contactName: true,
      email: true,
      phone: true,
      abn: true,
      address: true,
      notes: true,
      projects: {
        select: {
          id: true,
          title: true,
          status: true,
          currentHourlyRateCents: true,
          updatedAt: true
        },
        orderBy: [{ status: "asc" }, { title: "asc" }]
      },
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          invoiceDate: true,
          dueDate: true,
          grandTotalCents: true,
          project: { select: { title: true } }
        },
        orderBy: [{ invoiceDate: "desc" }, { invoiceNumber: "desc" }],
        take: 6
      }
    }
  });

  if (!client) notFound();

  const activeProjectCount = client.projects.filter((project) => project.status === "ACTIVE").length;
  const archivedProjectCount = client.projects.length - activeProjectCount;
  const activeInvoices = client.invoices.filter((invoice) => invoice.status !== "VOID");
  const invoiceValueCents = activeInvoices.reduce((sum, invoice) => sum + invoice.grandTotalCents, 0);
  const saved = query?.saved === "client-created" || query?.saved === "client-updated";
  const addProjectHref = `/projects/new?clientId=${encodeURIComponent(client.id)}`;

  return (
    <main className="page-shell">
      <Link href="/clients" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Back to Clients
      </Link>

      <header className="page-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-moss">
              <UsersRound size={20} aria-hidden="true" />
              <p className="section-title">Client</p>
            </div>
            <h1 className="page-title">{client.businessName}</h1>
            {client.contactName ? <p className="mt-2 text-base font-bold text-moss">{client.contactName}</p> : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href={`/clients/${client.id}/edit`} className="tap-secondary">
              <Edit size={18} aria-hidden="true" />
              Edit Client
            </Link>
            <Link href={addProjectHref} className="tap-primary">
              <FilePlus size={18} aria-hidden="true" />
              Add Project
            </Link>
          </div>
        </div>
      </header>

      {saved ? (
        <div className="mt-4 rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm font-bold text-moss">
          Client saved.
        </div>
      ) : null}

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <SummaryTile label="Active projects" value={String(activeProjectCount)} />
        <SummaryTile label="Archived projects" value={String(archivedProjectCount)} />
        <SummaryTile label="Invoice value" value={formatMoney(invoiceValueCents)} />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="card">
          <p className="section-title">Details</p>
          <dl className="mt-4 grid gap-3 text-sm font-bold">
            <DetailLine icon={Mail} label="Email" value={detail(client.email)} />
            <DetailLine icon={Phone} label="Phone" value={detail(client.phone)} />
            <DetailLine label="ABN" value={detail(client.abn)} />
            <DetailLine label="Address" value={detail(client.address)} multiline />
            <DetailLine label="Notes" value={detail(client.notes)} multiline />
          </dl>
        </section>

        <section className="grid gap-5">
          <section className="surface-panel">
            <div className="surface-header flex items-center justify-between gap-3">
              <div>
                <p className="section-title">Projects</p>
                <h2 className="mt-1 text-xl font-black">Linked jobs</h2>
              </div>
              <Link href={addProjectHref} className="text-sm font-bold text-mint">
                Add Project
              </Link>
            </div>
            <div className="grid gap-3 p-3">
              {client.projects.length ? (
                client.projects.map((project) => (
                  <Link key={project.id} href={`/projects/${project.id}`} className="rounded-lg border border-line bg-white p-4 transition hover:border-mint">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-ink">{project.title}</p>
                        <p className="mt-1 text-sm font-bold text-moss">{formatMoney(project.currentHourlyRateCents)}/h</p>
                      </div>
                      <ProjectStatusPill status={project.status} />
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState icon={BriefcaseBusiness} text="No projects linked yet." />
              )}
            </div>
          </section>

          <section className="surface-panel">
            <div className="surface-header">
              <p className="section-title">Invoices</p>
              <h2 className="mt-1 text-xl font-black">Recent invoices</h2>
            </div>
            <div className="grid gap-3 p-3">
              {client.invoices.length ? (
                client.invoices.map((invoice) => (
                  <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="rounded-lg border border-line bg-white p-4 transition hover:border-mint">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-ink">{invoice.invoiceNumber}</p>
                        <p className="mt-1 text-sm font-bold text-moss">
                          {invoice.project.title} · {formatDateAU(invoice.invoiceDate)}
                        </p>
                      </div>
                      <InvoiceStatusPill status={invoice.status} />
                    </div>
                    <p className="mt-3 text-xl font-black text-ink">{formatMoney(invoice.grandTotalCents)}</p>
                  </Link>
                ))
              ) : (
                <EmptyState icon={FileText} text="No invoices for this client yet." />
              )}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <article className="card">
      <p className="text-xs font-black uppercase text-moss">{label}</p>
      <p className="mt-3 text-3xl font-black text-ink">{value}</p>
    </article>
  );
}

function DetailLine({
  icon: Icon,
  label,
  value,
  multiline = false
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="border-t border-line pt-3">
      <dt className="flex items-center gap-2 text-xs font-black uppercase text-moss">
        {Icon ? <Icon size={15} aria-hidden="true" /> : null}
        {label}
      </dt>
      <dd className={`mt-2 text-ink ${multiline ? "whitespace-pre-wrap leading-6" : "break-words"}`}>{value}</dd>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 text-sm font-bold text-moss">
      <span className="inline-flex items-center gap-2">
        <Icon size={18} aria-hidden="true" />
        {text}
      </span>
    </div>
  );
}
