import Link from "next/link";
import { ArrowLeft, CalendarX2, Save } from "lucide-react";
import { logDayOffAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUserId } from "@/lib/auth";
import { dateInputValue, formatDateAU, todayInPerth } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DayOffPage() {
  const ownerId = await requireUserId();
  const recentLogs = await prisma.dayOffLog.findMany({
    where: { ownerId },
    select: { id: true, date: true, reason: true, plannedWorkDay: true, notes: true },
    orderBy: { date: "desc" },
    take: 12
  });

  return (
    <main className="page-shell">
      <Link href="/more" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint">
        <ArrowLeft size={18} aria-hidden="true" />
        More
      </Link>
      <header className="page-header">
        <p className="section-title">Day Off</p>
        <h1 className="page-title">Log a planned day off</h1>
        <p className="page-subtitle">Planned days off count as included zero-hour days for rolling averages. Quiet weekends still stay out unless work is logged.</p>
      </header>

      <section className="mt-6 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <form action={logDayOffAction} className="card grid gap-4">
          <input type="hidden" name="returnTo" value="/day-off" />
          <div className="flex items-center gap-3">
            <span className="icon-tile">
              <CalendarX2 size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="section-title">Log day</p>
              <h2 className="text-xl font-black tracking-normal">Included zero-hour day</h2>
            </div>
          </div>
          <label>
            Date
            <input name="date" type="date" required defaultValue={dateInputValue(todayInPerth())} />
          </label>
          <label>
            Reason
            <input name="reason" placeholder="RDO, sick, weather, admin, personal..." />
          </label>
          <label className="flex min-h-12 cursor-pointer grid-cols-none flex-row items-center gap-3 rounded-lg border border-line bg-white px-3">
            <input className="size-5 min-h-0 w-auto" name="plannedWorkDay" type="checkbox" defaultChecked />
            Planned work day
          </label>
          <label>
            Notes
            <textarea name="notes" />
          </label>
          <SubmitButton className="tap-primary" pendingLabel="Saving day off...">
            <Save size={18} aria-hidden="true" />
            Save Day Off
          </SubmitButton>
        </form>

        <section className="surface-panel">
          <div className="surface-header">
            <p className="section-title">Recent</p>
            <h2 className="mt-1 text-2xl font-black tracking-normal">Day-off records</h2>
          </div>
          <div className="grid gap-3 p-3">
            {recentLogs.length ? (
              recentLogs.map((log) => (
                <article key={log.id} className="rounded-lg border border-line bg-white p-4 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-ink">{formatDateAU(log.date)}</p>
                      <p className="mt-1 text-sm font-bold text-moss">{log.reason || "No reason recorded"}</p>
                    </div>
                    <span className={`status-pill ${log.plannedWorkDay ? "border-mint bg-mint/10 text-mint" : "border-line bg-paper text-moss"}`}>
                      {log.plannedWorkDay ? "included" : "not included"}
                    </span>
                  </div>
                  {log.notes ? <p className="mt-3 text-sm font-bold leading-6 text-moss">{log.notes}</p> : null}
                </article>
              ))
            ) : (
              <div className="rounded-lg border border-line bg-white p-5 text-sm font-bold text-moss">No day-off records yet.</div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
