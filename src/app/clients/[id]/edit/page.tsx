import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UsersRound } from "lucide-react";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientEditForm } from "@/components/ClientEditForm";

export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerId = await requireUserId();
  const client = await prisma.client.findFirst({
    where: { id, ownerId },
    select: {
      id: true,
      businessName: true,
      contactName: true,
      email: true,
      phone: true,
      abn: true,
      address: true,
      notes: true
    }
  });

  if (!client) notFound();

  return (
    <main className="page-shell">
      <Link href="/clients" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Clients
      </Link>

      <header>
        <div className="flex items-center gap-2 text-moss">
          <UsersRound size={20} aria-hidden="true" />
          <p className="section-title">Edit client</p>
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-normal">{client.businessName}</h1>
      </header>

      <section className="mt-6 max-w-2xl">
        <ClientEditForm client={client} />
      </section>
    </main>
  );
}
