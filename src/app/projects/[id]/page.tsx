import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, Edit, FilePlus, FileText, RotateCcw } from "lucide-react";
import { deleteTimeEntryAction, unarchiveProjectAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { dateInputValue, formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatHours, labourTotalCents } from "@/lib/time";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { InvoiceStatusPill, ProjectStatusPill } from "@/components/StatusPill";
import { LogTimeSheet } from "@/components/LogTimeSheet";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, activeProjects] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        rateHistory: { orderBy: { startsAt: "desc" } },
        timeEntries: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
        expenseItems: { orderBy: [{ datePurchased: "desc" }, { createdAt: "desc" }] },
        invoices: { orderBy: { invoiceDate: "desc" } }
      }
    }),
    prisma.project.findMany({
      where: { status: "ACTIVE" },
      include: { client: true },
      orderBy: { title: "asc" }
    })
  ]);

  if (!project) notFound();

  const unbilledDates = [
    ...project.timeEntries.filter((entry) => entry.billingStatus === "UNBILLED").map((entry) => entry.date),
    ...project.expenseItems.filter((item) => item.billingStatus === "UNBILLED").map((item) => item.datePurchased)
  ].sort((a, b) => a.getTime() - b.getTime());
  const rangeStart = unbilledDates[0] ? dateInputValue(unbilledDates[0]) : dateInputValue(new Date());
  const rangeEnd = unbilledDates[unbilledDates.length - 1] ? dateInputValue(unbilledDates[unbilledDates.length - 1]) : dateInputValue(new Date());
  const projectQuery = new URLSearchParams({
    projectId: project.id,
    dateRangeStart: rangeStart,
    dateRangeEnd: rangeEnd,
    start: rangeStart,
    end: rangeEnd
  });

  return (
    <main className="page-shell">
      <Link href="/projects" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Projects
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="section-title">Project</p>
            <ProjectStatusPill status={project.status} />
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-normal">{project.title}</h1>
          <p className="mt-1 font-bold text-moss">{project.client.businessName}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={`/projects/${project.id}/edit`} className="tap-secondary">
            <Edit size={20} aria-hidden="true" />
            Edit
          </Link>
          {project.status === "ARCHIVED" ? (
            <form action={unarchiveProjectAction}>
              <input type="hidden" name="projectId" value={project.id} />
              <button className="tap-primary w-full" type="submit">
                <RotateCcw size={20} aria-hidden="true" />
                Unarchive
              </button>
            </form>
          ) : (
            <>
              <Link href={`/invoices/new?${projectQuery.toString()}`} className="tap-secondary">
                <FilePlus size={20} aria-hidden="true" />
                Invoice Project
              </Link>
              <Link href={`/hours-export?${projectQuery.toString()}`} className="tap-secondary">
                <Clock3 size={20} aria-hidden="true" />
                Export Hours
              </Link>
              <LogTimeSheet projects={activeProjects} defaultProjectId={project.id} buttonLabel="Log Hours" />
            </>
          )}
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <article className="card">
          <p className="text-sm font-bold text-moss">Current rate</p>
          <p className="mt-2 text-2xl font-black">{formatMoney(project.currentHourlyRateCents)}/h</p>
        </article>
        <article className="card">
          <p className="text-sm font-bold text-moss">Logged entries</p>
          <p className="mt-2 text-2xl font-black">{project.timeEntries.length}</p>
        </article>
        <article className="card">
          <p className="text-sm font-bold text-moss">Invoices</p>
          <p className="mt-2 text-2xl font-black">{project.invoices.length}</p>
        </article>
      </section>

      {project.notes ? <p className="mt-5 rounded-lg bg-white p-4 text-sm text-moss">{project.notes}</p> : null}

      <section className="mt-7 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl font-black tracking-normal">Logged hours</h2>
          <div className="grid gap-3">
            {project.timeEntries.map((entry) => (
              <article key={entry.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{formatDateAU(entry.date)}</p>
                    <p className="mt-1 text-sm text-moss">
                      {entry.startTime && entry.endTime ? `${entry.startTime} - ${entry.endTime}` : "Manual hours"}
                    </p>
                  </div>
                  <span className="rounded-lg bg-paper px-2.5 py-1 text-sm font-black">{formatHours(entry.durationMinutes)}h</span>
                </div>
                <p className="mt-3 text-sm text-moss">{entry.notes || "No notes"}</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <p className="text-sm font-bold text-moss">
                    {entry.billingStatus.toLowerCase()} at {formatMoney(entry.hourlyRateCentsSnapshot)}/h -{" "}
                    {formatMoney(labourTotalCents(entry.durationMinutes, entry.hourlyRateCentsSnapshot))}
                  </p>
                  {entry.billingStatus === "UNBILLED" ? (
                    <div className="flex gap-2">
                      <Link href={`/projects/${project.id}/time-entries/${entry.id}/edit`} className="tap-secondary px-3">
                        <Edit size={18} aria-hidden="true" />
                        Edit
                      </Link>
                      <form action={deleteTimeEntryAction}>
                        <input type="hidden" name="entryId" value={entry.id} />
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="returnTo" value={`/projects/${project.id}`} />
                        <ConfirmSubmitButton
                          className="tap-danger px-3"
                          message={`Delete the ${formatDateAU(entry.date)} time entry? This permanently removes it from logged hours and hours export.`}
                        >
                          Delete
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="grid content-start gap-6">
          <section>
            <h2 className="mb-3 text-xl font-black tracking-normal">Expense items</h2>
            <div className="grid gap-3">
              {project.expenseItems.map((item) => (
                <article key={item.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{item.description}</p>
                      <p className="mt-1 text-sm text-moss">{formatDateAU(item.datePurchased)}</p>
                    </div>
                    <span className="text-lg font-black">{formatMoney(item.totalCostCents)}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-moss">
                    Qty {Number(item.quantity)} at {formatMoney(item.unitCostCents)} - {item.billingStatus.toLowerCase()}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-black tracking-normal">Linked invoices</h2>
            <div className="grid gap-3">
              {project.invoices.map((invoice) => (
                <Link href={`/invoices/${invoice.id}`} key={invoice.id} className="card block transition hover:border-mint">
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex items-center gap-2 font-bold">
                      <FileText size={18} aria-hidden="true" />
                      {invoice.invoiceNumber}
                    </span>
                    <InvoiceStatusPill status={invoice.status} />
                  </div>
                  <p className="mt-3 text-sm text-moss">
                    {formatDateAU(invoice.dateRangeStart)} - {formatDateAU(invoice.dateRangeEnd)}
                  </p>
                  <p className="mt-2 text-xl font-black">{formatMoney(invoice.grandTotalCents)}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
