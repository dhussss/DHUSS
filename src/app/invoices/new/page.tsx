import Link from "next/link";
import { AlertTriangle, ArrowLeft, FilePlus, RefreshCcw, WalletCards } from "lucide-react";
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
      client: { select: { businessName: true, email: true } },
      timeEntries: {
        where: { billingStatus: "UNBILLED", OR: [{ teamMemberId: null }, { approvalStatus: "APPROVED" }] },
        select: { durationMinutes: true }
      },
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
            where: {
              projectId,
              ownerId,
              billingStatus: "UNBILLED",
              OR: [{ teamMemberId: null }, { approvalStatus: "APPROVED" }],
              date: { gte: start, lte: end }
            },
            select: { id: true, date: true, durationMinutes: true, notes: true, hourlyRateCentsSnapshot: true, workerDisplayNameSnapshot: true, teamMemberId: true, payRateCentsSnapshot: true },
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
  const ownerEntries = entries.filter((entry) => !entry.teamMemberId);
  const employeeEntries = entries.filter((entry) => entry.teamMemberId);
  const ownerMinutes = ownerEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const employeeMinutes = employeeEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const ownerBillingCents = ownerEntries.reduce((sum, entry) => sum + timeEntryTotalCents(entry), 0);
  const employeeBillingCents = employeeEntries.reduce((sum, entry) => sum + timeEntryTotalCents(entry), 0);
  const employeeWagesCents = employeeEntries.reduce((sum, entry) => sum + Math.round((entry.durationMinutes / 60) * (entry.payRateCentsSnapshot || 0)), 0);
  const warnings = [
    !profile ? "Create your business profile before sending this invoice." : "",
    profile && !profile.abn ? "Your business profile has no ABN." : "",
    profile && (!profile.bankAccountName || !profile.bsb || !profile.accountNumber) ? "Bank payment details are incomplete." : "",
    selectedProject && !selectedProject.client.email ? "Client email is missing." : "",
    profile?.gstRegistered && !profile.abn ? "GST is enabled but the business profile has no ABN." : "",
    entries.length === 0 && expenses.length === 0 ? "No billable entries or expenses were found for this range." : ""
  ].filter(Boolean);

  return (
    <main className="page-shell">
      <Link href="/invoices" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        Invoices
      </Link>
      <header className="page-header">
        <p className="section-title">New invoice</p>
        <h1 className="page-title">Create invoice draft</h1>
      </header>

      <form className="card mt-5 grid gap-4" method="get">
        <label>
          Project
          <select name="projectId" defaultValue={projectId} required>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        {selectedProject ? (
          <div className="grid gap-2 rounded-lg border border-line bg-paper p-3 text-sm font-bold text-moss sm:grid-cols-3">
            <span>{selectedProject.client.businessName}</span>
            <span>{formatHours(selectedProject.timeEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0))}h unbilled</span>
            <span>{selectedProject.expenseItems.length} expense item{selectedProject.expenseItems.length === 1 ? "" : "s"}</span>
          </div>
        ) : null}
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
            <label className={`flex min-h-12 cursor-pointer grid-cols-none flex-row items-center gap-3 rounded-lg border px-3 ${invoiceMode === "SIMPLE" ? "border-mint bg-mint/10" : "border-line bg-white"}`}>
              <input className="size-5 min-h-0 w-auto" type="radio" name="invoiceMode" value="SIMPLE" defaultChecked={invoiceMode === "SIMPLE"} />
              <span>
                <span className="block font-black">Simple</span>
                <span className="text-xs font-bold text-moss">Only show the bill total.</span>
              </span>
            </label>
            <label className={`flex min-h-12 cursor-pointer grid-cols-none flex-row items-center gap-3 rounded-lg border px-3 ${invoiceMode === "DETAILED" ? "border-mint bg-mint/10" : "border-line bg-white"}`}>
              <input className="size-5 min-h-0 w-auto" type="radio" name="invoiceMode" value="DETAILED" defaultChecked={invoiceMode === "DETAILED"} />
              <span>
                <span className="block font-black">Detailed</span>
                <span className="text-xs font-bold text-moss">Fully detailed breakdown.</span>
              </span>
            </label>
          </div>
        </fieldset>
        <button className="tap-secondary" type="submit">
          <RefreshCcw size={20} aria-hidden="true" />
          Update Invoice
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
                      <p className="mt-1 text-xs font-black uppercase text-mint">{entry.workerDisplayNameSnapshot || "Owner labour"}</p>
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
              <div className="flex items-center gap-2">
                <WalletCards size={18} aria-hidden="true" className="text-mint" />
                <p className="section-title">Estimated totals</p>
              </div>
              <p className="mt-2 text-sm font-bold text-moss">
                Source entries stay unbilled until this draft is marked sent or paid.
              </p>
              <dl className="mt-4 grid gap-3">
                {employeeEntries.length ? (
                  <div className="grid gap-2 rounded-lg border border-mint/25 bg-mint/10 p-3">
                    <div className="flex items-center justify-between gap-3"><dt className="font-bold text-moss">Your labour</dt><dd className="font-black">{formatHours(ownerMinutes)}h · {formatMoney(ownerBillingCents)}</dd></div>
                    <div className="flex items-center justify-between gap-3"><dt className="font-bold text-moss">Employee labour</dt><dd className="font-black">{formatHours(employeeMinutes)}h · {formatMoney(employeeBillingCents)}</dd></div>
                    <div className="flex items-center justify-between gap-3 border-t border-mint/20 pt-2"><dt className="font-bold text-moss">Employee wages</dt><dd className="font-black text-mint">{formatMoney(employeeWagesCents)}</dd></div>
                  </div>
                ) : null}
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
