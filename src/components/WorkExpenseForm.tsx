import type { WorkExpenseCategory, WorkExpenseStatus } from "@prisma/client";
import { Save } from "lucide-react";
import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { dateInputValue } from "@/lib/dates";
import { centsToDollars } from "@/lib/money";
import { expenseCategoryOptions, expenseStatusOptions } from "@/lib/expenses";

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
  paymentMethod?: string | null;
  receiptReference?: string | null;
  notes?: string | null;
  billable?: boolean;
  status?: WorkExpenseStatus;
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
          Amount
          <input name="amount" type="number" inputMode="decimal" min="0" step="0.01" required defaultValue={expense?.amountCents ? centsToDollars(expense.amountCents) : ""} />
        </label>
        <label className="flex min-h-12 cursor-pointer grid-cols-none flex-row items-center gap-3 rounded-lg border border-line bg-white px-3">
          <input className="size-5 min-h-0 w-auto" name="gstIncluded" type="checkbox" defaultChecked={expense?.gstIncluded ?? false} />
          GST included
        </label>
        <label>
          GST amount
          <input name="gstAmount" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={expense?.gstAmountCents ? centsToDollars(expense.gstAmountCents) : ""} />
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
          Status
          <select name="status" defaultValue={expense?.status ?? "LOGGED"}>
            {expenseStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Payment method
          <input name="paymentMethod" defaultValue={expense?.paymentMethod ?? ""} />
        </label>
        <label>
          Receipt/reference
          <input name="receiptReference" defaultValue={expense?.receiptReference ?? ""} />
        </label>
        <label className="flex min-h-12 cursor-pointer grid-cols-none flex-row items-center gap-3 rounded-lg border border-line bg-white px-3">
          <input className="size-5 min-h-0 w-auto" name="billable" type="checkbox" defaultChecked={expense?.billable ?? false} />
          Billable/reimbursable
        </label>
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
        <Link href="/expenses" className="tap-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
