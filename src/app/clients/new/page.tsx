import Link from "next/link";
import { ArrowLeft, UsersRound } from "lucide-react";
import { ClientCreateForm } from "@/components/ClientCreateForm";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  await requireUserId();

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
        <h1 className="page-title">Add client</h1>
      </header>

      <section className="card mt-6 max-w-2xl">
        <ClientCreateForm />
      </section>
    </main>
  );
}
