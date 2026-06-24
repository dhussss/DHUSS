import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { updateExpenseItemAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUserId } from "@/lib/auth";
import { dateInputValue } from "@/lib/dates";
import { centsToDollars } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditExpenseItemPage({
  params
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const ownerId = await requireUserId();
  const item = await prisma.expenseItem.findFirst({
    where: { id: itemId, ownerId },
    include: {
      project: {
        include: { client: true }
      }
    }
  });

  if (!item || item.projectId !== id) notFound();

  return (
    <main className="page-shell">
      <Link href={`/projects/${id}`} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Project
      </Link>

      <header className="page-header">
        <p className="section-title">Edit expense item</p>
        <h1 className="page-title">{item.description}</h1>
        <p className="page-subtitle">
          {item.project.title} · {item.project.client.businessName}
        </p>
      </header>

      <section className="mt-6 max-w-2xl">
        {item.billingStatus === "UNBILLED" ? (
          <form action={updateExpenseItemAction} className="card grid gap-4">
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="projectId" value={item.projectId} />
            <input type="hidden" name="returnTo" value={`/projects/${item.projectId}`} />

            <label>
              Date purchased
              <input name="datePurchased" type="date" defaultValue={dateInputValue(item.datePurchased)} required />
            </label>
            <label>
              Description
              <input name="description" defaultValue={item.description} required />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label>
                Quantity
                <input name="quantity" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={String(Number(item.quantity))} required />
              </label>
              <label>
                Unit cost
                <input name="unitCost" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={centsToDollars(item.unitCostCents)} required />
              </label>
            </div>
            <label>
              Notes
              <textarea name="itemNotes" defaultValue={item.notes ?? ""} />
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <SubmitButton className="tap-primary flex-1" pendingLabel="Saving item...">
                <Save size={18} aria-hidden="true" />
                Save Expense Item
              </SubmitButton>
              <Link href={`/projects/${item.projectId}`} className="tap-secondary">
                Cancel
              </Link>
            </div>
          </form>
        ) : (
          <article className="card text-sm font-bold text-moss">
            This expense item has already been billed, so it cannot be edited from the project log.
          </article>
        )}
      </section>
    </main>
  );
}
