import Link from "next/link";
import { ArrowRight, BarChart3, ReceiptText, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";
import type { FinancialYearPoint, InsightCard, QuarterTrendPoint, WeekPerformanceDay } from "@/lib/insights";

type WeeklyPerformanceChartProps = {
  days: WeekPerformanceDay[];
  totalMinutes: number;
  billableValueCents: number;
  rollingAverageDailyMinutes: number;
  currentWeekAverageDailyMinutes: number;
  averageDeltaMinutes: number;
  hasEntries: boolean;
};

export function WeeklyPerformanceChart({
  days,
  totalMinutes,
  billableValueCents,
  rollingAverageDailyMinutes,
  currentWeekAverageDailyMinutes,
  averageDeltaMinutes,
  hasEntries
}: WeeklyPerformanceChartProps) {
  const maxMinutes = Math.max(8 * 60, rollingAverageDailyMinutes, ...days.map((day) => day.totalMinutes));
  const averagePercent = Math.min(100, (rollingAverageDailyMinutes / maxMinutes) * 100);
  const deltaHours = Math.abs(averageDeltaMinutes) / 60;
  const deltaLabel = `${averageDeltaMinutes >= 0 ? "+" : "-"}${deltaHours.toFixed(1).replace(/\.0$/, "")}h/day`;
  const trackingCopy = `This week is tracking ${deltaLabel} ${averageDeltaMinutes >= 0 ? "above" : "below"} your 30-day average.`;

  return (
    <section>
      <div className="grid gap-4 border-b border-line p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-5">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-black uppercase text-mint">
            <BarChart3 size={17} aria-hidden="true" />
            Weekly performance
          </p>
          <h3 className="mt-1 text-2xl font-black tracking-normal text-ink">Hours by day</h3>
          <p className="mt-2 text-sm font-bold leading-6 text-moss">
            Current pace: {formatHours(currentWeekAverageDailyMinutes, "minutes")}h/day. 30-day avg: {formatHours(rollingAverageDailyMinutes, "minutes")}h/day. {trackingCopy}
          </p>
        </div>
        <div className="grid gap-2 sm:min-w-[20rem] sm:grid-cols-2">
          <WeekStat value={`${formatHours(totalMinutes)}h`} label="This week" />
          <WeekStat value={formatMoney(billableValueCents)} label="Billable value" />
        </div>
      </div>

      <div className="overflow-x-auto p-4 sm:p-5">
        <div className="min-w-[68rem]">
          <div className="relative rounded-lg border border-line bg-white p-4">
            <div className="pointer-events-none absolute inset-x-4 bottom-4 top-4 z-10">
              <div className="absolute left-0 right-0 border-t border-dashed border-mint/70" style={{ bottom: `${averagePercent}%` }}>
                <span className="absolute -top-3 right-0 rounded-full border border-mint/40 bg-white px-2 py-0.5 text-[0.65rem] font-black uppercase text-mint">
                  30-day avg
                </span>
              </div>
            </div>
            <div className="grid h-56 grid-cols-7 items-end gap-3">
              {days.map((day) => {
                const barPercent = maxMinutes ? Math.min(100, (day.totalMinutes / maxMinutes) * 100) : 0;
                const visiblePercent = day.totalMinutes ? Math.max(8, barPercent) : 2;

                return (
                  <div key={day.date} className={`flex h-full flex-col justify-end rounded-lg border p-3 ${day.isToday ? "border-mint bg-mint/10 ring-2 ring-mint/20" : "border-line bg-paper/60"}`}>
                    <div className="mb-auto">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-moss">{day.dayShort}</p>
                        {day.isToday ? <span className="rounded-full bg-mint px-2 py-1 text-[0.62rem] font-black uppercase leading-none text-white">Today</span> : null}
                      </div>
                      <p className="mt-1 text-lg font-black text-ink">{day.dateLabel}</p>
                    </div>
                    <div className="flex h-36 items-end">
                      <div
                        className={`w-full rounded-t-lg ${day.isToday ? "bg-gradient-to-t from-mint to-yolk" : "bg-gradient-to-t from-ink to-mint"}`}
                        style={{ height: `${visiblePercent}%` }}
                        aria-label={`${day.dayName}: ${formatHours(day.totalMinutes)} hours`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-3">
            {days.map((day) => {
              const projectChips = day.projects.slice(0, 2);
              const extraProjectCount = Math.max(day.projects.length - projectChips.length, 0);

              return (
                <article key={`${day.date}-details`} className={`rounded-lg border p-3 ${day.isToday ? "border-mint bg-mint/10" : "border-line bg-white"}`}>
                  <p className="text-lg font-black text-ink">{formatHours(day.totalMinutes)}h logged</p>
                  <p className="mt-1 text-sm font-bold text-moss">{formatMoney(day.billableValueCents)} billable</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {projectChips.length ? (
                      <>
                        {projectChips.map((project) => (
                          <span key={project} className="max-w-full break-words rounded-full bg-paper px-2 py-1 text-xs font-bold leading-4 text-moss">
                            {project}
                          </span>
                        ))}
                        {extraProjectCount ? <span className="rounded-full bg-paper px-2 py-1 text-xs font-black leading-4 text-moss">+{extraProjectCount} more</span> : null}
                      </>
                    ) : (
                      <span className="text-sm font-bold text-moss/75">No work logged</span>
                    )}
                  </div>
                  <p className="mt-3 text-xs font-black uppercase tracking-[0.1em] text-moss">
                    {day.entryCount} entr{day.entryCount === 1 ? "y" : "ies"}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {!hasEntries ? (
        <div className="border-t border-line bg-mint/10 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black text-ink">No hours logged this week yet</p>
              <p className="mt-1 text-sm font-bold text-moss">The chart will fill from Monday through Sunday as work is logged.</p>
            </div>
            <Link href="/projects" className="tap-secondary bg-white">
              <ReceiptText size={18} aria-hidden="true" />
              Choose Project
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function WeekStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-3">
      <p className="text-2xl font-black tracking-normal text-ink">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-moss">{label}</p>
    </div>
  );
}

export function QuarterTrendChart({ points }: { points: QuarterTrendPoint[] }) {
  const width = 720;
  const height = 260;
  const pad = 28;
  const maxMinutes = Math.max(8 * 60, ...points.map((point) => Math.max(point.minutes, point.rollingAverageMinutes)));
  const usableWidth = width - pad * 2;
  const usableHeight = height - pad * 2;
  const x = (index: number) => pad + (points.length <= 1 ? usableWidth / 2 : (index / (points.length - 1)) * usableWidth);
  const y = (minutes: number) => pad + usableHeight - (minutes / maxMinutes) * usableHeight;
  const linePoints = points.map((point, index) => `${x(index).toFixed(1)},${y(point.rollingAverageMinutes).toFixed(1)}`).join(" ");
  const hasData = points.some((point) => point.minutes > 0);

  if (!hasData) {
    return <EmptyChart icon={TrendingUp} title="No quarter workload yet" body="Daily hours will appear here once time entries are logged this quarter." />;
  }

  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-title">Quarter trend</p>
          <h2 className="mt-1 text-2xl font-black tracking-normal">Daily hours and 7-day average</h2>
        </div>
        <p className="text-sm font-bold text-moss">Current quarter to date</p>
      </div>
      <svg className="mt-5 h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily hours over the current quarter with rolling average">
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="#d9d2c5" strokeWidth="2" />
        <line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="#d9d2c5" strokeWidth="2" />
        {points.map((point, index) => {
          const barHeight = Math.max(1, ((point.minutes / maxMinutes) * usableHeight));
          return (
            <rect
              key={point.date}
              x={x(index) - 2}
              y={height - pad - barHeight}
              width="4"
              height={barHeight}
              rx="2"
              fill={point.minutes > 0 ? "#0f9f8f" : "#e8e0d2"}
              opacity={point.minutes > 0 ? 0.55 : 0.35}
            />
          );
        })}
        <polyline fill="none" stroke="#17211c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={linePoints} />
        {[0, Math.floor(points.length / 2), points.length - 1].filter((index, position, array) => index >= 0 && array.indexOf(index) === position).map((index) => (
          <text key={points[index].date} x={x(index)} y={height - 6} textAnchor="middle" className="fill-moss text-[0.68rem] font-black">
            {points[index].label}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function FinancialYearChart({ points, start, end }: { points: FinancialYearPoint[]; start: string; end: string }) {
  const width = 720;
  const height = 260;
  const pad = 30;
  const maxCents = Math.max(100, ...points.map((point) => point.cumulativePaidCents));
  const usableWidth = width - pad * 2;
  const usableHeight = height - pad * 2;
  const x = (index: number) => pad + (points.length <= 1 ? usableWidth / 2 : (index / (points.length - 1)) * usableWidth);
  const y = (cents: number) => pad + usableHeight - (cents / maxCents) * usableHeight;
  const linePoints = points.map((point, index) => `${x(index).toFixed(1)},${y(point.cumulativePaidCents).toFixed(1)}`).join(" ");
  const areaPoints = `${pad},${height - pad} ${linePoints} ${points.length ? `${x(points.length - 1)},${height - pad}` : ""}`;
  const hasData = points.some((point) => point.cumulativePaidCents > 0);

  if (!hasData) {
    return <EmptyChart icon={ReceiptText} title="No paid invoices this financial year yet" body="Paid invoice totals will build into a cumulative FY line once invoices are marked paid." />;
  }

  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-title">Financial year</p>
          <h2 className="mt-1 text-2xl font-black tracking-normal">Cumulative paid invoices</h2>
        </div>
        <p className="text-sm font-bold text-moss">
          {formatDateAU(start)} - {formatDateAU(end)}
        </p>
      </div>
      <svg className="mt-5 h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Financial year cumulative paid invoice value">
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="#d9d2c5" strokeWidth="2" />
        <polygon points={areaPoints} fill="#0f9f8f" opacity="0.12" />
        <polyline fill="none" stroke="#0f9f8f" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" points={linePoints} />
        {points.map((point, index) => (
          <circle key={point.month} cx={x(index)} cy={y(point.cumulativePaidCents)} r="4" fill="#17211c" />
        ))}
        {points.map((point, index) => (
          <text key={`${point.month}-label`} x={x(index)} y={height - 6} textAnchor="middle" className="fill-moss text-[0.68rem] font-black">
            {point.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function InsightCards({ cards }: { cards: InsightCard[] }) {
  const tones = {
    mint: "border-mint/30 bg-mint/10",
    yolk: "border-yolk/40 bg-yolk/10",
    gum: "border-gum/30 bg-gum/10",
    ink: "border-line bg-white"
  };

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <article key={card.title} className={`rounded-lg border p-4 shadow-soft ${tones[card.tone]}`}>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-moss">{card.title}</p>
          <p className="mt-3 text-3xl font-black tracking-normal text-ink">{card.value}</p>
          <p className="mt-2 text-sm font-bold leading-6 text-moss">{card.body}</p>
        </article>
      ))}
    </div>
  );
}

function EmptyChart({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <span className="icon-tile">
        <Icon size={20} aria-hidden="true" />
      </span>
      <p className="mt-4 text-xl font-black tracking-normal text-ink">{title}</p>
      <p className="mt-2 text-sm font-bold leading-6 text-moss">{body}</p>
    </div>
  );
}

export function SectionAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-bold text-mint">
      {children} <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}
