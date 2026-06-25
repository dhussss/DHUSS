import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { updateWorkExpenseAction } from "@/app/actions";
import { WorkExpenseForm } from "@/components/WorkExpenseForm";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | string[] | undefined) {
  return typeof value === "string" && value.startsWith("/") ? value : "/expenses?saved=expense-updated";
}

export default async function EditExpensePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const returnTo = safeReturnTo(query?.returnTo);
  const ownerId = await requireUserId();
  const [expense, projects] = await Promise.all([
    prisma.workExpense.findFirst({
      where: { id, ownerId },
      select: {
        id: true,
        projectId: true,
        date: true,
        category: true,
        description: true,
        vendor: true,
        amountCents: true,
        gstIncluded: true,
        gstAmountCents: true,
        receiptReference: true,
        notes: true,
      }
    }),
    prisma.project.findMany({
      where: { ownerId, status: "ACTIVE" },
      select: { id: true, title: true, client: { select: { businessName: true } } },
      orderBy: { title: "asc" }
    })
  ]);

  if (!expense) notFound();

  return (
    <main className="page-shell">
      <Link href="/expenses" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Expenses
      </Link>
      <header className="page-header">
        <p className="section-title">Edit Expense</p>
        <h1 className="page-title">{expense.description}</h1>
        <p className="page-subtitle">Update the expense record for future reporting and project costing.</p>
      </header>

      <section className="mt-6 max-w-4xl">
        <WorkExpenseForm action={updateWorkExpenseAction} projects={projects} expense={expense} returnTo={returnTo} submitLabel="Save Expense" />
      </section>
    </main>
  );
}
