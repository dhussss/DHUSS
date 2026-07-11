"use client";

import Link from "next/link";
import { BarChart3, ReceiptText } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";
import type { WeekPerformanceDay } from "@/lib/insights";

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
  const maxMinutes = weeklyPerformanceScale(days, rollingAverageDailyMinutes);
  const averagePercent = chartPercent(rollingAverageDailyMinutes, maxMinutes);
  const averageTop = 100 - averagePercent;
  const deltaHours = Math.abs(averageDeltaMinutes) / 60;
  const deltaLabel = `${averageDeltaMinutes >= 0 ? "+" : "-"}${deltaHours.toFixed(1).replace(/\.0$/, "")}h/day`;
  const trackingCopy = `This week is tracking ${deltaLabel} ${averageDeltaMinutes >= 0 ? "above" : "below"} your 30-day average.`;

  return (
    <section>
      <div className="grid gap-4 border-b border-line/80 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-5">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-mint">
            <BarChart3 size={17} aria-hidden="true" />
            Weekly performance
          </p>
          <h3 className="mt-1 text-2xl font-black tracking-normal text-ink">Hours by day</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-moss">
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
          <div className="rounded-lg border border-line/80 bg-white/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
            <div className="grid grid-cols-7 gap-3">
              {days.map((day) => {
                const barPercent = chartPercent(day.totalMinutes, maxMinutes);
                const visiblePercent = day.totalMinutes ? Math.max(8, barPercent) : 2;

                return (
                  <div key={day.date} className={`rounded-lg border p-3 ${day.isToday ? "border-mint bg-mint/10 ring-2 ring-mint/20" : "border-line/80 bg-paper/70"}`}>
                    <div className="flex min-h-14 flex-col gap-1">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-moss">{day.dayShort}</p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-lg font-black text-ink">{day.dateLabel}</p>
                        {day.isToday ? <span className="rounded-full bg-mint px-2 py-1 text-[0.62rem] font-black uppercase leading-none text-white">Today</span> : null}
                      </div>
                    </div>
                    <div className="flex h-44 items-end" aria-label={`${day.dayName}: ${formatHours(day.totalMinutes)} hours`}>
                      <div className={`w-full rounded-t-lg ${day.isToday ? "bg-gradient-to-t from-mint to-white" : "bg-gradient-to-t from-ink to-mint"}`} style={{ height: `${visiblePercent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="relative -mt-44 ml-4 mr-4 h-44">
              <div className="pointer-events-none absolute left-0 right-0 z-10 border-t border-dashed border-mint/70" style={{ top: `${averageTop}%` }}>
                <span className="absolute -top-3 right-0 rounded-full border border-mint/40 bg-white px-2 py-0.5 text-[0.65rem] font-black uppercase text-mint">
                  30-day avg
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-3">
            {days.map((day) => {
              const projectChips = day.projects.slice(0, 2);
              const extraProjectCount = Math.max(day.projects.length - projectChips.length, 0);

              return (
                <article key={`${day.date}-details`} className={`rounded-lg border p-3 ${day.isToday ? "border-mint bg-mint/10" : "border-line/80 bg-white/80"}`}>
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
        <div className="border-t border-line/80 bg-mint/10 p-4 sm:p-5">
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

function weeklyPerformanceScale(days: WeekPerformanceDay[], rollingAverageDailyMinutes: number) {
  return Math.max(8 * 60, rollingAverageDailyMinutes, ...days.map((day) => day.totalMinutes));
}

function chartPercent(value: number, max: number) {
  if (!max) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function WeekStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-line/80 bg-paper/80 p-3">
      <p className="text-2xl font-black tracking-normal text-ink">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-moss">{label}</p>
    </div>
  );
}
