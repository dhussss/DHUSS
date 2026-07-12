"use client";

import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { useEffect, useRef } from "react";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";
import type { WeekPerformanceDay } from "@/lib/insights";

type WeeklyPerformanceChartProps = {
  days: WeekPerformanceDay[];
  rollingAverageDailyMinutes: number;
  hasEntries: boolean;
};

export function WeeklyPerformanceChart({
  days,
  rollingAverageDailyMinutes,
  hasEntries
}: WeeklyPerformanceChartProps) {
  const maxMinutes = weeklyPerformanceScale(days, rollingAverageDailyMinutes);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const todayCardRef = useRef<HTMLElement>(null);
  const todayDate = days.find((day) => day.isToday)?.date;

  useEffect(() => {
    if (!todayDate || !window.matchMedia("(max-width: 767px)").matches) return;

    const frame = window.requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      const card = todayCardRef.current;
      if (!container || !card) return;

      const centeredLeft = card.offsetLeft - (container.clientWidth - card.clientWidth) / 2;
      container.scrollTo({ left: Math.max(0, centeredLeft), behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [todayDate]);

  return (
    <section>
      <div
        ref={scrollContainerRef}
        className="snap-x snap-mandatory overflow-x-auto md:snap-none"
        role="region"
        aria-label="Current week, scroll horizontally to view each day"
        tabIndex={0}
      >
        <div className="min-w-[70rem]">
          <div className="grid grid-cols-7 divide-x divide-line">
            {days.map((day) => {
              const projectChips = day.projects.slice(0, 2);
              const extraProjectCount = Math.max(day.projects.length - projectChips.length, 0);
              const progress = chartPercent(day.totalMinutes, maxMinutes);

              return (
                <article
                  key={day.date}
                  ref={day.isToday ? todayCardRef : undefined}
                  className={`flex min-h-56 snap-center flex-col p-5 ${day.isToday ? "bg-mint/[0.08] shadow-[inset_0_3px_0_rgb(var(--color-accent-rgb))]" : "bg-white"}`}
                >
                  <div className="min-h-16 border-b border-line/70 pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-ink">{day.dayShort}</p>
                      {day.isToday ? <span className="rounded-md bg-mint px-2 py-1 text-[0.65rem] font-black uppercase leading-none text-white">Today</span> : null}
                    </div>
                    <p className="mt-1 text-sm font-medium text-moss">{day.dateLabel}</p>
                  </div>

                  {day.totalMinutes ? (
                    <>
                      <p className="mt-4 text-2xl font-black text-ink">{formatHours(day.totalMinutes)}h</p>
                      <p className="mt-1 text-sm font-medium text-moss">{formatMoney(day.billableValueCents)}</p>
                      <div className="mt-4 h-1 overflow-hidden rounded-full bg-paper" aria-label={`${day.dayName}: ${formatHours(day.totalMinutes)} hours`}>
                        <div className="h-full rounded-full bg-mint" style={{ width: `${progress}%` }} />
                      </div>
                    </>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {projectChips.length ? (
                      <>
                        {projectChips.map((project) => (
                          <span key={project} className="max-w-full break-words rounded-md border border-line/80 bg-paper/70 px-2 py-1 text-xs font-semibold leading-4 text-moss">
                            {project}
                          </span>
                        ))}
                        {extraProjectCount ? <span className="rounded-md border border-line/80 bg-paper/70 px-2 py-1 text-xs font-bold leading-4 text-moss">+{extraProjectCount} more</span> : null}
                      </>
                    ) : (
                      <span className="text-sm font-medium text-moss/75">No work logged</span>
                    )}
                  </div>
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
