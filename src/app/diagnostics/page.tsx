import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { previousWeekMondayToSunday } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "hnd1";

type SearchParams = Record<string, string | string[] | undefined>;

type TimingResult<T> = {
  label: string;
  durationMs: number;
  result: T;
};

function isAuthorised(token: string) {
  const configuredToken = process.env.BACKUP_EXPORT_TOKEN;
  if (!configuredToken && process.env.NODE_ENV === "production") return false;
  if (!configuredToken) return true;

  return token === configuredToken;
}

function formatMs(value: number) {
  return `${value.toFixed(2)} ms`;
}

async function timed<T>(label: string, operation: () => Promise<T>): Promise<TimingResult<T>> {
  const startedAt = performance.now();
  const result = await operation();

  return {
    label,
    durationMs: performance.now() - startedAt,
    result
  };
}

function extractRegion(vercelId: string | null) {
  if (!vercelId) return null;
  return vercelId.split("::").find(Boolean) ?? vercelId;
}

function TimingRow({ label, durationMs, detail }: { label: string; durationMs: number; detail?: string }) {
  return (
    <tr className="border-t border-line">
      <th className="py-3 pr-4 text-left text-sm font-bold text-moss">{label}</th>
      <td className="py-3 pr-4 text-right font-black">{formatMs(durationMs)}</td>
      <td className="py-3 text-sm font-bold text-moss">{detail ?? ""}</td>
    </tr>
  );
}

export default async function DiagnosticsPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const pageStartedAt = performance.now();
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : "";

  if (!isAuthorised(token)) {
    return (
      <main className="page-shell">
        <p className="section-title">Diagnostics</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">Not authorised</h1>
        <p className="mt-4 rounded-lg border border-line bg-white p-4 text-sm font-bold text-moss">
          Open this page with /diagnostics?token=&lt;BACKUP_EXPORT_TOKEN&gt;.
        </p>
      </main>
    );
  }

  const requestHeaders = await headers();
  const vercelId = requestHeaders.get("x-vercel-id");
  const previousWeek = previousWeekMondayToSunday();

  const simpleServerTiming = await timed("Simple server timing check", async () => Promise.resolve("ok"));
  const prismaPing = await timed("Prisma connection/query", async () => prisma.$queryRaw`SELECT 1`);
  const clientCount = await timed("Client count query", async () => prisma.client.count());
  const projectCount = await timed("Project count query", async () => prisma.project.count());
  const timeEntryCount = await timed("Time entry count query", async () => prisma.timeEntry.count());

  const dashboardStartedAt = performance.now();
  const dashboardTimings = await Promise.all([
    timed("Dashboard active projects", async () =>
      prisma.project.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, title: true, client: { select: { businessName: true } } },
        orderBy: { updatedAt: "desc" }
      })
    ),
    timed("Dashboard sent invoices", async () =>
      prisma.invoice.findMany({
        where: { status: "SENT" },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          invoiceDate: true,
          grandTotalCents: true,
          project: { select: { title: true } }
        },
        orderBy: { invoiceDate: "desc" }
      })
    ),
    timed("Dashboard paid invoices", async () =>
      prisma.invoice.findMany({
        where: { status: "PAID", paymentDate: { not: null } },
        select: { paymentDate: true, grandTotalCents: true },
        orderBy: { paymentDate: "desc" }
      })
    ),
    timed("Dashboard unbilled time", async () =>
      prisma.timeEntry.findMany({
        where: { billingStatus: "UNBILLED" },
        select: { durationMinutes: true, hourlyRateCentsSnapshot: true },
        orderBy: { date: "desc" }
      })
    ),
    timed("Dashboard unbilled items", async () =>
      prisma.expenseItem.findMany({
        where: { billingStatus: "UNBILLED" },
        select: { totalCostCents: true },
        orderBy: { datePurchased: "desc" }
      })
    ),
    timed("Dashboard previous week hours", async () =>
      prisma.timeEntry.findMany({
        where: {
          date: {
            gte: previousWeek.start,
            lte: previousWeek.endInclusive
          }
        },
        select: {
          id: true,
          date: true,
          durationMinutes: true,
          notes: true,
          project: { select: { title: true, client: { select: { businessName: true } } } }
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }]
      })
    )
  ]);
  const dashboardTotalMs = performance.now() - dashboardStartedAt;
  const totalServerMs = performance.now() - pageStartedAt;

  return (
    <main className="page-shell">
      <header>
        <p className="section-title">Private Diagnostics</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">App performance</h1>
      </header>

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <article className="card">
          <p className="text-sm font-bold text-moss">Vercel region env</p>
          <p className="mt-2 text-xl font-black">{process.env.VERCEL_REGION ?? "Not available"}</p>
        </article>
        <article className="card">
          <p className="text-sm font-bold text-moss">Region from header</p>
          <p className="mt-2 text-xl font-black">{extractRegion(vercelId) ?? "Not available"}</p>
        </article>
        <article className="card">
          <p className="text-sm font-bold text-moss">x-vercel-id</p>
          <p className="mt-2 break-words text-sm font-black">{vercelId ?? "Not available"}</p>
        </article>
      </section>

      <section className="card mt-6 overflow-x-auto">
        <h2 className="text-xl font-black tracking-normal">Core timings</h2>
        <table className="mt-4 w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="text-left text-xs font-bold uppercase text-moss">
              <th className="pb-2 pr-4">Measure</th>
              <th className="pb-2 pr-4 text-right">Time</th>
              <th className="pb-2">Detail</th>
            </tr>
          </thead>
          <tbody>
            <TimingRow label="Simple server response time" durationMs={totalServerMs} detail="Full diagnostics page render" />
            <TimingRow label={simpleServerTiming.label} durationMs={simpleServerTiming.durationMs} detail="No database work" />
            <TimingRow label={prismaPing.label} durationMs={prismaPing.durationMs} detail="SELECT 1 through Prisma" />
            <TimingRow label={clientCount.label} durationMs={clientCount.durationMs} detail={`${clientCount.result} clients`} />
            <TimingRow label={projectCount.label} durationMs={projectCount.durationMs} detail={`${projectCount.result} projects`} />
            <TimingRow label={timeEntryCount.label} durationMs={timeEntryCount.durationMs} detail={`${timeEntryCount.result} time entries`} />
          </tbody>
        </table>
      </section>

      <section className="card mt-6 overflow-x-auto">
        <h2 className="text-xl font-black tracking-normal">Dashboard query timings</h2>
        <table className="mt-4 w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="text-left text-xs font-bold uppercase text-moss">
              <th className="pb-2 pr-4">Query</th>
              <th className="pb-2 pr-4 text-right">Time</th>
              <th className="pb-2">Rows</th>
            </tr>
          </thead>
          <tbody>
            <TimingRow label="Dashboard parallel query group" durationMs={dashboardTotalMs} detail="All dashboard queries in Promise.all" />
            {dashboardTimings.map((item) => (
              <TimingRow key={item.label} label={item.label} durationMs={item.durationMs} detail={`${item.result.length} rows`} />
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
