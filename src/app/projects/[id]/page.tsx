import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Banknote, CheckCircle2, Clock3, Edit, FilePlus, FileText, ReceiptText, RotateCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { deleteTimeEntryAction, unarchiveProjectAction } from "@/app/actions";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateInputValue, formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatHours, labourTotalCents } from "@/lib/time";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { InvoiceStatusPill, ProjectStatusPill } from "@/components/StatusPill";
import { LogTimeSheet } from "@/components/LogTimeSheet";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerId = await requireUserId();
  const [project, activeProjects] = await Promise.all([
    prisma.project.findFirst({
      where: { id, ownerId },
      include: {
        client: true,
        timeEntries: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
        expenseItems: { orderBy: [{ datePurchased: "desc" }, { createdAt: "desc" }] },
        invoices: { orderBy: { invoiceDate: "desc" } }
      }
    }),
    prisma.project.findMany({
      where: { status: "ACTIVE", ownerId },
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
  const unbilledTimeEntries = project.timeEntries.filter((entry) => entry.billingStatus === "UNBILLED");
  const unbilledExpenseItems = project.expenseItems.filter((item) => item.billingStatus === "UNBILLED");
  const unbilledMinutes = unbilledTimeEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const unbilledTimeValueCents = unbilledTimeEntries.reduce(
    (sum, entry) => sum + labourTotalCents(entry.durationMinutes, entry.hourlyRateCentsSnapshot),
    0
  );
  const unbilledExpenseValueCents = unbilledExpenseItems.reduce((sum, item) => sum + item.totalCostCents, 0);
  const unbilledTotalCents = unbilledTimeValueCents + unbilledExpenseValueCents;
  const hasUnbilledWork = unbilledTimeEntries.length > 0 || unbilledExpenseItems.length > 0;
  const activeInvoiceCount = project.invoices.filter((invoice) => invoice.status !== "VOID").length;

  return (
    <main className="page-shell">
      <Link href="/projects" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Projects
      </Link>

      <header className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="section-title">Project command</p>
              <ProjectStatusPill status={project.status} />
              {hasUnbilledWork ? (
                <span className="status-pill border-mint bg-mint/10 text-mint">ready to invoice</span>
              ) : (
                <span className="status-pill border-line bg-paper text-moss">all caught up</span>
              )}
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-normal">{project.title}</h1>
            <p className="mt-2 text-base font-bold text-moss">{project.client.businessName}</p>
            {project.notes ? <p className="mt-4 max-w-3xl text-sm font-bold leading-6 text-moss">{project.notes}</p> : null}
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
        </div>
      </header>

      <section className={`mt-4 overflow-hidden rounded-lg border shadow-soft ${hasUnbilledWork ? "border-mint/30 bg-ink text-white" : "border-line bg-white"}`}>
        <div className={`grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center ${hasUnbilledWork ? "bg-[radial-gradient(circle_at_top_left,rgba(15,159,143,0.36),transparent_28rem)]" : ""}`}>
          <div>
            <div className="flex items-center gap-2">
              {hasUnbilledWork ? (
                <AlertTriangle size={22} className="text-mint" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={22} className="text-moss" aria-hidden="true" />
              )}
              <p className={`text-sm font-black uppercase ${hasUnbilledWork ? "text-mint" : "text-moss"}`}>Unbilled Work</p>
            </div>
            <h2 className={`mt-3 text-4xl font-black tracking-normal sm:text-5xl ${hasUnbilledWork ? "text-white" : "text-ink"}`}>
              {hasUnbilledWork ? formatMoney(unbilledTotalCents) : "All caught up"}
            </h2>
            <p className={`mt-2 text-sm font-bold leading-6 ${hasUnbilledWork ? "text-white/70" : "text-moss"}`}>
              {hasUnbilledWork
                ? "Time and expenses below are still unbilled. Create the invoice directly from this project when you are ready."
                : "There are no unbilled time entries or expense items on this project."}
            </p>
          </div>
          {hasUnbilledWork && project.status === "ACTIVE" ? (
            <Link href={`/invoices/new?${projectQuery.toString()}`} className="tap-primary bg-mint px-5 text-base hover:bg-white hover:text-ink">
              <FilePlus size={22} aria-hidden="true" />
              Invoice Unbilled Work
            </Link>
          ) : null}
        </div>
        <div className={`grid gap-3 border-t p-4 sm:grid-cols-2 xl:grid-cols-4 ${hasUnbilledWork ? "border-white/10 bg-black/10" : "border-line bg-paper/40"}`}>
          <UnbilledStat label="Hours" value={`${formatHours(unbilledMinutes)}h`} dark={hasUnbilledWork} />
          <UnbilledStat label="Labour" value={formatMoney(unbilledTimeValueCents)} dark={hasUnbilledWork} />
          <UnbilledStat label="Expenses" value={formatMoney(unbilledExpenseValueCents)} dark={hasUnbilledWork} />
          <UnbilledStat label="Total" value={formatMoney(unbilledTotalCents)} dark={hasUnbilledWork} />
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProjectMetric label="Current rate" value={`${formatMoney(project.currentHourlyRateCents)}/h`} icon={Banknote} />
        <ProjectMetric label="Logged entries" value={String(project.timeEntries.length)} icon={Clock3} />
        <ProjectMetric label="Invoices" value={String(activeInvoiceCount)} icon={FileText} />
        <ProjectMetric label="Unbilled total" value={formatMoney(unbilledTotalCents)} icon={ReceiptText} highlight={hasUnbilledWork} />
      </section>

      <section className="mt-7 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl font-black tracking-normal">Logged hours</h2>
          <div className="grid gap-3">
            {project.timeEntries.length ? (
              project.timeEntries.map((entry) => (
                <article key={entry.id} className={`card ${entry.billingStatus === "UNBILLED" ? "border-mint/30" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{formatDateAU(entry.date)}</p>
                      <p className="mt-1 text-sm font-bold text-moss">
                        {entry.startTime && entry.endTime ? `${entry.startTime} - ${entry.endTime}` : "Manual hours"}
                      </p>
                    </div>
                    <span className="rounded-lg bg-paper px-2.5 py-1 text-sm font-black">{formatHours(entry.durationMinutes)}h</span>
                  </div>
                  <p className="mt-3 text-sm font-bold text-moss">{entry.notes || "No notes"}</p>
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
              ))
            ) : (
              <EmptyPanel icon={Clock3} title="No logged hours yet" text="Log the first shift for this project when work starts." />
            )}
          </div>
        </div>

        <div className="grid content-start gap-6">
          <section>
            <h2 className="mb-3 text-xl font-black tracking-normal">Expense items</h2>
            <div className="grid gap-3">
              {project.expenseItems.length ? (
                project.expenseItems.map((item) => (
                  <article key={item.id} className={`card ${item.billingStatus === "UNBILLED" ? "border-mint/30" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black">{item.description}</p>
                        <p className="mt-1 text-sm font-bold text-moss">{formatDateAU(item.datePurchased)}</p>
                      </div>
                      <span className="text-lg font-black">{formatMoney(item.totalCostCents)}</span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-moss">
                      Qty {Number(item.quantity)} at {formatMoney(item.unitCostCents)} - {item.billingStatus.toLowerCase()}
                    </p>
                    {item.notes ? <p className="mt-2 text-sm font-bold text-moss">{item.notes}</p> : null}
                  </article>
                ))
              ) : (
                <EmptyPanel icon={ReceiptText} title="No expense items" text="Materials and reimbursable items will appear here." />
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-black tracking-normal">Linked invoices</h2>
            <div className="grid gap-3">
              {project.invoices.length ? (
                project.invoices.map((invoice) => (
                  <Link href={`/invoices/${invoice.id}`} key={invoice.id} className="card block transition hover:border-mint">
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex items-center gap-2 font-black">
                        <FileText size={18} aria-hidden="true" />
                        {invoice.invoiceNumber}
                      </span>
                      <InvoiceStatusPill status={invoice.status} />
                    </div>
                    <p className="mt-3 text-sm font-bold text-moss">
                      {formatDateAU(invoice.dateRangeStart)} - {formatDateAU(invoice.dateRangeEnd)}
                    </p>
                    <p className="mt-2 text-xl font-black">{formatMoney(invoice.grandTotalCents)}</p>
                  </Link>
                ))
              ) : (
                <EmptyPanel icon={FileText} title="No linked invoices" text="Invoices created from this project will appear here." />
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function ProjectMetric({
  label,
  value,
  icon: Icon,
  highlight = false
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  highlight?: boolean;
}) {
  return (
    <article className={`card min-h-32 ${highlight ? "border-mint/30 bg-mint/10" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-black uppercase text-moss">{label}</p>
        <span className={`grid size-10 place-items-center rounded-lg ${highlight ? "bg-white text-mint" : "bg-paper text-moss"}`}>
          <Icon size={20} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-5 text-2xl font-black tracking-normal text-ink">{value}</p>
    </article>
  );
}

function UnbilledStat({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return (
    <div className={`rounded-lg border p-4 shadow-soft ${dark ? "border-white/15 bg-gradient-to-br from-mint/20 to-white/10" : "border-line bg-white"}`}>
      <p className={`text-xs font-black uppercase ${dark ? "text-white/60" : "text-moss"}`}>{label}</p>
      <p className={`mt-2 text-2xl font-black tracking-normal ${dark ? "text-white" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function EmptyPanel({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <article className="rounded-lg border border-line bg-white p-4 text-sm font-bold text-moss">
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-paper text-moss">
          <Icon size={20} aria-hidden="true" />
        </span>
        <div>
          <p className="font-black text-ink">{title}</p>
          <p className="mt-1 leading-6">{text}</p>
        </div>
      </div>
    </article>
  );
}
