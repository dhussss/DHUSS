import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Archive, Save } from "lucide-react";
import { archiveProjectAction, deleteProjectAction, updateProjectAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { centsToDollars } from "@/lib/money";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, clients] = await Promise.all([
    prisma.project.findUnique({ where: { id }, include: { client: true } }),
    prisma.client.findMany({ orderBy: { businessName: "asc" } })
  ]);

  if (!project) notFound();

  return (
    <main className="page-shell">
      <Link href={`/projects/${project.id}`} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Project
      </Link>

      <header>
        <p className="section-title">Edit project</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">{project.title}</h1>
      </header>

      <section className="mt-6 max-w-2xl">
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
          <button className="tap-primary" type="submit">
            <Save size={20} aria-hidden="true" />
            Save Changes
          </button>
        </form>

        <form action={archiveProjectAction} className="mt-4">
          <input type="hidden" name="projectId" value={project.id} />
          <button className="tap-danger w-full" type="submit">
            <Archive size={20} aria-hidden="true" />
            Archive Project
          </button>
        </form>

        <form action={deleteProjectAction} className="mt-4">
          <input type="hidden" name="projectId" value={project.id} />
          <ConfirmSubmitButton
            className="tap-danger w-full"
            message={`Delete ${project.title} permanently? This removes the project, all time entries, expense items, invoices, and rate history. This cannot be undone.`}
          >
            Delete Project
          </ConfirmSubmitButton>
        </form>
      </section>
    </main>
  );
}
