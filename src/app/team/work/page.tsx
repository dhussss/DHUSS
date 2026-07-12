import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, CheckCircle2, Clock3, Trash2 } from "lucide-react";
import { deleteMyTimeEntryAction } from "@/app/team/actions";
import { SubcontractorTimeForm } from "@/components/SubcontractorTimeForm";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { LiveTeamRefresh } from "@/components/LiveTeamRefresh";
import { requireUser } from "@/lib/auth";
import { formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { formatHours, labourTotalCents } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AssignedWorkPage() {
  const user = await requireUser();
  const [assignments, entries] = await Promise.all([
    prisma.projectAssignment.findMany({
      where: { active: true, teamMember: { userId: user.id, status: "ACTIVE" }, project: { status: "ACTIVE" } },
      select: { id: true, payRateCents: true, project: { select: { title: true, client: { select: { businessName: true } } }, }, teamMember: { select: { ownerId: true } } },
      orderBy: { project: { title: "asc" } }
    }),
    prisma.timeEntry.findMany({
      where: { createdByUserId: user.id, teamMemberId: { not: null } },
      include: { project: { select: { title: true } }, wagePayment: { select: { paidAt: true, reference: true, status: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 30
    })
  ]);
  const unpaidApproved = entries.filter((entry) => entry.approvalStatus === "APPROVED" && entry.paymentStatus === "UNPAID");
  const unpaidCents = unpaidApproved.reduce((sum, entry) => sum + labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0), 0);

  return (
    <main className="page-shell">
      <LiveTeamRefresh />
      <Link href="/team" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint"><ArrowLeft size={18} aria-hidden="true" />Team</Link>
      <header className="page-header"><p className="section-title">Assigned work</p><h1 className="page-title">Log subcontractor hours</h1><p className="page-subtitle">Hours appear in the project owner&apos;s billing and wages ledger immediately. Your agreed pay rate is shown; their client rate remains private.</p></header>

      {assignments.length ? (
        <>
          <section className="mt-4 grid gap-3 sm:grid-cols-2">
            {assignments.map((assignment) => <article key={assignment.id} className="card"><BriefcaseBusiness className="text-mint" size={20} aria-hidden="true" /><p className="mt-3 font-black">{assignment.project.title}</p><p className="mt-1 text-sm font-medium text-moss">{assignment.project.client.businessName}</p><p className="mt-3 text-sm font-semibold text-moss">You earn {formatMoney(assignment.payRateCents)}/h</p></article>)}
          </section>
          <SubcontractorTimeForm assignments={assignments} />
        </>
      ) : <section className="mt-5 rounded-2xl border border-line bg-white p-5 text-center"><BriefcaseBusiness className="mx-auto text-moss" size={28} aria-hidden="true" /><h2 className="mt-3 text-xl font-black">No assigned projects</h2><p className="mt-2 text-sm font-medium text-moss">Your contractor needs to assign a project before you can log shared hours.</p></section>}

      <section className="mt-7">
        <div className="flex items-end justify-between gap-4"><div><p className="section-title">Recent entries</p><h2 className="mt-1 text-xl font-black">My submitted hours</h2></div><div className="text-right"><p className="text-sm font-semibold text-moss">Approved unpaid</p><p className="font-black">{formatMoney(unpaidCents)}</p></div></div>
        <div className="mt-3 grid gap-3">
          {entries.length ? entries.map((entry) => {
            const canDelete = entry.billingStatus === "UNBILLED" && entry.paymentStatus !== "PAID";
            return (
              <article key={entry.id} className="card flex items-start justify-between gap-4">
                <div>
                  <p className="font-black">{entry.project.title}</p>
                  <p className="mt-1 text-sm font-medium text-moss">{formatDateAU(entry.date)} · {entry.billingStatus.toLowerCase()}</p>
                  {entry.notes ? <p className="mt-2 text-sm text-moss">{entry.notes}</p> : null}
                  {entry.wagePayment ? <p className="mt-2 text-xs font-bold text-mint">Paid {formatDateAU(entry.wagePayment.paidAt)}{entry.wagePayment.reference ? ` · Ref ${entry.wagePayment.reference}` : ""}</p> : null}
                </div>
                <div className="text-right">
                  <p className="text-lg font-black">{formatHours(entry.durationMinutes)}h</p>
                  <p className="text-sm font-semibold text-moss">{formatMoney(labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0))}</p>
                  {entry.paymentStatus === "PAID" ? <CheckCircle2 className="ml-auto mt-2 text-mint" size={17} aria-label="Paid" /> : null}
                  {canDelete ? (
                    <form action={deleteMyTimeEntryAction} className="mt-2">
                      <input type="hidden" name="entryId" value={entry.id} />
                      <ConfirmSubmitButton
                        className="tap-danger min-h-9 px-3 py-1.5 text-xs"
                        message={`Delete this ${formatHours(entry.durationMinutes)}h entry for ${entry.project.title}? This cannot be undone.`}
                        pendingLabel="Deleting..."
                        showDefaultIcon={false}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          }) : <p className="rounded-2xl border border-line bg-white p-4 text-sm font-medium text-moss"><Clock3 className="mr-2 inline" size={18} aria-hidden="true" />No hours logged yet.</p>}
        </div>
      </section>
    </main>
  );
}
