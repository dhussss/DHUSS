import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateProjectForm } from "@/components/CreateProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const ownerId = await requireUserId();
  const clients = await prisma.client.findMany({
    where: { ownerId },
    orderBy: { businessName: "asc" }
  });

  return (
    <main className="page-shell">
      <Link href="/projects" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Projects
      </Link>
      <header>
        <p className="section-title">New project</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">Add a job</h1>
      </header>

      <section className="mt-6 max-w-2xl">
        <CreateProjectForm clients={clients} />
      </section>
    </main>
  );
}
