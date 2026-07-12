import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, Clock3, PauseCircle, WalletCards } from "lucide-react";
import { createProjectAssignmentAction, markTeamMemberPaidAction, reverseWagePaymentAction, stopProjectAssignmentAction, updateWagePaymentAction } from "@/app/team/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { LiveTeamRefresh } from "@/components/LiveTeamRefresh";
import { requireUserId } from "@/lib/auth";
import { dateInputValue, formatDateAU } from "@/lib/dates";
import { centsToDollars, formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { formatHours, labourTotalCents } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerId = await requireUserId();
  const [member, projects] = await Promise.all([
    prisma.teamMember.findFirst({
      where: { id, ownerId },
      include: {
        assignments: { include: { project: { include: { client: true } } }, orderBy: { createdAt: "desc" } },
        timeEntries: { include: { project: { select: { title: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
        wagePayments: { include: { project: { select: { title: true } } }, orderBy: { paidAt: "desc" } }
      }
    }),
    prisma.project.findMany({ where: { ownerId, status: "ACTIVE" }, include: { client: true }, orderBy: { title: "asc" } })
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

  return (
    <main className="page-shell">
      <LiveTeamRefresh />
      <Link href="/team" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint"><ArrowLeft size={18} aria-hidden="true" />Team</Link>
      <header className="page-header">
        <p className="section-title">Subcontractor</p>
        <h1 className="page-title">{member.displayName}</h1>
        <p className="page-subtitle">{member.email || "Linked account"}</p>
      </header>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total hours logged" value={`${formatHours(totalLoggedMinutes)}h`} />
        <Metric label="Ready to invoice" value={formatMoney(unbilledClientValueCents)} />
        <Metric label="Billed wages due" value={formatMoney(billedWagesDueCents)} />
        <Metric label="Amount to pay" value={formatMoney(unpaidCents)} />
      </section>

      {approvedUnpaid.length ? (
        <form action={markTeamMemberPaidAction} className="card mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <input type="hidden" name="teamMemberId" value={member.id} />
          <label>Payment reference (optional)<input name="paymentReference" placeholder="Bank reference or note" /></label>
          <ConfirmSubmitButton className="tap-primary" message={`Mark ${formatMoney(unpaidCents)} for ${member.displayName} as paid?`}><WalletCards size={19} aria-hidden="true" />Mark paid</ConfirmSubmitButton>
        </form>
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
          <button className="tap-primary" type="submit">Assign project</button>
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
              <div className="flex items-start justify-between gap-4"><div><p className="font-black">{payment.project.title}</p><p className="mt-1 text-sm font-semibold text-moss">{formatHours(payment.minutes)}h · {payment.status.toLowerCase()}</p></div><p className="text-xl font-black">{formatMoney(payment.amountCents)}</p></div>
              {payment.status === "PAID" ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <form action={updateWagePaymentAction} className="grid gap-2 rounded-lg bg-paper p-3"><input type="hidden" name="paymentId" value={payment.id} /><label>Paid date<input type="date" name="paidAt" defaultValue={dateInputValue(payment.paidAt)} required /></label><label>Reference<input name="reference" defaultValue={payment.reference || ""} /></label><button className="tap-secondary" type="submit">Update payment</button></form>
                <form action={reverseWagePaymentAction} className="grid gap-2 rounded-lg border border-gum/20 bg-gum/5 p-3"><input type="hidden" name="paymentId" value={payment.id} /><label>Reversal note<input name="reversalNote" placeholder="Reason for correction" required /></label><ConfirmSubmitButton className="tap-danger" message="Mark this wage payment unpaid? The source hours will return to unpaid and the expense record will be archived.">Mark unpaid</ConfirmSubmitButton></form>
              </div> : <p className="mt-3 text-sm font-semibold text-moss">Reversed {payment.reversedAt ? formatDateAU(payment.reversedAt) : ""} · {payment.reversalNote}</p>}
            </article>
          )) : <p className="rounded-2xl border border-line bg-white p-4 text-sm font-medium text-moss">No wage payments recorded yet.</p>}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="text-xl font-black">Time history</h2>
        <div className="mt-3 grid gap-3">
          {member.timeEntries.length ? member.timeEntries.map((entry) => (
            <article key={entry.id} className="card flex items-start justify-between gap-4">
              <div><p className="font-black">{entry.project.title}</p><p className="mt-1 text-sm font-medium text-moss">{formatDateAU(entry.date)} · {entry.approvalStatus?.toLowerCase()} · {entry.paymentStatus?.toLowerCase()}</p>{entry.notes ? <p className="mt-2 text-sm text-moss">{entry.notes}</p> : null}</div>
              <div className="text-right"><p className="text-lg font-black">{formatHours(entry.durationMinutes)}h</p><p className="text-sm font-semibold text-moss">{formatMoney(labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0))}</p></div>
            </article>
          )) : <p className="rounded-2xl border border-line bg-white p-4 text-sm font-medium text-moss"><Clock3 className="mr-2 inline" size={18} aria-hidden="true" />No team hours logged yet.</p>}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="card"><p className="text-sm font-semibold text-moss">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></article>;
}
