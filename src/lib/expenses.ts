import type { WorkExpenseCategory, WorkExpenseStatus } from "@prisma/client";

export const expenseCategoryOptions: { value: WorkExpenseCategory; label: string }[] = [
  { value: "TOOLS", label: "Tools" },
  { value: "MATERIALS", label: "Materials" },
  { value: "FUEL", label: "Fuel" },
  { value: "VEHICLE", label: "Vehicle" },
  { value: "PPE", label: "PPE" },
  { value: "PHONE_INTERNET", label: "Phone/Internet" },
  { value: "TRAINING_TICKETS", label: "Training/Tickets" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "SOFTWARE", label: "Software" },
  { value: "SUBCONTRACTOR", label: "Subcontractor" },
  { value: "OTHER", label: "Other" }
];

export const expenseStatusOptions: { value: WorkExpenseStatus; label: string }[] = [
  { value: "LOGGED", label: "Logged" },
  { value: "ALLOCATED", label: "Allocated" },
  { value: "INVOICED_REIMBURSED", label: "Invoiced/Reimbursed" },
  { value: "TAX_RECORD_ONLY", label: "Tax record only" }
];

export function expenseCategoryLabel(category: WorkExpenseCategory | string) {
  return expenseCategoryOptions.find((option) => option.value === category)?.label ?? "Other";
}

export function expenseStatusLabel(status: WorkExpenseStatus | string) {
  return expenseStatusOptions.find((option) => option.value === status)?.label ?? "Logged";
}
