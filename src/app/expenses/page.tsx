import Link from "next/link";
import { Archive, ArrowRight, CheckCircle2, Pencil, ReceiptText, RotateCcw } from "lucide-react";
import { archiveWorkExpenseAction, createWorkExpenseAction, deleteWorkExpenseAction, restoreWorkExpenseAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { WorkExpenseForm } from "@/components/WorkExpenseForm";
import { requireUserId } from "@/lib/auth";
import { dateInputValue, formatDateAU, todayInPerth } from "@/lib/dates";
import { expenseCategoryLabel } from "@/lib/expenses";
import { getExpensesPageData } from "@/lib/app-data";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function financialYearStart(date: Date) {
  const year = date.getUTCFullYear();
  return new Date(Date.UTC(date.getUTCMonth() >= 6 ? year : year - 1, 6, 1));
}

export default async function ExpensesPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const ownerId = await requireUserId();
  const today = todayInPerth();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const fyStart = financialYearStart(today);
  const [expenses, projects] = await Promise.all([
    getExpensesPageData(ownerId),
    prisma.project.findMany({
      where: { ownerId, status: "ACTIVE" },
      select: { id: true, title: true, client: { select: { businessName: true } } },
      orderBy: { title: "asc" }
    })
  ]);

  const activeExpenses = expenses.filter((expense) => !expense.archivedAt);
  const monthTotal = activeExpenses.filter((expense) => expense.date >= monthStart && expense.date <= today).reduce((sum, expense) => sum + expense.amountCents, 0);
  const fyTotal = activeExpenses.filter((expense) => expense.date >= fyStart && expense.date <= today).reduce((sum, expense) => sum + expense.amountCents, 0);
  const gstTotal = activeExpenses.reduce((sum, expense) => sum + expense.gstAmountCents, 0);

  return (
    <main className="page-shell max-w-[92rem]">
      <header className="page-header">
        <p className="section-title">Expenses</p>
        <h1 className="page-title">Work expense register</h1>
        <p className="page-subtitle">Track work-related costs for tax planning and project allocation. Archived records stay out of the active totals.</p>
      </header>

      {params?.saved ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm font-bold text-moss">
          <CheckCircle2 size={18} aria-hidden="true" />
          Expense saved.
        </div>
      ) : null}

      <section className="expense-summary-strip mt-5">
        <SummaryTile label="This month" value={formatMoney(monthTotal)} />
        <SummaryTile label="Financial year" value={formatMoney(fyTotal)} />
        <SummaryTile label="GST estimate" value={formatMoney(gstTotal)} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <span className="icon-tile">
              <ReceiptText size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="section-title">New expense</p>
              <h2 className="text-xl font-black">Log a work cost</h2>
            </div>
          </div>
          <WorkExpenseForm action={createWorkExpenseAction} projects={projects} returnTo="/expenses?saved=expense-created" submitLabel="Add Expense" />
        </div>

        <section className="surface-panel expense-register">
          <div className="surface-header">
            <p className="section-title">Register</p>
            <h2 className="mt-1 text-2xl font-black">Logged expenses</h2>
          </div>
          <div>
            {expenses.length ? (
              expenses.map((expense) => {
                const wageLinked = Boolean(expense.wagePayment);
                return (
                <article key={expense.id} className={`expense-row ${expense.archivedAt ? "opacity-70" : ""}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-black text-ink">{expense.description}</p>
                        {expense.archivedAt ? <span className="status-pill border-line bg-paper text-moss">archived</span> : null}
                        {wageLinked ? <span className="status-pill border-mint/30 bg-mint/10 text-mint">wage payment</span> : null}
                      </div>
                      <p className="mt-1 text-sm font-medium text-moss">
                        {formatDateAU(dateInputValue(expense.date))} · {expenseCategoryLabel(expense.category)}
                      </p>
                      {expense.vendor ? <p className="mt-1 text-sm font-medium text-moss">Supplier: {expense.vendor}</p> : null}
                    </div>
                    <p className="text-2xl font-black text-ink">{formatMoney(expense.amountCents)}</p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-moss">
                    {expense.gstIncluded ? <span className="rounded-full bg-paper px-2 py-1">GST {formatMoney(expense.gstAmountCents)}</span> : null}
                    {expense.project ? (
                      <Link href={`/projects/${expense.project.id}`} className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-1 transition hover:text-mint">
                        {expense.project.title} <ArrowRight size={13} aria-hidden="true" />
                      </Link>
                    ) : (
                      <span className="rounded-full bg-paper px-2 py-1">general</span>
                    )}
                  </div>

                  {expense.notes || expense.receiptReference ? (
                    <p className="mt-3 text-sm font-medium leading-6 text-moss">
                      {[expense.receiptReference ? `Ref ${expense.receiptReference}` : "", expense.notes ?? ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}

                  {wageLinked ? (
                    <div className="mt-4 rounded-lg border border-line bg-paper p-3 text-sm font-bold text-moss">
                      Generated from a wage payment.{" "}
                      <Link href={`/team/${expense.wagePayment?.teamMemberId}`} className="text-mint">
                        Manage it from Team
                      </Link>
                      .
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Link href={`/expenses/${expense.id}/edit`} className="tap-secondary px-3">
                        <Pencil size={17} aria-hidden="true" />
                        Edit
                      </Link>
                      {expense.archivedAt ? (
                        <form action={restoreWorkExpenseAction}>
                          <input type="hidden" name="expenseId" value={expense.id} />
                          <input type="hidden" name="returnTo" value="/expenses" />
                          <button className="tap-secondary w-full px-3" type="submit">
                            <RotateCcw size={17} aria-hidden="true" />
                            Restore
                          </button>
                        </form>
                      ) : (
                        <form action={archiveWorkExpenseAction}>
                          <input type="hidden" name="expenseId" value={expense.id} />
                          <input type="hidden" name="returnTo" value="/expenses" />
                          <button className="tap-secondary w-full px-3" type="submit">
                            <Archive size={17} aria-hidden="true" />
                            Archive
                          </button>
                        </form>
                      )}
                      <form action={deleteWorkExpenseAction}>
                        <input type="hidden" name="expenseId" value={expense.id} />
                        <input type="hidden" name="returnTo" value="/expenses" />
                        <ConfirmSubmitButton className="tap-danger px-3" message={`Delete expense "${expense.description}"? This permanently removes it from the register.`}>
                          Delete
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  )}
                </article>
                );
              })
            ) : (
              <div className="rounded-lg border border-line bg-white p-5 text-sm font-bold text-moss">No work expenses logged yet.</div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
