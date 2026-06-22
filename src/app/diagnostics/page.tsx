import { headers } from "next/headers";
import tls from "node:tls";
import { Prisma } from "@prisma/client";
import { loadDashboardData } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import { prismaRuntimeDiagnostics } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "syd1";

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

function databaseUrlDiagnostics() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    return {
      configured: false,
      protocol: "Not available",
      host: "Not available",
      port: "Not available",
      pgbouncer: "Not available",
      connectionLimit: "Not available",
      usesAccelerateOrDataProxy: false
    };
  }

  const url = new URL(raw);
    return {
      configured: true,
      protocol: url.protocol,
      host: url.hostname,
      port: url.port || "5432",
    pgbouncer: url.searchParams.get("pgbouncer") ?? "not set",
    connectionLimit: url.searchParams.get("connection_limit") ?? "not set",
    usesAccelerateOrDataProxy: url.protocol === "prisma:" || url.hostname.includes("prisma-data") || url.hostname.includes("accelerate")
  };
}

async function tlsConnectTiming() {
  const database = databaseUrlDiagnostics();
  if (!database.configured || database.host === "Not available") {
    return { ok: false, durationMs: 0, detail: "DATABASE_URL is not configured." };
  }

  const startedAt = performance.now();
  return new Promise<{ ok: boolean; durationMs: number; detail: string }>((resolve) => {
    const socket = tls.connect({
      host: database.host,
      port: Number(database.port),
      servername: database.host,
      rejectUnauthorized: true,
      timeout: 5000
    });

    socket.once("secureConnect", () => {
      const durationMs = performance.now() - startedAt;
      socket.end();
      resolve({ ok: true, durationMs, detail: `TLS connect to ${database.host}:${database.port}` });
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolve({ ok: false, durationMs: performance.now() - startedAt, detail: "TLS connection timed out." });
    });

    socket.once("error", (error) => {
      resolve({ ok: false, durationMs: performance.now() - startedAt, detail: error.message });
    });
  });
}

function diagnosis({
  prismaPingMs,
  dashboardMs,
  region
}: {
  prismaPingMs: number;
  dashboardMs: number;
  region: string | null;
}) {
  if (prismaPingMs > 300) {
    return `Database/Prisma round-trip overhead is the dominant signal. Prisma SELECT 1 took ${formatMs(prismaPingMs)} from ${region ?? "the current Vercel region"}. If TCP/TLS is fast but Prisma remains slow, consider Prisma Accelerate or a lighter driver for read-heavy paths.`;
  }

  if (dashboardMs > prismaPingMs * 2.5) {
    return "Dashboard query work is the dominant signal. The dashboard now uses one aggregate SQL query, so check row counts and indexes if this stays high.";
  }

  return "Timings look balanced. Remaining slowness is likely normal server/database latency rather than frontend rendering.";
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
  const ownerId = await requireUserId();

  const requestHeaders = await headers();
  const vercelId = requestHeaders.get("x-vercel-id");
  const regionFromHeader = extractRegion(vercelId);
  const database = databaseUrlDiagnostics();
  const runtime = prismaRuntimeDiagnostics();
  const tlsTiming = await tlsConnectTiming();

  const simpleServerTiming = await timed("Simple server timing check", async () => Promise.resolve("ok"));
  const prismaPing = await timed("Prisma SELECT 1 first query", async () => prisma.$queryRaw`SELECT 1`);
  const prismaPingSecond = await timed("Prisma SELECT 1 second query", async () => prisma.$queryRaw`SELECT 1`);
  const prismaDoublePing = await timed("Prisma two SELECTs in one round trip", async () => prisma.$queryRaw`SELECT 1 AS one, 2 AS two`);
  const clientCount = await timed("Client count query", async () => prisma.client.count({ where: { ownerId } }));
  const projectCount = await timed("Project count query", async () => prisma.project.count({ where: { ownerId } }));
  const timeEntryCount = await timed("Time entry count query", async () => prisma.timeEntry.count({ where: { ownerId } }));
  const dashboardTiming = await timed("Dashboard aggregate query", () => loadDashboardData(ownerId));
  const totalServerMs = performance.now() - pageStartedAt;
  const diagnosisText = diagnosis({
    prismaPingMs: prismaPing.durationMs,
    dashboardMs: dashboardTiming.durationMs,
    region: regionFromHeader ?? process.env.VERCEL_REGION ?? null
  });

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
          <p className="mt-2 text-xl font-black">{regionFromHeader ?? "Not available"}</p>
        </article>
        <article className="card">
          <p className="text-sm font-bold text-moss">x-vercel-id</p>
          <p className="mt-2 break-words text-sm font-black">{vercelId ?? "Not available"}</p>
        </article>
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <article className="card">
          <p className="text-sm font-bold text-moss">Database pooler host</p>
          <p className="mt-2 break-words text-sm font-black">{database.host}</p>
        </article>
        <article className="card">
          <p className="text-sm font-bold text-moss">DATABASE_URL params</p>
          <p className="mt-2 text-sm font-black">pgbouncer={database.pgbouncer}, connection_limit={database.connectionLimit}</p>
        </article>
        <article className="card">
          <p className="text-sm font-bold text-moss">Prisma runtime</p>
          <p className="mt-2 text-sm font-black">
            Node {process.version}, Prisma {Prisma.prismaVersion.client}, init count {runtime.initCount}
          </p>
          <p className="mt-2 text-xs font-bold text-moss">
            {database.usesAccelerateOrDataProxy ? "Accelerate/Data Proxy style URL detected" : "Direct Prisma engine URL detected"}
          </p>
        </article>
      </section>

      <section className="card mt-6">
        <h2 className="text-xl font-black tracking-normal">Diagnosis</h2>
        <p className="mt-3 text-sm font-bold leading-6 text-moss">{diagnosisText}</p>
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
            <TimingRow label="TCP/TLS connect to database host" durationMs={tlsTiming.durationMs} detail={tlsTiming.detail} />
            <TimingRow label={prismaPing.label} durationMs={prismaPing.durationMs} detail="SELECT 1 through Prisma" />
            <TimingRow label={prismaPingSecond.label} durationMs={prismaPingSecond.durationMs} detail="Second query in same request" />
            <TimingRow label={prismaDoublePing.label} durationMs={prismaDoublePing.durationMs} detail="Single Prisma round trip" />
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
            <TimingRow
              label={dashboardTiming.label}
              durationMs={dashboardTiming.durationMs}
              detail={`${dashboardTiming.result.projects.length} active projects, ${dashboardTiming.result.sentInvoices.length} sent invoices, ${dashboardTiming.result.previousWeekEntries.length} previous-week entries`}
            />
          </tbody>
        </table>
      </section>
    </main>
  );
}
