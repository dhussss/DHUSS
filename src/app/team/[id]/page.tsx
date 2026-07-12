import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, Clock3, PauseCircle, WalletCards } from "lucide-react";
import { createProjectAssignmentAction, markTeamMemberPaidAction, stopProjectAssignmentAction } from "@/app/team/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { LiveTeamRefresh } from "@/components/LiveTeamRefresh";
import { requireUserId } from "@/lib/auth";
import { formatDateAU } from "@/lib/dates";
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
        timeEntries: { include: { project: { select: { title: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }
      }
    }),
    prisma.project.findMany({ where: { ownerId, status: "ACTIVE" }, include: { client: true }, orderBy: { title: "asc" } })
  ]);
  if (!member) notFound();

  const approvedUnpaid = member.timeEntries.filter((entry) => entry.approvalStatus === "APPROVED" && entry.paymentStatus === "UNPAID");
  const unpaidMinutes = approvedUnpaid.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const unpaidCents = approvedUnpaid.reduce((sum, entry) => sum + labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0), 0);
  const clientValueCents = approvedUnpaid.reduce((sum, entry) => sum + labourTotalCents(entry.durationMinutes, entry.hourlyRateCentsSnapshot), 0);

  return (
    <main className="page-shell">
      <LiveTeamRefresh />
      <Link href="/team" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint"><ArrowLeft size={18} aria-hidden="true" />Team</Link>
      <header className="page-header">
        <p className="section-title">Subcontractor</p>
        <h1 className="page-title">{member.displayName}</h1>
        <p className="page-subtitle">{member.email || "Linked account"}</p>
      </header>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Approved unpaid" value={`${formatHours(unpaidMinutes)}h`} />
        <Metric label="Amount to pay" value={formatMoney(unpaidCents)} />
        <Metric label="Client value" value={formatMoney(clientValueCents)} />
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
        <h2 className="text-xl font-black">Time history</h2>
        <div className="mt-3 grid gap-3">
          {member.timeEntries.length ? member.timeEntries.map((entry) => (
            <article key={entry.id} className="card flex items-start justify-between gap-4">
              <div><p className="font-black">{entry.project.title}</p><p className="mt-1 text-sm font-medium text-moss">{formatDateAU(entry.date)} · {entry.approvalStatus?.toLowerCase()} · {entry.paymentStatus?.toLowerCase()}</p>{entry.notes ? <p className="mt-2 text-sm text-moss">{entry.notes}</p> : null}</div>
              <div className="text-right"><p className="text-lg font-black">{formatHours(entry.durationMinutes)}h</p><p className="text-sm font-semibold text-moss">{formatMoney(labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0))}</p></div>
            </article>
          )) : <p className="rounded-xl border border-line bg-white p-4 text-sm font-medium text-moss"><Clock3 className="mr-2 inline" size={18} aria-hidden="true" />No team hours logged yet.</p>}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="card"><p className="text-sm font-semibold text-moss">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></article>;
}
