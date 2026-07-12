import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, Archive, Save, Trash2 } from "lucide-react";
import { archiveProjectAction, deleteProjectAction, updateProjectAction } from "@/app/actions";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { centsToDollars } from "@/lib/money";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function EditProjectPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const deleteError = typeof query?.deleteError === "string" ? query.deleteError : "";
  const ownerId = await requireUserId();
  const [project, clients, invoiceCount, billedTimeCount, billedExpenseCount, wagePaymentCount, unbilledTimeCount, unbilledExpenseCount, assignmentCount] = await Promise.all([
    prisma.project.findFirst({ where: { id, ownerId }, include: { client: true } }),
    prisma.client.findMany({ where: { ownerId }, orderBy: { businessName: "asc" } }),
    prisma.invoice.count({ where: { projectId: id, ownerId } }),
    prisma.timeEntry.count({ where: { projectId: id, ownerId, billingStatus: "BILLED" } }),
    prisma.expenseItem.count({ where: { projectId: id, ownerId, billingStatus: "BILLED" } }),
    prisma.wagePayment.count({ where: { projectId: id, ownerId } }),
    prisma.timeEntry.count({ where: { projectId: id, ownerId, billingStatus: "UNBILLED" } }),
    prisma.expenseItem.count({ where: { projectId: id, ownerId, billingStatus: "UNBILLED" } }),
    prisma.projectAssignment.count({ where: { projectId: id, ownerId } })
  ]);

  if (!project) notFound();
  const deleteBlockers = [
    invoiceCount ? `${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"}` : "",
    billedTimeCount ? `${billedTimeCount} billed time entr${billedTimeCount === 1 ? "y" : "ies"}` : "",
    billedExpenseCount ? `${billedExpenseCount} billed expense item${billedExpenseCount === 1 ? "" : "s"}` : "",
    wagePaymentCount ? `${wagePaymentCount} recorded wage payment${wagePaymentCount === 1 ? "" : "s"}` : ""
  ].filter(Boolean);
  const canDelete = deleteBlockers.length === 0;
  const deleteWipesAway = [
    unbilledTimeCount ? `${unbilledTimeCount} unbilled time entr${unbilledTimeCount === 1 ? "y" : "ies"}` : "",
    unbilledExpenseCount ? `${unbilledExpenseCount} unbilled expense item${unbilledExpenseCount === 1 ? "" : "s"}` : "",
    assignmentCount ? `${assignmentCount} subcontractor assignment${assignmentCount === 1 ? "" : "s"}` : ""
  ].filter(Boolean);

  return (
    <main className="page-shell">
      <Link href={`/projects/${project.id}`} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Project
      </Link>

      <header className="page-header">
        <p className="section-title">Edit project</p>
        <h1 className="page-title">{project.title}</h1>
      </header>

      <section className="mt-6 max-w-2xl">
        {deleteError ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-gum/30 bg-gum/10 p-3 text-sm font-bold text-gum">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{deleteError}</span>
          </div>
        ) : null}

        <form action={updateProjectAction} className="grid gap-5">
          <input type="hidden" name="projectId" value={project.id} />
          <label>
            Project/job name
            <input name="title" defaultValue={project.title} required />
          </label>
          <label>
            Client
            <select name="clientId" defaultValue={project.clientId} required>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.businessName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hourly rate
            <input
              name="hourlyRate"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              defaultValue={centsToDollars(project.currentHourlyRateCents)}
              required
            />
          </label>
          <label>
            Status
            <select name="status" defaultValue={project.status}>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <label>
            Notes
            <textarea name="notes" defaultValue={project.notes ?? ""} />
          </label>
          <SubmitButton className="tap-primary" pendingLabel="Saving changes...">
            <Save size={20} aria-hidden="true" />
            Save Changes
          </SubmitButton>
        </form>

        <form action={archiveProjectAction} className="mt-4">
          <input type="hidden" name="projectId" value={project.id} />
          <SubmitButton className="tap-danger w-full" pendingLabel="Archiving...">
            <Archive size={20} aria-hidden="true" />
            Archive Project
          </SubmitButton>
        </form>

        <section className="mt-4 rounded-lg border border-line bg-white p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gum/10 text-gum">
              <Trash2 size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="font-black text-ink">Delete project</p>
              <p className="mt-1 text-sm font-bold text-moss">
                Deleting is only for unbilled test/setup projects. Archive real project history instead.
              </p>
              {canDelete ? (
                <form action={deleteProjectAction} className="mt-4">
                  <input type="hidden" name="projectId" value={project.id} />
                  <ConfirmSubmitButton
                    className="tap-danger w-full"
                    message={
                      deleteWipesAway.length
                        ? `Delete ${project.title} permanently? This will also permanently remove ${deleteWipesAway.join(", ")}. This cannot be undone.`
                        : `Delete ${project.title} permanently? This cannot be undone.`
                    }
                    pendingLabel="Checking..."
                  >
                    Delete Project
                  </ConfirmSubmitButton>
                </form>
              ) : (
                <div className="mt-4 rounded-lg border border-gum/30 bg-gum/10 p-3 text-sm font-bold text-gum">
                  This project cannot be deleted because it has {deleteBlockers.join(", ")}. Use Archive Project to keep history intact.
                </div>
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
