import Link from "next/link";
import { ArrowLeft, Eye, FilePlus } from "lucide-react";
import { createInvoiceDraftAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { endOfDay, formatDateAU, parseInputDate, todayInputValue } from "@/lib/dates";
import { invoiceTotals, timeEntryTotalCents } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function paramValue(params: SearchParams | undefined, key: string) {
  const value = params?.[key];
  return typeof value === "string" ? value : "";
}

export default async function NewInvoicePage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE" },
    include: {
      client: true,
      timeEntries: { where: { billingStatus: "UNBILLED" } },
      expenseItems: { where: { billingStatus: "UNBILLED" } }
    },
    orderBy: { title: "asc" }
  });

  const projectId = paramValue(params, "projectId") || projects[0]?.id || "";
  const startRaw = paramValue(params, "dateRangeStart") || todayInputValue();
  const endRaw = paramValue(params, "dateRangeEnd") || todayInputValue();

  let entries: Awaited<ReturnType<typeof prisma.timeEntry.findMany>> = [];
  let expenses: Awaited<ReturnType<typeof prisma.expenseItem.findMany>> = [];
  const selectedProject = projects.find((project) => project.id === projectId);
  let rangeError = "";

  if (projectId && startRaw && endRaw) {
    try {
      const start = parseInputDate(startRaw);
      const end = endOfDay(parseInputDate(endRaw));
      if (end < start) {
        rangeError = "End date must be after start date.";
      } else {
        [entries, expenses] = await Promise.all([
          prisma.timeEntry.findMany({
            where: { projectId, billingStatus: "UNBILLED", date: { gte: start, lte: end } },
            orderBy: [{ date: "asc" }, { createdAt: "asc" }]
          }),
          prisma.expenseItem.findMany({
            where: { projectId, billingStatus: "UNBILLED", datePurchased: { gte: start, lte: end } },
            orderBy: [{ datePurchased: "asc" }, { createdAt: "asc" }]
          })
        ]);
      }
    } catch {
      rangeError = "Enter a valid date range.";
    }
  }

  const totals = invoiceTotals(entries, expenses);

  return (
    <main className="page-shell">
      <Link href="/invoices" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Invoices
      </Link>
      <header>
        <p className="section-title">New invoice</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">Create invoice draft</h1>
      </header>

      <form className="mt-6 grid gap-4 rounded-lg border border-line bg-white p-4" method="get">
        <label>
          Project
          <select name="projectId" defaultValue={projectId} required>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title} - {project.client.businessName} - {formatHours(project.timeEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0))}h /{" "}
                {project.expenseItems.length} items unbilled
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            Start date
            <input type="date" name="dateRangeStart" defaultValue={startRaw} required />
          </label>
          <label>
            End date
            <input type="date" name="dateRangeEnd" defaultValue={endRaw} required />
          </label>
        </div>
        <button className="tap-secondary" type="submit">
          <Eye size={20} aria-hidden="true" />
          Review Unbilled Work
        </button>
      </form>

      <section className="mt-6">
        <div className="mb-3">
          <p className="section-title">Review</p>
          <h2 className="text-2xl font-black tracking-normal">
            {selectedProject ? selectedProject.title : "Select a project"}
          </h2>
          {selectedProject ? (
            <p className="mt-1 text-sm font-bold text-moss">
              {selectedProject.client.businessName} - found {entries.length} time entr{entries.length === 1 ? "y" : "ies"} and {expenses.length} expense item
              {expenses.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>

        {rangeError ? (
          <p className="rounded-lg border border-gum/30 bg-gum/10 p-4 text-sm font-bold text-gum">{rangeError}</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-3">
              {entries.map((entry) => (
                <article key={entry.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{formatDateAU(entry.date)}</p>
                      <p className="mt-1 text-sm text-moss">{entry.notes || "No notes"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black">{formatHours(entry.durationMinutes)}h</p>
                      <p className="text-sm font-bold text-moss">{formatMoney(timeEntryTotalCents(entry))}</p>
                    </div>
                  </div>
                </article>
              ))}

              {expenses.map((item) => (
                <article key={item.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{item.description}</p>
                      <p className="mt-1 text-sm text-moss">
                        {formatDateAU(item.datePurchased)} - Qty {Number(item.quantity)}
                      </p>
                    </div>
                    <p className="font-black">{formatMoney(item.totalCostCents)}</p>
                  </div>
                </article>
              ))}

              {entries.length === 0 && expenses.length === 0 ? (
                <p className="rounded-lg border border-line bg-white p-4 text-sm font-bold text-moss">
                  No unbilled time entries or expense items found for this range.
                </p>
              ) : null}
            </div>

            <aside className="card h-fit">
              <p className="section-title">Totals</p>
              <dl className="mt-4 grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-bold text-moss">Total hours</dt>
                  <dd className="font-black">{Number(totals.totalHours.toFixed(2))}h</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-bold text-moss">Labour</dt>
                  <dd className="font-black">{formatMoney(totals.labourTotalCents)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-bold text-moss">Items</dt>
                  <dd className="font-black">{formatMoney(totals.itemTotalCents)}</dd>
                </div>
                <div className="border-t border-line pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-bold text-moss">Grand total</dt>
                    <dd className="text-2xl font-black">{formatMoney(totals.grandTotalCents)}</dd>
                  </div>
                </div>
              </dl>

              <form action={createInvoiceDraftAction} className="mt-5">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="dateRangeStart" value={startRaw} />
                <input type="hidden" name="dateRangeEnd" value={endRaw} />
                <button className="tap-primary w-full" type="submit" disabled={entries.length === 0 && expenses.length === 0}>
                  <FilePlus size={20} aria-hidden="true" />
                  Save as Draft
                </button>
              </form>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
