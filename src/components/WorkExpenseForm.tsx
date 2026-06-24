import type { WorkExpenseCategory } from "@prisma/client";
import { Save } from "lucide-react";
import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { dateInputValue } from "@/lib/dates";
import { centsToDollars } from "@/lib/money";
import { expenseCategoryOptions } from "@/lib/expenses";

type ExpenseProjectOption = {
  id: string;
  title: string;
  client: { businessName: string };
};

type WorkExpenseValue = {
  id?: string;
  projectId?: string | null;
  date?: Date;
  category?: WorkExpenseCategory;
  description?: string;
  vendor?: string | null;
  amountCents?: number;
  gstIncluded?: boolean;
  gstAmountCents?: number;
  receiptReference?: string | null;
  notes?: string | null;
};

export function WorkExpenseForm({
  action,
  projects,
  expense,
  returnTo,
  submitLabel = "Save Expense"
}: {
  action: (formData: FormData) => Promise<void>;
  projects: ExpenseProjectOption[];
  expense?: WorkExpenseValue;
  returnTo: string;
  submitLabel?: string;
}) {
  return (
    <form action={action} className="card grid gap-4">
      {expense?.id ? <input type="hidden" name="expenseId" value={expense.id} /> : null}
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="status" value="LOGGED" />

      <div className="grid gap-4 md:grid-cols-2">
        <label>
          Date
          <input name="date" type="date" required defaultValue={expense?.date ? dateInputValue(expense.date) : dateInputValue(new Date())} />
        </label>
        <label>
          Category
          <select name="category" defaultValue={expense?.category ?? "TOOLS"}>
            {expenseCategoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="md:col-span-2">
          Description
          <input name="description" required defaultValue={expense?.description ?? ""} />
        </label>
        <label>
          Supplier/vendor
          <input name="vendor" defaultValue={expense?.vendor ?? ""} />
        </label>
        <label>
          Amount paid
          <input name="amountPaid" type="number" inputMode="decimal" min="0" step="0.01" required defaultValue={expense?.amountCents ? centsToDollars(expense.amountCents) : ""} />
        </label>
        <label className="flex min-h-12 cursor-pointer grid-cols-none flex-row items-center gap-3 rounded-lg border border-line bg-white px-3">
          <input className="size-5 min-h-0 w-auto" name="calculateGst" type="checkbox" defaultChecked={expense?.gstIncluded ?? false} />
          Calculate GST from amount paid
        </label>
        <label>
          Project allocation
          <select name="projectId" defaultValue={expense?.projectId ?? "__none"}>
            <option value="__none">General work expense</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title} - {project.client.businessName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Receipt/reference
          <input name="receiptReference" defaultValue={expense?.receiptReference ?? ""} />
        </label>
        {expense?.gstIncluded && expense.gstAmountCents ? (
          <p className="rounded-lg border border-line bg-paper p-3 text-sm font-bold text-moss">
            Current GST estimate: {centsToDollars(expense.gstAmountCents)}
          </p>
        ) : null}
        <label className="md:col-span-2">
          Notes
          <textarea name="notes" defaultValue={expense?.notes ?? ""} />
        </label>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton className="tap-primary flex-1" pendingLabel="Saving expense...">
          <Save size={18} aria-hidden="true" />
          {submitLabel}
        </SubmitButton>
        <Link href={returnTo} className="tap-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
