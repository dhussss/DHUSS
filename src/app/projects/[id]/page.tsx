import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Banknote, CalendarDays, CheckCircle2, Clock3, Edit, FilePlus, FileText, ReceiptText, RotateCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { deleteExpenseItemAction, deleteTimeEntryAction, deleteWorkExpenseAction, unarchiveProjectAction } from "@/app/actions";
import { deleteTeamTimeEntryAction } from "@/app/team/actions";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, dateInputValue, formatDateAU, startOfWeekMonday, todayInPerth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatHours, labourTotalCents } from "@/lib/time";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { InvoiceStatusPill, ProjectStatusPill } from "@/components/StatusPill";
import { LogTimeSheet } from "@/components/LogTimeSheet";
import { SubcontractorTimeForm } from "@/components/SubcontractorTimeForm";
import { LiveTeamRefresh } from "@/components/LiveTeamRefresh";
import { expenseCategoryLabel } from "@/lib/expenses";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerId = await requireUserId();
  const projectOwner = await prisma.project.findUnique({ where: { id }, select: { ownerId: true } });
  if (!projectOwner) notFound();

  if (projectOwner.ownerId !== ownerId) {
    const assignment = await prisma.projectAssignment.findFirst({
      where: { projectId: id, active: true, teamMember: { userId: ownerId, status: "ACTIVE" }, project: { status: "ACTIVE" } },
      select: {
        id: true,
        ownerId: true,
        payRateCents: true,
        project: { select: { id: true, title: true, notes: true, client: { select: { businessName: true } } } },
        teamMember: {
          select: {
            id: true,
            timeEntries: {
              where: { projectId: id, createdByUserId: ownerId },
              orderBy: [{ date: "desc" }, { createdAt: "desc" }]
            }
          }
        }
      }
    });
    if (!assignment) notFound();
    const employer = await prisma.businessProfile.findUnique({ where: { ownerId: assignment.ownerId }, select: { tradingName: true } });
    return <AssignedProjectView assignment={assignment} employerName={employer?.tradingName || "Employer"} />;
  }
  const today = todayInPerth();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  const calendarStart = startOfWeekMonday(monthStart);
  const calendarEnd = addDays(startOfWeekMonday(monthEnd), 6);
  const [project, activeProjects, monthlyEntries, dayOffLogs] = await Promise.all([
    prisma.project.findFirst({
      where: { id, ownerId },
      include: {
        client: true,
        timeEntries: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
        expenseItems: { orderBy: [{ datePurchased: "desc" }, { createdAt: "desc" }] },
        workExpenses: { where: { archivedAt: null }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
        invoices: { orderBy: { invoiceDate: "desc" } }
      }
    }),
    prisma.project.findMany({
      where: { status: "ACTIVE", ownerId },
      include: { client: true },
      orderBy: { title: "asc" }
    }),
    prisma.timeEntry.findMany({
      where: {
        projectId: id,
        ownerId,
        OR: [{ teamMemberId: null }, { approvalStatus: "APPROVED" }],
        date: { gte: calendarStart, lte: calendarEnd }
      },
      select: { date: true, durationMinutes: true }
    }),
    prisma.dayOffLog.findMany({
      where: {
        ownerId,
        date: { gte: calendarStart, lte: calendarEnd },
        plannedWorkDay: true
      },
      select: { date: true }
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
  const unbilledTimeEntries = project.timeEntries.filter(
    (entry) => entry.billingStatus === "UNBILLED" && (!entry.teamMemberId || entry.approvalStatus === "APPROVED")
  );
  const unbilledExpenseItems = project.expenseItems.filter((item) => item.billingStatus === "UNBILLED");
  const unbilledMinutes = unbilledTimeEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const unbilledTimeValueCents = unbilledTimeEntries.reduce(
    (sum, entry) => sum + labourTotalCents(entry.durationMinutes, entry.hourlyRateCentsSnapshot),
    0
  );
  const unbilledExpenseValueCents = unbilledExpenseItems.reduce((sum, item) => sum + item.totalCostCents, 0);
  const unbilledTotalCents = unbilledTimeValueCents + unbilledExpenseValueCents;
  const labourByWorker = unbilledTimeEntries.reduce((groups, entry) => {
    const worker = entry.workerDisplayNameSnapshot || "Your labour";
    const current = groups.get(worker) || { minutes: 0, valueCents: 0, isEmployee: Boolean(entry.teamMemberId) };
    current.minutes += entry.durationMinutes;
    current.valueCents += labourTotalCents(entry.durationMinutes, entry.hourlyRateCentsSnapshot);
    groups.set(worker, current);
    return groups;
  }, new Map<string, { minutes: number; valueCents: number; isEmployee: boolean }>());
  const hasUnbilledWork = unbilledTimeEntries.length > 0 || unbilledExpenseItems.length > 0;
  const activeInvoiceCount = project.invoices.filter((invoice) => invoice.status !== "VOID").length;
  const monthLabel = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" }).format(today);
  const monthlyActivityCells = buildMonthlyActivityCells(monthlyEntries, dayOffLogs, today);

  return (
    <main className="page-shell">
      <Link href="/projects" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Projects
      </Link>

      <header className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
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
            <h1 className="mt-3 text-4xl font-black tracking-tight">{project.title}</h1>
            <p className="mt-2 text-base font-semibold text-moss">{project.client.businessName}</p>
            {project.notes ? <p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-moss">{project.notes}</p> : null}
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

      <section className={`mt-4 overflow-hidden rounded-2xl border bg-white shadow-soft ${hasUnbilledWork ? "border-mint/35" : "border-line"}`}>
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              {hasUnbilledWork ? (
                <AlertTriangle size={22} className="text-mint" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={22} className="text-moss" aria-hidden="true" />
              )}
              <p className={`text-sm font-bold ${hasUnbilledWork ? "text-mint" : "text-moss"}`}>Unbilled work</p>
            </div>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-ink sm:text-5xl">
              {hasUnbilledWork ? formatMoney(unbilledTotalCents) : "All caught up"}
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-moss">
              {hasUnbilledWork
                ? "Time and expenses below are still unbilled. Create the invoice directly from this project when you are ready."
                : "There are no unbilled time entries or expense items on this project."}
            </p>
          </div>
          {hasUnbilledWork && project.status === "ACTIVE" ? (
            <Link href={`/invoices/new?${projectQuery.toString()}`} className="tap-primary px-5 text-base">
              <FilePlus size={22} aria-hidden="true" />
              Invoice Unbilled Work
            </Link>
          ) : null}
        </div>
        <div className="grid gap-3 border-t border-line bg-paper/40 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <UnbilledStat label="Hours" value={`${formatHours(unbilledMinutes)}h`} dark={hasUnbilledWork} />
          <UnbilledStat label="Labour" value={formatMoney(unbilledTimeValueCents)} dark={hasUnbilledWork} />
          <UnbilledStat label="Expenses" value={formatMoney(unbilledExpenseValueCents)} dark={hasUnbilledWork} />
          <UnbilledStat label="Total" value={formatMoney(unbilledTotalCents)} dark={hasUnbilledWork} />
        </div>
        {labourByWorker.size > 1 || [...labourByWorker.values()].some((worker) => worker.isEmployee) ? (
          <div className="border-t border-line p-4 sm:p-5">
            <p className="section-title">Labour ready to bill</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[...labourByWorker.entries()].map(([worker, summary]) => (
                <div key={worker} className="flex items-center justify-between gap-4 rounded-lg border border-line bg-white p-3 text-sm">
                  <div><p className="font-black">{worker}</p><p className="mt-1 font-semibold text-moss">{formatHours(summary.minutes)}h</p></div>
                  <p className="font-black">{formatMoney(summary.valueCents)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProjectMetric label="Current rate" value={`${formatMoney(project.currentHourlyRateCents)}/h`} icon={Banknote} />
        <ProjectMetric label="Logged entries" value={String(project.timeEntries.length)} icon={Clock3} />
        <ProjectMetric label="Invoices" value={String(activeInvoiceCount)} icon={FileText} />
        <ProjectMetric label="Unbilled total" value={formatMoney(unbilledTotalCents)} icon={ReceiptText} highlight={hasUnbilledWork} />
      </section>

      <MonthlyActivityCalendar monthLabel={monthLabel} cells={monthlyActivityCells} />

      <section className="mt-7 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl font-black tracking-tight">Logged hours</h2>
          <div className="grid gap-3">
            {project.timeEntries.length ? (
              project.timeEntries.map((entry) => (
                <article key={entry.id} className={`card ${entry.billingStatus === "UNBILLED" ? "border-mint/30" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{formatDateAU(entry.date)}</p>
                      {entry.workerDisplayNameSnapshot ? <p className="mt-1 text-sm font-semibold text-mint">{entry.workerDisplayNameSnapshot}</p> : null}
                      {entry.teamMemberId ? (
                        <p className="mt-1 text-xs font-bold uppercase text-moss">
                          {entry.approvalStatus === "APPROVED"
                            ? "Approved team hours"
                            : `${(entry.approvalStatus ?? "submitted").toLowerCase()} team hours`}
                        </p>
                      ) : null}
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
                    {entry.billingStatus === "UNBILLED" && !entry.teamMemberId ? (
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
                    ) : entry.billingStatus === "UNBILLED" && entry.teamMemberId && entry.paymentStatus !== "PAID" ? (
                      <form action={deleteTeamTimeEntryAction}>
                        <input type="hidden" name="entryId" value={entry.id} />
                        <input type="hidden" name="returnTo" value={`/projects/${project.id}`} />
                        <ConfirmSubmitButton
                          className="tap-danger px-3"
                          message={`Delete this ${formatHours(entry.durationMinutes)}h entry for ${entry.workerDisplayNameSnapshot || "this subcontractor"} on ${formatDateAU(entry.date)}? This permanently removes it.`}
                        >
                          Delete
                        </ConfirmSubmitButton>
                      </form>
                    ) : entry.teamMemberId && entry.paymentStatus === "PAID" ? (
                      <span className="text-xs font-bold text-moss">Paid - reverse payment to edit</span>
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
            <h2 className="mb-3 text-xl font-black tracking-tight">Expense items</h2>
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
                    {item.billingStatus === "UNBILLED" ? (
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <Link href={`/projects/${project.id}/expense-items/${item.id}/edit`} className="tap-secondary px-3">
                          <Edit size={18} aria-hidden="true" />
                          Edit
                        </Link>
                        <form action={deleteExpenseItemAction}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="projectId" value={project.id} />
                          <input type="hidden" name="returnTo" value={`/projects/${project.id}`} />
                          <ConfirmSubmitButton
                            className="tap-danger px-3"
                            message={`Delete expense item "${item.description}"? This permanently removes it from this project and any unbilled invoice draft range.`}
                          >
                            Delete
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs font-black uppercase text-moss">Billed item locked</p>
                    )}
                  </article>
                ))
              ) : (
                <EmptyPanel icon={ReceiptText} title="No expense items" text="Materials and reimbursable items will appear here." />
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black tracking-tight">Work expenses</h2>
              <Link href="/expenses" className="text-sm font-bold text-mint">Expenses</Link>
            </div>
            <div className="grid gap-3">
              {project.workExpenses.length ? (
                project.workExpenses.map((expense) => (
                  <article key={expense.id} className="card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black">{expense.description}</p>
                        <p className="mt-1 text-sm font-bold text-moss">
                          {formatDateAU(expense.date)} · {expenseCategoryLabel(expense.category)}
                        </p>
                      </div>
                      <span className="text-lg font-black">{formatMoney(expense.amountCents)}</span>
                    </div>
                    {expense.gstIncluded ? <p className="mt-2 text-sm font-bold text-moss">GST estimate: {formatMoney(expense.gstAmountCents)}</p> : null}
                    {expense.notes ? <p className="mt-2 text-sm font-bold leading-6 text-moss">{expense.notes}</p> : null}
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Link href={`/expenses/${expense.id}/edit?returnTo=${encodeURIComponent(`/projects/${project.id}`)}`} className="tap-secondary px-3">
                        <Edit size={18} aria-hidden="true" />
                        Edit
                      </Link>
                      <form action={deleteWorkExpenseAction}>
                        <input type="hidden" name="expenseId" value={expense.id} />
                        <input type="hidden" name="returnTo" value={`/projects/${project.id}`} />
                        <ConfirmSubmitButton
                          className="tap-danger px-3"
                          message={`Delete work expense "${expense.description}"? This permanently removes it from the expense register.`}
                        >
                          Delete
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyPanel icon={ReceiptText} title="No linked work expenses" text="Project-allocated work expenses from the expense register will appear here." />
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-black tracking-tight">Linked invoices</h2>
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

type AssignedProject = Prisma.ProjectAssignmentGetPayload<{
  select: {
    id: true;
    ownerId: true;
    payRateCents: true;
    project: { select: { id: true; title: true; notes: true; client: { select: { businessName: true } } } };
    teamMember: { select: { id: true; timeEntries: true } };
  };
}>;

function AssignedProjectView({ assignment, employerName }: { assignment: AssignedProject; employerName: string }) {
  const entries = assignment.teamMember.timeEntries;
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const approvedMinutes = entries.filter((entry) => entry.approvalStatus === "APPROVED").reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const approvedPay = entries
    .filter((entry) => entry.approvalStatus === "APPROVED")
    .reduce((sum, entry) => sum + labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || assignment.payRateCents), 0);
  const formAssignment = {
    id: assignment.id,
    payRateCents: assignment.payRateCents,
    project: { title: assignment.project.title, client: { businessName: assignment.project.client.businessName } }
  };

  return (
    <main className="page-shell">
      <LiveTeamRefresh />
      <Link href="/projects" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint"><ArrowLeft size={18} aria-hidden="true" />Projects</Link>
      <header className="overflow-hidden rounded-2xl border border-mint/25 bg-white shadow-soft">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2"><p className="section-title">Assigned project</p><span className="status-pill border-mint/30 bg-mint/10 text-mint">Read only</span></div>
          <h1 className="mt-3 text-4xl font-black tracking-tight">{assignment.project.title}</h1>
          <p className="mt-2 text-base font-semibold text-moss">{assignment.project.client.businessName}</p>
          <p className="mt-4 rounded-lg bg-paper p-3 text-sm font-semibold text-moss">Assigned by <strong className="text-ink">{employerName}</strong>. Project details are managed by your employer.</p>
          {assignment.project.notes ? <p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-moss">{assignment.project.notes}</p> : null}
        </div>
      </header>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <ProjectMetric label="Your pay rate" value={`${formatMoney(assignment.payRateCents)}/h`} icon={Banknote} />
        <ProjectMetric label="Hours submitted" value={`${formatHours(totalMinutes)}h`} icon={Clock3} />
        <ProjectMetric label="Recorded earnings" value={formatMoney(approvedPay)} icon={CheckCircle2} highlight={approvedMinutes > 0} />
      </section>

      <SubcontractorTimeForm assignments={[formAssignment]} returnTo={`/projects/${assignment.project.id}?saved=1`} hideProjectSelector />

      <section className="mt-7">
        <h2 className="text-xl font-black">My hours on this project</h2>
        <div className="mt-3 grid gap-3">
          {entries.length ? entries.map((entry) => (
            <article key={entry.id} className="card flex items-start justify-between gap-4">
              <div><p className="font-black">{formatDateAU(entry.date)}</p><p className="mt-1 text-sm font-medium text-moss">{entry.notes || "No notes"}</p><p className="mt-2 text-xs font-black uppercase text-moss">Logged · {entry.billingStatus.toLowerCase()} · {entry.paymentStatus?.toLowerCase()}</p></div>
              <div className="text-right"><p className="text-lg font-black">{formatHours(entry.durationMinutes)}h</p><p className="text-sm font-semibold text-moss">{formatMoney(labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || assignment.payRateCents))}</p></div>
            </article>
          )) : <EmptyPanel icon={Clock3} title="No hours submitted" text="Log your first shift for this assigned project." />}
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
        <p className="text-sm font-bold text-moss">{label}</p>
        <span className={`grid size-10 place-items-center rounded-[10px] ${highlight ? "bg-white text-mint" : "bg-paper text-moss"}`}>
          <Icon size={20} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-5 text-2xl font-black tracking-tight text-ink">{value}</p>
    </article>
  );
}

function UnbilledStat({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return (
    <div className={`rounded-[10px] border bg-white p-4 ${dark ? "border-mint/25" : "border-line"}`}>
      <p className="text-xs font-bold text-moss">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-ink">{value}</p>
    </div>
  );
}

type MonthlyActivityCell = {
  date: Date;
  key: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isDayOff: boolean;
  totalMinutes: number;
  entryCount: number;
};

function buildMonthlyActivityCells(entries: Array<{ date: Date; durationMinutes: number }>, dayOffLogs: Array<{ date: Date }>, anchor: Date): MonthlyActivityCell[] {
  const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
  const calendarStart = startOfWeekMonday(monthStart);
  const calendarEnd = addDays(startOfWeekMonday(monthEnd), 6);
  const todayKey = dateInputValue(anchor);
  const activity = new Map<string, { totalMinutes: number; entryCount: number }>();
  const dayOffDates = new Set(dayOffLogs.map((log) => dateInputValue(log.date)));

  for (const entry of entries) {
    const key = dateInputValue(entry.date);
    const current = activity.get(key) ?? { totalMinutes: 0, entryCount: 0 };
    current.totalMinutes += entry.durationMinutes;
    current.entryCount += 1;
    activity.set(key, current);
  }

  const cells: MonthlyActivityCell[] = [];
  for (let day = calendarStart; day <= calendarEnd; day = addDays(day, 1)) {
    const key = dateInputValue(day);
    const summary = activity.get(key) ?? { totalMinutes: 0, entryCount: 0 };
    cells.push({
      date: day,
      key,
      dayNumber: day.getUTCDate(),
      inCurrentMonth: day.getUTCMonth() === anchor.getUTCMonth(),
      isToday: key === todayKey,
      isDayOff: dayOffDates.has(key),
      totalMinutes: summary.totalMinutes,
      entryCount: summary.entryCount
    });
  }

  return cells;
}

function MonthlyActivityCalendar({ monthLabel, cells }: { monthLabel: string; cells: MonthlyActivityCell[] }) {
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hasActivity = cells.some((cell) => cell.entryCount > 0 || cell.isDayOff);

  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-line bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="icon-tile">
            <CalendarDays size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="section-title">Monthly activity</p>
            <h2 className="text-xl font-black tracking-tight">{monthLabel}</h2>
          </div>
        </div>
        <p className="text-sm font-bold text-moss">{hasActivity ? "Theme dots show work. Red dots show days off." : "No logged work this month yet"}</p>
      </div>
      <div className="p-3 sm:p-5">
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-black uppercase text-moss sm:gap-2">
          {weekDays.map((day) => (
            <div key={day} className="px-1 py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {cells.map((cell) => {
            const title = [
              formatDateAU(cell.date),
              cell.entryCount ? `${formatHours(cell.totalMinutes)}h across ${cell.entryCount} entr${cell.entryCount === 1 ? "y" : "ies"}` : "no work logged",
              cell.isDayOff ? "day off logged" : ""
            ].filter(Boolean).join(", ");
            const hasWork = cell.totalMinutes > 0;

            return (
              <div
                key={cell.key}
                title={title}
                className={`min-h-16 rounded-lg border p-2 text-left transition sm:min-h-20 ${
                  cell.isToday
                    ? "border-mint bg-mint/10 ring-2 ring-mint/15"
                    : cell.inCurrentMonth
                      ? "border-line bg-paper/50"
                      : "border-line/70 bg-white/60 opacity-55"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-black text-ink">{cell.dayNumber}</span>
                  {cell.isToday ? <span className="rounded-full bg-mint px-1.5 py-0.5 text-[0.58rem] font-black uppercase leading-none text-white">Today</span> : null}
                </div>
                {hasWork || cell.isDayOff ? (
                  <div className="mt-3 grid gap-1">
                    <span className={`size-2.5 rounded-full ${hasWork ? "bg-mint" : "bg-gum"}`} aria-hidden="true" />
                    {hasWork ? <span className="text-xs font-black text-ink">{formatHours(cell.totalMinutes)}h</span> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
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
