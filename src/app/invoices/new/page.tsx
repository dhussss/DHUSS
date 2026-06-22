import Link from "next/link";
import { AlertTriangle, ArrowLeft, Eye, FilePlus } from "lucide-react";
import { createInvoiceDraftAction } from "@/app/actions";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endOfDay, formatDateAU, parseInputDate, todayInputValue } from "@/lib/dates";
import { invoiceTotals, timeEntryTotalCents, type InvoiceSourceExpense, type InvoiceSourceTimeEntry } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";
import { SubmitButton } from "@/components/SubmitButton";

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
  const ownerId = await requireUserId();
  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE", ownerId },
    select: {
      id: true,
      title: true,
      client: { select: { businessName: true } },
      timeEntries: { where: { billingStatus: "UNBILLED" }, select: { durationMinutes: true } },
      expenseItems: { where: { billingStatus: "UNBILLED" }, select: { id: true } }
    },
    orderBy: { title: "asc" }
  });
  const profile = await prisma.businessProfile.findUnique({
    where: { ownerId },
    select: {
      tradingName: true,
      abn: true,
      bankAccountName: true,
      bsb: true,
      accountNumber: true,
      gstRegistered: true,
      gstRate: true
    }
  });

  const projectId = paramValue(params, "projectId") || projects[0]?.id || "";
  const startRaw = paramValue(params, "dateRangeStart") || todayInputValue();
  const endRaw = paramValue(params, "dateRangeEnd") || todayInputValue();
  const invoiceMode = paramValue(params, "invoiceMode") === "SIMPLE" ? "SIMPLE" : "DETAILED";

  let entries: InvoiceSourceTimeEntry[] = [];
  let expenses: InvoiceSourceExpense[] = [];
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
            where: { projectId, ownerId, billingStatus: "UNBILLED", date: { gte: start, lte: end } },
            select: { id: true, date: true, durationMinutes: true, notes: true, hourlyRateCentsSnapshot: true },
            orderBy: [{ date: "asc" }, { createdAt: "asc" }]
          }),
          prisma.expenseItem.findMany({
            where: { projectId, ownerId, billingStatus: "UNBILLED", datePurchased: { gte: start, lte: end } },
            select: {
              id: true,
              datePurchased: true,
              description: true,
              quantity: true,
              unitCostCents: true,
              totalCostCents: true,
              notes: true
            },
            orderBy: [{ datePurchased: "asc" }, { createdAt: "asc" }]
          })
        ]);
      }
    } catch {
      rangeError = "Enter a valid date range.";
    }
  }

  const totals = invoiceTotals(entries, expenses, {
    registered: profile?.gstRegistered ?? false,
    rate: profile ? Number(profile.gstRate) : 0
  });
  const warnings = [
    !profile ? "Create your business profile before sending this invoice." : "",
    profile && !profile.abn ? "Your business profile has no ABN." : "",
    profile && (!profile.bankAccountName || !profile.bsb || !profile.accountNumber) ? "Bank payment details are incomplete." : "",
    profile?.gstRegistered && !profile.abn ? "GST is enabled but the business profile has no ABN." : "",
    entries.length === 0 && expenses.length === 0 ? "No billable entries or expenses were found for this range." : ""
  ].filter(Boolean);

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
        <fieldset className="grid gap-2">
          <legend className="text-sm font-bold text-moss">Invoice mode</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex min-h-12 cursor-pointer grid-cols-none flex-row items-center gap-3 rounded-lg border border-line bg-white px-3">
              <input className="size-5 min-h-0 w-auto" type="radio" name="invoiceMode" value="SIMPLE" defaultChecked={invoiceMode === "SIMPLE"} />
              <span>
                <span className="block font-black">Simple</span>
                <span className="text-xs font-bold text-moss">One labour line plus expenses.</span>
              </span>
            </label>
            <label className="flex min-h-12 cursor-pointer grid-cols-none flex-row items-center gap-3 rounded-lg border border-line bg-white px-3">
              <input className="size-5 min-h-0 w-auto" type="radio" name="invoiceMode" value="DETAILED" defaultChecked={invoiceMode === "DETAILED"} />
              <span>
                <span className="block font-black">Detailed</span>
                <span className="text-xs font-bold text-moss">Shows each day, hours, rate, and notes.</span>
              </span>
            </label>
          </div>
        </fieldset>
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
              {selectedProject.client.businessName} - {invoiceMode.toLowerCase()} mode - found {entries.length} time entr{entries.length === 1 ? "y" : "ies"} and {expenses.length} expense item
              {expenses.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>

        {rangeError ? (
          <p className="rounded-lg border border-gum/30 bg-gum/10 p-4 text-sm font-bold text-gum">{rangeError}</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-3">
              {warnings.length ? (
                <div className="rounded-lg border border-gum/30 bg-gum/10 p-4 text-sm font-bold text-gum">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertTriangle size={18} aria-hidden="true" />
                    Review before sending
                  </div>
                  <ul className="grid gap-1">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

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
                  <dt className="font-bold text-moss">Expenses</dt>
                  <dd className="font-black">{formatMoney(totals.itemTotalCents)}</dd>
                </div>
                {profile?.gstRegistered ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-bold text-moss">GST ({Number(profile.gstRate)}%)</dt>
                    <dd className="font-black">{formatMoney(totals.gstCents)}</dd>
                  </div>
                ) : null}
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
                <input type="hidden" name="invoiceMode" value={invoiceMode} />
                <SubmitButton className="tap-primary w-full" pendingLabel="Saving draft..." disabled={entries.length === 0 && expenses.length === 0}>
                  <FilePlus size={20} aria-hidden="true" />
                  Save as Draft
                </SubmitButton>
              </form>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
