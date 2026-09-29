
import { ActionForm } from "@/components/ActionForm";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Link2, RotateCcw, UserPlus, UsersRound, WalletCards } from "lucide-react";
import { createTeamMemberAction, restoreTeamMemberAction, revokeTeamInvitationAction } from "@/app/form-actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import { LiveTeamRefresh } from "@/components/LiveTeamRefresh";
import { requireUser } from "@/lib/auth";
import { formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { formatHours, labourTotalCents } from "@/lib/time";
import { LearnHowLink } from "@/components/LearnHowLink";

export const dynamic = "force-dynamic";

export default async function TeamPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const params = await searchParams;
  const [members, archivedMembers, invitations, workerAssignments] = await Promise.all([
    prisma.teamMember.findMany({
      where: { ownerId: user.id, status: "ACTIVE" },
      include: { timeEntries: { where: { approvalStatus: "APPROVED", paymentStatus: "UNPAID" }, select: { durationMinutes: true, payRateCentsSnapshot: true } }, assignments: { where: { active: true }, select: { id: true } } },
      orderBy: { displayName: "asc" }
    }),
    prisma.teamMember.findMany({
      where: { ownerId: user.id, status: "ARCHIVED" },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" }
    }),
    prisma.teamInvitation.findMany({ where: { ownerId: user.id, status: "PENDING", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
    prisma.projectAssignment.count({ where: { active: true, teamMember: { userId: user.id, status: "ACTIVE" } } })
  ]);

  return (
    <main className="page-shell">
      <LiveTeamRefresh />
      <header className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="section-title">Team</p><h1 className="page-title">Subcontractors</h1><p className="page-subtitle">Add your workers now, log or receive their hours, and keep client billing and wages connected.</p><LearnHowLink tutorialKey="team-setup" className="mt-2">Learn the team workflow</LearnHowLink></div>
        <Link href="/team/payments" className="tap-secondary"><WalletCards size={18} aria-hidden="true" />Payroll register</Link>
      </header>

      {params?.archived ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm font-bold text-moss">
          <CheckCircle2 size={18} aria-hidden="true" />
          Subcontractor removed from your team. Their history stays intact.
        </div>
      ) : null}

      {workerAssignments ? (
        <Link href="/team/work" className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-mint/25 bg-mint/10 p-4 text-ink">
          <span><span className="block font-black">Work assigned to me</span><span className="mt-1 block text-sm font-medium text-moss">Log hours on projects shared with you.</span></span>
          <ArrowRight size={20} className="text-mint" aria-hidden="true" />
        </Link>
      ) : null}

      <section className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <ActionForm action={createTeamMemberAction} className="card grid gap-4">
          <div className="flex items-center gap-3"><span className="icon-tile"><UserPlus size={20} aria-hidden="true" /></span><div><p className="font-black">Add subcontractor</p><p className="text-sm font-medium text-moss">No account or invitation required. You can give them app access later.</p></div></div>
          <label>Name<input name="subcontractorName" required /></label>
          <label>Email (optional)<input name="subcontractorEmail" type="email" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label>Pay rate<input name="payRate" type="number" min="0.01" step="0.01" inputMode="decimal" required /></label>
            <label>Client rate<input name="chargeRate" type="number" min="0.01" step="0.01" inputMode="decimal" required /></label>
          </div>
          <SubmitButton className="tap-primary" pendingLabel="Adding subcontractor..."><UserPlus size={19} aria-hidden="true" />Add to team</SubmitButton>
        </ActionForm>

        <section className="surface-panel">
          <div className="surface-header flex items-center justify-between"><div><p className="section-title">People</p><h2 className="mt-1 text-xl font-black">Active team</h2></div><UsersRound className="text-mint" size={22} aria-hidden="true" /></div>
          <div className="grid gap-3 p-3">
            {members.length ? members.map((member) => {
              const unpaidCents = member.timeEntries.reduce((sum, entry) => sum + labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0), 0);
              const unpaidMinutes = member.timeEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
              return (
                <Link key={member.id} href={`/team/${member.id}`} className="flex items-center justify-between gap-4 rounded-lg border border-line bg-white p-4 transition hover:border-mint/50">
                  <span><span className="block font-black text-ink">{member.displayName}</span><span className="mt-1 block text-sm font-medium text-moss">{member.assignments.length} active project{member.assignments.length === 1 ? "" : "s"} · {formatHours(unpaidMinutes)}h unpaid</span><span className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-mint"><Link2 size={13} aria-hidden="true" />{member.userId ? "App account linked" : "Managed by you"}</span></span>
                  <span className="text-right"><span className="block font-black">{formatMoney(unpaidCents)}</span><ArrowRight className="ml-auto mt-1 text-mint" size={17} aria-hidden="true" /></span>
                </Link>
              );
            }) : <p className="rounded-lg bg-paper p-4 text-sm font-medium text-moss">No subcontractors yet. Add the first person without waiting for them to create an account.</p>}
          </div>
        </section>
      </section>

      {invitations.length ? (
        <section className="mt-6"><h2 className="text-xl font-black">Pending invitations</h2><div className="mt-3 grid gap-3">{invitations.map((invitation) => <article key={invitation.id} className="card flex items-center justify-between gap-4"><div><p className="font-black">{invitation.subcontractorName}</p><p className="mt-1 text-sm font-medium text-moss">Expires {formatDateAU(invitation.expiresAt)}</p></div><ActionForm action={revokeTeamInvitationAction}><input type="hidden" name="invitationId" value={invitation.id} /><SubmitButton className="tap-danger" pendingLabel="Revoking...">Revoke</SubmitButton></ActionForm></article>)}</div></section>
      ) : null}

      {!members.length ? <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-sm font-medium text-moss"><WalletCards size={20} aria-hidden="true" />Assign a project and log their hours to start the billing and wage trail.</div> : null}

      {archivedMembers.length ? (
        <section className="mt-6">
          <h2 className="text-xl font-black">Removed from team</h2>
          <div className="mt-3 grid gap-3">
            {archivedMembers.map((member) => (
              <article key={member.id} className="card flex items-center justify-between gap-4">
                <Link href={`/team/${member.id}`} className="font-black text-ink hover:text-mint">{member.displayName}</Link>
                <ActionForm action={restoreTeamMemberAction}>
                  <input type="hidden" name="teamMemberId" value={member.id} />
                  <ConfirmSubmitButton className="tap-secondary" message={`Restore ${member.displayName} to your active team?`} showDefaultIcon={false}>
                    <RotateCcw size={17} aria-hidden="true" />
                    Restore
                  </ConfirmSubmitButton>
                </ActionForm>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
