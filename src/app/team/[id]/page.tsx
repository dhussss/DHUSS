import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, Clock3, PauseCircle, RotateCcw, Trash2, UserX, WalletCards } from "lucide-react";
import { archiveTeamMemberAction, createProjectAssignmentAction, deleteTeamTimeEntryAction, markTeamMemberPaidAction, restoreTeamMemberAction, reverseWagePaymentAction, stopProjectAssignmentAction, updateWagePaymentAction } from "@/app/team/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { LiveTeamRefresh } from "@/components/LiveTeamRefresh";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUserId } from "@/lib/auth";
import { dateInputValue, formatDateAU, todayInPerth } from "@/lib/dates";
import { centsToDollars, formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { formatHours, labourTotalCents } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function TeamMemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string; paymentUpdated?: string; paymentReversed?: string }> }) {
  const { id } = await params;
  const notices = await searchParams;
  const ownerId = await requireUserId();
  const [member, projects] = await Promise.all([
    prisma.teamMember.findFirst({
      where: { id, ownerId },
      select: {
        id: true,
        displayName: true,
        email: true,
        status: true,
        defaultPayRateCents: true,
        defaultChargeRateCents: true,
        assignments: {
          select: {
            id: true,
            active: true,
            payRateCents: true,
            chargeRateCents: true,
            project: { select: { title: true, client: { select: { businessName: true } } } }
          },
          orderBy: { createdAt: "desc" }
        },
        timeEntries: {
          select: {
            id: true,
            projectId: true,
            date: true,
            durationMinutes: true,
            notes: true,
            approvalStatus: true,
            paymentStatus: true,
            billingStatus: true,
            payRateCentsSnapshot: true,
            hourlyRateCentsSnapshot: true,
            project: { select: { title: true } }
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }]
        },
        wagePayments: {
          select: {
            id: true,
            status: true,
            minutes: true,
            paidAt: true,
            reference: true,
            amountCents: true,
            reversedAt: true,
            reversalNote: true,
            project: { select: { title: true } },
            _count: { select: { timeEntries: true } }
          },
          orderBy: { paidAt: "desc" }
        }
      }
    }),
    prisma.project.findMany({
      where: { ownerId, status: "ACTIVE" },
      select: { id: true, title: true, client: { select: { businessName: true } } },
      orderBy: { title: "asc" }
    })
  ]);
  if (!member) notFound();

  const approvedUnpaid = member.timeEntries.filter((entry) => entry.approvalStatus === "APPROVED" && entry.paymentStatus === "UNPAID");
  const allLogged = member.timeEntries.filter((entry) => entry.approvalStatus !== "REJECTED");
  const unbilled = approvedUnpaid.filter((entry) => entry.billingStatus === "UNBILLED");
  const billedUnpaid = approvedUnpaid.filter((entry) => entry.billingStatus === "BILLED");
  const totalLoggedMinutes = allLogged.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const unpaidCents = approvedUnpaid.reduce((sum, entry) => sum + labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0), 0);
  const unbilledClientValueCents = unbilled.reduce((sum, entry) => sum + labourTotalCents(entry.durationMinutes, entry.hourlyRateCentsSnapshot), 0);
  const billedWagesDueCents = billedUnpaid.reduce((sum, entry) => sum + labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0), 0);
  const unpaidByProject = Array.from(
    approvedUnpaid.reduce((groups, entry) => {
      const current = groups.get(entry.projectId) || { projectId: entry.projectId, project: entry.project.title, minutes: 0, amountCents: 0, entryCount: 0 };
      current.minutes += entry.durationMinutes;
      current.amountCents += labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0);
      current.entryCount += 1;
      groups.set(entry.projectId, current);
      return groups;
    }, new Map<string, { projectId: string; project: string; minutes: number; amountCents: number; entryCount: number }>()).values()
  ).sort((a, b) => b.amountCents - a.amountCents);

  return (
    <main className="page-shell">
      <LiveTeamRefresh />
      <Link href="/team" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint"><ArrowLeft size={18} aria-hidden="true" />Team</Link>
      {notices.paid === "1" || notices.paymentUpdated === "1" || notices.paymentReversed === "1" ? (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-mint/25 bg-mint/10 p-4 text-sm font-bold text-ink" role="status">
          <WalletCards size={19} className="shrink-0 text-mint" aria-hidden="true" />
          {notices.paymentReversed === "1" ? "Payment reversed. The hours are unpaid again and the related wage expense was archived." : notices.paymentUpdated === "1" ? "Payment details updated across the wage ledger, source hours and expense record." : "Wage payment recorded and added to payment history."}
        </div>
      ) : null}
      <header className="page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-title">Subcontractor</p>
          <h1 className="page-title">{member.displayName}</h1>
          <p className="page-subtitle">{member.email || "Linked account"}</p>
        </div>
        {member.status === "ARCHIVED" ? (
          <form action={restoreTeamMemberAction}>
            <input type="hidden" name="teamMemberId" value={member.id} />
            <ConfirmSubmitButton className="tap-secondary" message={`Restore ${member.displayName} to your active team? They'll be able to log hours again once reassigned to a project.`} showDefaultIcon={false}>
              <RotateCcw size={18} aria-hidden="true" />
              Restore to team
            </ConfirmSubmitButton>
          </form>
        ) : (
          <form action={archiveTeamMemberAction}>
            <input type="hidden" name="teamMemberId" value={member.id} />
            <ConfirmSubmitButton
              className="tap-danger"
              message={`Remove ${member.displayName} from your team? Their active project assignments will end and they'll lose the ability to log new hours. Existing history and payment records stay intact.`}
              showDefaultIcon={false}
            >
              <UserX size={18} aria-hidden="true" />
              Remove from team
            </ConfirmSubmitButton>
          </form>
        )}
      </header>

      {member.status === "ARCHIVED" ? (
        <div className="mt-4 rounded-lg border border-gum/30 bg-gum/10 p-3 text-sm font-bold text-gum">
          This subcontractor has been removed from your team. They can no longer log new hours or see new assignments. Their history stays intact.
        </div>
      ) : null}

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total hours logged" value={`${formatHours(totalLoggedMinutes)}h`} />
        <Metric label="Ready to invoice" value={formatMoney(unbilledClientValueCents)} />
        <Metric label="Billed wages due" value={formatMoney(billedWagesDueCents)} />
        <Metric label="Amount to pay" value={formatMoney(unpaidCents)} />
      </section>

      {unpaidByProject.length ? (
        <section className="surface-panel mt-4">
          <div className="surface-header flex flex-wrap items-end justify-between gap-3">
            <div><p className="section-title">Pay runs</p><h2 className="mt-1 text-xl font-black">Outstanding wages by project</h2></div>
            <p className="text-sm font-bold text-moss">Total due <span className="ml-1 text-lg text-ink">{formatMoney(unpaidCents)}</span></p>
          </div>
          <div className="grid gap-3 p-3 lg:grid-cols-2">
            {unpaidByProject.map((group) => (
              <form key={group.projectId} action={markTeamMemberPaidAction} className="rounded-lg border border-line bg-white p-4">
                <input type="hidden" name="teamMemberId" value={member.id} />
                <input type="hidden" name="projectId" value={group.projectId} />
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-black">{group.project}</p><p className="mt-1 text-sm font-semibold text-moss">{formatHours(group.minutes)}h across {group.entryCount} {group.entryCount === 1 ? "entry" : "entries"}</p></div>
                  <p className="text-xl font-black">{formatMoney(group.amountCents)}</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label>Paid date<input name="paidAt" type="date" defaultValue={dateInputValue(todayInPerth())} required /></label>
                  <label>Reference (optional)<input name="paymentReference" placeholder="Bank reference or note" /></label>
                </div>
                <ConfirmSubmitButton className="tap-primary mt-3 w-full" message={`Mark ${formatMoney(group.amountCents)} for ${member.displayName} on ${group.project} as paid? This will add a wages expense.`} pendingLabel="Recording payment..." showDefaultIcon={false}><WalletCards size={19} aria-hidden="true" />Mark project paid</ConfirmSubmitButton>
              </form>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <form action={createProjectAssignmentAction} className="card grid gap-4">
          <input type="hidden" name="teamMemberId" value={member.id} />
          <div className="flex items-center gap-3"><span className="icon-tile"><BriefcaseBusiness size={20} aria-hidden="true" /></span><div><p className="font-black">Assign project</p><p className="text-sm font-medium text-moss">Rates apply to future submitted hours.</p></div></div>
          <label>Project<select name="projectId" required>{projects.map((project) => <option key={project.id} value={project.id}>{project.title} - {project.client.businessName}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">
            <label>Pay rate<input name="payRate" type="number" min="0.01" step="0.01" defaultValue={centsToDollars(member.defaultPayRateCents)} required /></label>
            <label>Client rate<input name="chargeRate" type="number" min="0.01" step="0.01" defaultValue={centsToDollars(member.defaultChargeRateCents)} required /></label>
          </div>
          <SubmitButton className="tap-primary" pendingLabel="Assigning project...">Assign project</SubmitButton>
        </form>

        <section className="surface-panel">
          <div className="surface-header"><p className="section-title">Assignments</p><h2 className="mt-1 text-xl font-black">Projects shared</h2></div>
          <div className="grid gap-3 p-3">
            {member.assignments.length ? member.assignments.map((assignment) => (
              <article key={assignment.id} className="rounded-lg border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-4"><div><p className="font-black">{assignment.project.title}</p><p className="mt-1 text-sm font-medium text-moss">{assignment.project.client.businessName}</p></div><span className={`status-pill ${assignment.active ? "border-mint/30 bg-mint/10 text-mint" : "border-line bg-paper text-moss"}`}>{assignment.active ? "Active" : "Ended"}</span></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><p className="rounded-lg bg-paper p-2.5"><span className="block text-moss">Pay rate</span><strong>{formatMoney(assignment.payRateCents)}/h</strong></p><p className="rounded-lg bg-paper p-2.5"><span className="block text-moss">Client rate</span><strong>{formatMoney(assignment.chargeRateCents)}/h</strong></p></div>
                {assignment.active ? <form action={stopProjectAssignmentAction} className="mt-3"><input type="hidden" name="assignmentId" value={assignment.id} /><ConfirmSubmitButton className="tap-secondary w-full" message={`Stop assigning ${member.displayName} to ${assignment.project.title}? Existing hours are preserved.`}><PauseCircle size={18} aria-hidden="true" />End assignment</ConfirmSubmitButton></form> : null}
              </article>
            )) : <p className="rounded-lg bg-paper p-4 text-sm font-medium text-moss">No projects assigned yet.</p>}
          </div>
        </section>
      </section>

      <section className="mt-7">
        <h2 className="text-xl font-black">Payment history</h2>
        <div className="mt-3 grid gap-3">
          {member.wagePayments.length ? member.wagePayments.map((payment) => (
            <article key={payment.id} className={`card ${payment.status === "VOID" ? "opacity-65" : ""}`}>
              <div className="flex items-start justify-between gap-4"><div><p className="font-black">{payment.project.title}</p><p className="mt-1 text-sm font-semibold text-moss">{formatHours(payment.minutes)}h{payment.status === "PAID" ? ` across ${payment._count.timeEntries} ${payment._count.timeEntries === 1 ? "entry" : "entries"}` : " recorded"} · {payment.status.toLowerCase()}</p><p className="mt-1 text-xs font-bold text-moss">Payment date {formatDateAU(payment.paidAt)}{payment.reference ? ` · Ref ${payment.reference}` : ""}</p></div><p className="text-xl font-black">{formatMoney(payment.amountCents)}</p></div>
              {payment.status === "PAID" ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <form action={updateWagePaymentAction} className="grid gap-2 rounded-lg bg-paper p-3"><input type="hidden" name="paymentId" value={payment.id} /><label>Paid date<input type="date" name="paidAt" defaultValue={dateInputValue(payment.paidAt)} required /></label><label>Reference<input name="reference" defaultValue={payment.reference || ""} /></label><SubmitButton className="tap-secondary" pendingLabel="Updating payment...">Update payment</SubmitButton></form>
                <form action={reverseWagePaymentAction} className="grid gap-2 rounded-lg border border-gum/20 bg-gum/5 p-3"><input type="hidden" name="paymentId" value={payment.id} /><label>Reversal note<input name="reversalNote" placeholder="Reason for correction" required /></label><ConfirmSubmitButton className="tap-danger" message="Mark this wage payment unpaid? The source hours will return to unpaid and the expense record will be archived." pendingLabel="Reversing payment...">Mark unpaid</ConfirmSubmitButton></form>
              </div> : <p className="mt-3 text-sm font-semibold text-moss">Reversed {payment.reversedAt ? formatDateAU(payment.reversedAt) : ""} · {payment.reversalNote}</p>}
            </article>
          )) : <p className="rounded-2xl border border-line bg-white p-4 text-sm font-medium text-moss">No wage payments recorded yet.</p>}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="text-xl font-black">Time history</h2>
        <div className="mt-3 grid gap-3">
          {member.timeEntries.length ? member.timeEntries.map((entry) => {
            const canDelete = entry.billingStatus === "UNBILLED";
            const isPaid = entry.paymentStatus === "PAID";
            return (
              <article key={entry.id} className="card flex items-start justify-between gap-4">
                <div><p className="font-black">{entry.project.title}</p><p className="mt-1 text-sm font-medium text-moss">{formatDateAU(entry.date)} · {entry.approvalStatus?.toLowerCase()} · {entry.paymentStatus?.toLowerCase()}</p>{entry.notes ? <p className="mt-2 text-sm text-moss">{entry.notes}</p> : null}</div>
                <div className="text-right">
                  <p className="text-lg font-black">{formatHours(entry.durationMinutes)}h</p>
                  <p className="text-sm font-semibold text-moss">{formatMoney(labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0))}</p>
                  {canDelete ? (
                    <form action={deleteTeamTimeEntryAction} className="mt-2">
                      <input type="hidden" name="entryId" value={entry.id} />
                      <ConfirmSubmitButton
                        className="tap-danger min-h-9 px-3 py-1.5 text-xs"
                        message={
                          isPaid
                            ? `Delete this paid ${formatHours(entry.durationMinutes)}h entry for ${member.displayName}? This will also reverse the wage payment it belongs to (other paid entries in that same payment will return to unpaid). This cannot be undone.`
                            : `Delete this ${formatHours(entry.durationMinutes)}h entry for ${member.displayName}? This cannot be undone.`
                        }
                        pendingLabel="Deleting..."
                        showDefaultIcon={false}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  ) : (
                    <p className="mt-2 text-xs font-bold text-moss">Billed · locked</p>
                  )}
                </div>
              </article>
            );
          }) : <p className="rounded-2xl border border-line bg-white p-4 text-sm font-medium text-moss"><Clock3 className="mr-2 inline" size={18} aria-hidden="true" />No team hours logged yet.</p>}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="card"><p className="text-sm font-semibold text-moss">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></article>;
}
