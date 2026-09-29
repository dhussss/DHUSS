
import { ActionForm } from "@/components/ActionForm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, Clock3, Link2, PauseCircle, Pencil, RotateCcw, Trash2, UserCheck, UserX, WalletCards } from "lucide-react";
import { archiveTeamMemberAction, createProjectAssignmentAction, createTeamMemberInvitationAction, deleteTeamTimeEntryAction, restoreTeamMemberAction, reverseWagePaymentAction, stopProjectAssignmentAction, updateWagePaymentAction } from "@/app/form-actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { LiveTeamRefresh } from "@/components/LiveTeamRefresh";
import { SubmitButton } from "@/components/SubmitButton";
import { PayRunForm } from "@/components/PayRunForm";
import { SubcontractorTimeForm } from "@/components/SubcontractorTimeForm";
import { TeamInviteLink } from "@/components/TeamInviteLink";
import { absoluteAppUrl } from "@/lib/app-url";
import { requireUserId } from "@/lib/auth";
import { dateInputValue, formatDateAU, todayInPerth } from "@/lib/dates";
import { centsToDollars, formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { formatHours, labourTotalCents } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function TeamMemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string; assigned?: string; invite?: string; paid?: string; paymentUpdated?: string; paymentReversed?: string; timeLogged?: string; timeUpdated?: string }> }) {
  const { id } = await params;
  const notices = await searchParams;
  const ownerId = await requireUserId();
  const [member, projects] = await Promise.all([
    prisma.teamMember.findFirst({
      where: { id, ownerId },
      select: {
        id: true,
        userId: true,
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
  const inviteCode = notices.invite || "";
  const joinUrl = inviteCode ? absoluteAppUrl(`/team/join?code=${encodeURIComponent(inviteCode)}`) : "";
  const activeAssignments = member.assignments.filter((assignment) => assignment.active);

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
      const current = groups.get(entry.projectId) || { projectId: entry.projectId, project: entry.project.title, minutes: 0, amountCents: 0, entryCount: 0, entries: [] as Array<{ id: string; dateLabel: string; hoursLabel: string; amountCents: number; note: string | null }> };
      const entryAmountCents = labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0);
      current.minutes += entry.durationMinutes;
      current.amountCents += entryAmountCents;
      current.entryCount += 1;
      current.entries.push({ id: entry.id, dateLabel: formatDateAU(entry.date), hoursLabel: `${formatHours(entry.durationMinutes)}h`, amountCents: entryAmountCents, note: entry.notes });
      groups.set(entry.projectId, current);
      return groups;
    }, new Map<string, { projectId: string; project: string; minutes: number; amountCents: number; entryCount: number; entries: Array<{ id: string; dateLabel: string; hoursLabel: string; amountCents: number; note: string | null }> }>()).values()
  ).sort((a, b) => b.amountCents - a.amountCents);

  return (
    <main className="page-shell">
      <LiveTeamRefresh />
      <Link href="/team" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint"><ArrowLeft size={18} aria-hidden="true" />Team</Link>
      {notices.added === "1" || notices.assigned === "1" || notices.paid === "1" || notices.paymentUpdated === "1" || notices.paymentReversed === "1" || notices.timeLogged === "1" || notices.timeUpdated === "1" ? (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-mint/25 bg-mint/10 p-4 text-sm font-bold text-ink" role="status">
          <WalletCards size={19} className="shrink-0 text-mint" aria-hidden="true" />
          {notices.added === "1" ? "Subcontractor added. Assign a project, then you can log their hours immediately." : notices.assigned === "1" ? "Project assigned. You can now log hours for this subcontractor." : notices.timeLogged === "1" ? "Hours saved. Project billing and unpaid wages have updated immediately." : notices.timeUpdated === "1" ? "Subcontractor hours updated. Project billing and wages now use the corrected entry." : notices.paymentReversed === "1" ? "Payment reversed. The hours are unpaid again and the related wage expense was archived." : notices.paymentUpdated === "1" ? "Payment details updated across the wage ledger, source hours and expense record." : "Wage payment recorded and added to payment history."}
        </div>
      ) : null}
      <header className="page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-title">Subcontractor</p>
          <h1 className="page-title">{member.displayName}</h1>
          <p className="page-subtitle">{member.email || "No email added"}</p>
          <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${member.userId ? "border-mint/25 bg-mint/10 text-mint" : "border-line bg-white text-moss"}`}>
            {member.userId ? <UserCheck size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
            {member.userId ? "App access linked" : "Managed by you"}
          </span>
        </div>
        {member.status === "ARCHIVED" ? (
          <ActionForm action={restoreTeamMemberAction}>
            <input type="hidden" name="teamMemberId" value={member.id} />
            <ConfirmSubmitButton className="tap-secondary" message={`Restore ${member.displayName} to your active team? They'll be able to log hours again once reassigned to a project.`} showDefaultIcon={false}>
              <RotateCcw size={18} aria-hidden="true" />
              Restore to team
            </ConfirmSubmitButton>
          </ActionForm>
        ) : (
          <ActionForm action={archiveTeamMemberAction}>
            <input type="hidden" name="teamMemberId" value={member.id} />
            <ConfirmSubmitButton
              className="tap-danger"
              message={`Remove ${member.displayName} from your team? Their active project assignments will end and they'll lose the ability to log new hours. Existing history and payment records stay intact.`}
              showDefaultIcon={false}
            >
              <UserX size={18} aria-hidden="true" />
              Remove from team
            </ConfirmSubmitButton>
          </ActionForm>
        )}
      </header>

      {inviteCode ? <TeamInviteLink code={inviteCode} joinUrl={joinUrl} /> : null}

      {member.status === "ACTIVE" && !member.userId ? (
        <section className="mt-4 flex flex-col gap-3 rounded-xl border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-ink">App access is optional</p>
            <p className="mt-1 text-sm font-medium text-moss">You can keep managing and logging their hours yourself, or send an invitation whenever they are ready.</p>
          </div>
          <ActionForm action={createTeamMemberInvitationAction}>
            <input type="hidden" name="teamMemberId" value={member.id} />
            <SubmitButton className="tap-secondary w-full sm:w-auto" pendingLabel="Creating invitation..."><Link2 size={17} aria-hidden="true" />Invite to app</SubmitButton>
          </ActionForm>
        </section>
      ) : null}

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

      {member.status === "ACTIVE" && activeAssignments.length ? (
        <SubcontractorTimeForm
          assignments={activeAssignments}
          returnTo={`/team/${member.id}?timeLogged=1`}
          managedByOwner
          workerName={member.displayName}
        />
      ) : null}

      {unpaidByProject.length ? (
        <section className="surface-panel mt-4">
          <div className="surface-header flex flex-wrap items-end justify-between gap-3">
            <div><p className="section-title">Pay runs</p><h2 className="mt-1 text-xl font-black">Outstanding wages by project</h2></div>
            <p className="text-sm font-bold text-moss">Total due <span className="ml-1 text-lg text-ink">{formatMoney(unpaidCents)}</span></p>
          </div>
          <div className="grid gap-3 p-3 lg:grid-cols-2">
            {unpaidByProject.map((group) => (
              <PayRunForm
                key={group.projectId}
                teamMemberId={member.id}
                employee={member.displayName}
                projectId={group.projectId}
                project={group.project}
                paidAt={dateInputValue(todayInPerth())}
                entries={group.entries}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <ActionForm action={createProjectAssignmentAction} className="card grid gap-4">
          <input type="hidden" name="teamMemberId" value={member.id} />
          <div className="flex items-center gap-3"><span className="icon-tile"><BriefcaseBusiness size={20} aria-hidden="true" /></span><div><p className="font-black">Assign project</p><p className="text-sm font-medium text-moss">Rates apply to future submitted hours.</p></div></div>
          <label>Project<select name="projectId" required>{projects.map((project) => <option key={project.id} value={project.id}>{project.title} - {project.client.businessName}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">
            <label>Pay rate<input name="payRate" type="number" min="0.01" step="0.01" defaultValue={centsToDollars(member.defaultPayRateCents)} required /></label>
            <label>Client rate<input name="chargeRate" type="number" min="0.01" step="0.01" defaultValue={centsToDollars(member.defaultChargeRateCents)} required /></label>
          </div>
          <SubmitButton className="tap-primary" pendingLabel="Assigning project...">Assign project</SubmitButton>
        </ActionForm>

        <section className="surface-panel">
          <div className="surface-header"><p className="section-title">Assignments</p><h2 className="mt-1 text-xl font-black">Projects shared</h2></div>
          <div className="grid gap-3 p-3">
            {member.assignments.length ? member.assignments.map((assignment) => (
              <article key={assignment.id} className="rounded-lg border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-4"><div><p className="font-black">{assignment.project.title}</p><p className="mt-1 text-sm font-medium text-moss">{assignment.project.client.businessName}</p></div><span className={`status-pill ${assignment.active ? "border-mint/30 bg-mint/10 text-mint" : "border-line bg-paper text-moss"}`}>{assignment.active ? "Active" : "Ended"}</span></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><p className="rounded-lg bg-paper p-2.5"><span className="block text-moss">Pay rate</span><strong>{formatMoney(assignment.payRateCents)}/h</strong></p><p className="rounded-lg bg-paper p-2.5"><span className="block text-moss">Client rate</span><strong>{formatMoney(assignment.chargeRateCents)}/h</strong></p></div>
                {assignment.active ? <ActionForm action={stopProjectAssignmentAction} className="mt-3"><input type="hidden" name="assignmentId" value={assignment.id} /><ConfirmSubmitButton className="tap-secondary w-full" message={`Stop assigning ${member.displayName} to ${assignment.project.title}? Existing hours are preserved.`}><PauseCircle size={18} aria-hidden="true" />End assignment</ConfirmSubmitButton></ActionForm> : null}
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
                <ActionForm action={updateWagePaymentAction} className="grid gap-2 rounded-lg bg-paper p-3"><input type="hidden" name="paymentId" value={payment.id} /><label>Paid date<input type="date" name="paidAt" defaultValue={dateInputValue(payment.paidAt)} required /></label><label>Reference<input name="reference" defaultValue={payment.reference || ""} /></label><SubmitButton className="tap-secondary" pendingLabel="Updating payment...">Update payment</SubmitButton></ActionForm>
                <ActionForm action={reverseWagePaymentAction} className="grid gap-2 rounded-lg border border-gum/20 bg-gum/5 p-3"><input type="hidden" name="paymentId" value={payment.id} /><label>Reversal note<input name="reversalNote" placeholder="Reason for correction" required /></label><ConfirmSubmitButton className="tap-danger" message="Mark this wage payment unpaid? The source hours will return to unpaid and the expense record will be archived." pendingLabel="Reversing payment...">Mark unpaid</ConfirmSubmitButton></ActionForm>
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
                    <div className="mt-2 flex justify-end gap-2">
                      {!isPaid ? <Link href={`/team/time-entries/${entry.id}/edit?returnTo=${encodeURIComponent(`/team/${member.id}`)}`} className="tap-secondary min-h-9 px-3 py-1.5 text-xs"><Pencil size={14} aria-hidden="true" />Edit</Link> : null}
                      <ActionForm action={deleteTeamTimeEntryAction}>
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
                      </ActionForm>
                    </div>
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
