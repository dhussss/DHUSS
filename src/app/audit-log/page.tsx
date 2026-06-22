import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateAU } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const ownerId = await requireUserId();
  const logs = await prisma.auditLog.findMany({
    where: { ownerId },
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <main className="page-shell">
      <header>
        <p className="section-title">Audit Log</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">Recent activity</h1>
        <p className="mt-2 max-w-2xl text-sm font-bold text-moss">
          Account-scoped activity for business profile, project, time, invoice, and backup events.
        </p>
      </header>

      <section className="mt-6 grid gap-3">
        {logs.map((log) => (
          <article key={log.id} className="card">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-black tracking-normal">{formatAction(log.action)}</h2>
                <p className="mt-1 text-sm font-bold text-moss">
                  {log.entityType}
                  {log.entityId ? ` - ${log.entityId}` : ""}
                </p>
              </div>
              <p className="text-sm font-bold text-moss">{formatDateAU(log.createdAt)}</p>
            </div>
          </article>
        ))}
        {logs.length === 0 ? (
          <p className="rounded-lg border border-line bg-white p-4 text-sm font-bold text-moss">
            No audit activity yet.
          </p>
        ) : null}
      </section>
    </main>
  );
}

function formatAction(action: string) {
  return action
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" - ");
}
