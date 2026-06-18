import { formatMoney } from "@/lib/money";

export function WeeklyPaidChart({
  weeks
}: {
  weeks: { label: string; totalCents: number }[];
}) {
  const max = Math.max(...weeks.map((week) => week.totalCents), 1);

  return (
    <section className="card">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="section-title">Paid this quarter</p>
          <h2 className="mt-1 text-xl font-black tracking-normal text-ink">Weekly paid totals</h2>
        </div>
        <p className="text-sm font-bold text-moss">{formatMoney(weeks.reduce((sum, week) => sum + week.totalCents, 0))}</p>
      </div>

      <div
        className="mt-5 grid h-36 items-end gap-1"
        style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}
        aria-label="Quarter-long weekly bar chart"
      >
        {weeks.map((week) => {
          const height = Math.max(week.totalCents ? (week.totalCents / max) * 100 : 4, 4);

          return (
            <div key={week.label} className="flex h-full flex-col items-center justify-end gap-2">
              <div
                className="w-full rounded-t-md bg-mint"
                style={{ height: `${height}%` }}
                title={`${week.label}: ${formatMoney(week.totalCents)}`}
              />
              <span className="text-[0.62rem] font-bold text-moss">{week.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
