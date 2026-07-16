import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateProjectForm } from "@/components/CreateProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ownerId = await requireUserId();
  const defaultClientId = typeof params?.clientId === "string" ? params.clientId : undefined;
  const onboarding = params?.onboarding === "1";
  const clients = await prisma.client.findMany({
    where: { ownerId },
    select: { id: true, businessName: true },
    orderBy: { businessName: "asc" }
  });

  return (
    <main className="page-shell">
      <Link href="/projects" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Projects
      </Link>
      <header className="page-header">
        <p className="section-title">New project</p>
        <h1 className="page-title">{onboarding ? "Create your first real job" : "Add a job"}</h1>
        {onboarding ? <p className="page-subtitle">Step 2 of 4. Set the client and the hourly rate you will charge for this work.</p> : null}
      </header>

      <section className="card mt-6 max-w-2xl">
        <CreateProjectForm clients={clients} defaultClientId={defaultClientId} onboarding={onboarding} />
      </section>
    </main>
  );
}
