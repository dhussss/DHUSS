import Link from "next/link";
import { ArrowLeft, UsersRound } from "lucide-react";
import { ClientCreateForm } from "@/components/ClientCreateForm";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewClientPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  await requireUserId();
  const onboarding = params?.onboarding === "1";

  return (
    <main className="page-shell">
      <Link href="/clients" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Clients
      </Link>

      <header className="page-header">
        <div className="flex items-center gap-2 text-moss">
          <UsersRound size={20} aria-hidden="true" />
          <p className="section-title">New client</p>
        </div>
        <h1 className="page-title">{onboarding ? "Add your first real client" : "Add client"}</h1>
        {onboarding ? <p className="page-subtitle">Step 1 of 4. Use a genuine client you plan to work with. You can edit their details later.</p> : null}
      </header>

      <section className="card mt-6 max-w-2xl">
        <ClientCreateForm onboarding={onboarding} />
      </section>
    </main>
  );
}
