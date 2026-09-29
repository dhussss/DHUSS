
import { ActionForm } from "@/components/ActionForm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, Archive, CheckCircle2, Save, Trash2 } from "lucide-react";
import { archiveProjectAction, deleteProjectAction, updateProjectAction } from "@/app/form-actions";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadProjectControlSummary } from "@/lib/app-data";
import { centsToDollars } from "@/lib/money";
import { projectCloseoutReadiness } from "@/lib/project-control";
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
  const archiveError = typeof query?.archiveError === "string" ? query.archiveError : "";
  const ownerId = await requireUserId();
  const [project, clients, control] = await Promise.all([
    prisma.project.findFirst({ where: { id, ownerId }, include: { client: true } }),
    prisma.client.findMany({ where: { ownerId }, orderBy: { businessName: "asc" } }),
    loadProjectControlSummary(ownerId, id)
  ]);

  if (!project) notFound();
  const closeout = projectCloseoutReadiness(control);
  const deleteBlockers = [
    control.invoiceCount ? `${control.invoiceCount} invoice${control.invoiceCount === 1 ? "" : "s"}` : "",
    control.billedTimeCount ? `${control.billedTimeCount} billed time entr${control.billedTimeCount === 1 ? "y" : "ies"}` : "",
    control.billedExpenseCount ? `${control.billedExpenseCount} billed expense item${control.billedExpenseCount === 1 ? "" : "s"}` : "",
    control.paidWagePaymentCount ? `${control.paidWagePaymentCount} active wage payment${control.paidWagePaymentCount === 1 ? "" : "s"}` : ""
  ].filter(Boolean);
  const canDelete = deleteBlockers.length === 0;
  const deleteWipesAway = [
    control.unbilledTimeCount ? `${control.unbilledTimeCount} unbilled time entr${control.unbilledTimeCount === 1 ? "y" : "ies"}` : "",
    control.unbilledExpenseCount ? `${control.unbilledExpenseCount} unbilled expense item${control.unbilledExpenseCount === 1 ? "" : "s"}` : "",
    control.assignmentCount ? `${control.assignmentCount} subcontractor assignment${control.assignmentCount === 1 ? "" : "s"}` : "",
    control.reversedWagePaymentCount ? `${control.reversedWagePaymentCount} reversed wage payment record${control.reversedWagePaymentCount === 1 ? "" : "s"}` : ""
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
        {archiveError ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-gum/30 bg-gum/10 p-3 text-sm font-bold text-gum">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{archiveError}</span>
          </div>
        ) : null}

        <ActionForm action={updateProjectAction} className="grid gap-5">
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
            Notes
            <textarea name="notes" defaultValue={project.notes ?? ""} />
          </label>
          <SubmitButton className="tap-primary" pendingLabel="Saving changes...">
            <Save size={20} aria-hidden="true" />
            Save Changes
          </SubmitButton>
        </ActionForm>

        {project.status === "ACTIVE" ? (
          <section className="mt-4 rounded-lg border border-line bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${closeout.canArchive ? "bg-mint/10 text-mint" : "bg-yolk/20 text-ink"}`}>
                {closeout.canArchive ? <CheckCircle2 size={20} aria-hidden="true" /> : <Archive size={20} aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-black text-ink">Project closeout</p>
                <p className="mt-1 text-sm font-bold leading-6 text-moss">
                  {closeout.canArchive
                    ? "Billing and subcontractor obligations are clear. This project is ready to archive."
                    : "Finish the items below before archiving so work and wages do not disappear from active follow-up."}
                </p>
                {closeout.blockers.length ? (
                  <ul className="mt-3 grid gap-2 text-sm font-semibold text-ink">
                    {closeout.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}
                  </ul>
                ) : null}
                {closeout.warnings.length ? (
                  <div className="mt-3 rounded-lg border border-yolk/50 bg-yolk/10 p-3 text-sm font-semibold text-ink">
                    {closeout.warnings.join(". ")}. Archiving is allowed, and payment follow-up will remain on the invoice dashboard.
                  </div>
                ) : null}
                <ActionForm action={archiveProjectAction} className="mt-4">
                  <input type="hidden" name="projectId" value={project.id} />
                  <ConfirmSubmitButton
                    className="tap-danger w-full"
                    disabled={!closeout.canArchive}
                    message={`Archive ${project.title}? The complete project history will remain available in Archived projects.`}
                    pendingLabel="Archiving..."
                    showDefaultIcon={false}
                  >
                    <Archive size={20} aria-hidden="true" />
                    Archive Project
                  </ConfirmSubmitButton>
                </ActionForm>
              </div>
            </div>
          </section>
        ) : null}

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
                <ActionForm action={deleteProjectAction} className="mt-4">
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
                </ActionForm>
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
