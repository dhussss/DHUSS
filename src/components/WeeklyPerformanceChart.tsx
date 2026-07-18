"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
        className="week-scroll snap-x snap-mandatory overflow-x-auto xl:snap-none"
        role="region"
        aria-label="Current week, scroll horizontally to view each day"
        tabIndex={0}
      >
        <div className="week-days">
            {days.map((day) => {
              const projectChips = day.projects.slice(0, 2);
              const extraProjectCount = Math.max(day.projects.length - projectChips.length, 0);
              const progress = chartPercent(day.totalMinutes, maxMinutes);

              return (
                <article
                  key={day.date}
                  ref={day.isToday ? todayCardRef : undefined}
                  className={`week-day snap-center ${day.isToday ? "is-today" : ""}`}
                >
                  <div className="week-day-heading">
                    <p>{day.dayShort} <span>{day.dateLabel}</span></p>
                    {day.isToday ? <span>Today</span> : null}
                  </div>

                  {day.totalMinutes ? (
                    <>
                      <p className="week-day-hours">{formatHours(day.totalMinutes)}h</p>
                      <p className="week-day-value">{formatMoney(day.billableValueCents)} billable</p>
                      <div className="week-day-progress" aria-label={`${day.dayName}: ${formatHours(day.totalMinutes)} hours`}>
                        <div style={{ width: `${progress}%` }} />
                      </div>
                    </>
                  ) : <><p className="week-day-hours is-empty">0h</p><p className="week-day-value">No work logged</p><div className="week-day-progress"><div style={{ width: "0%" }} /></div></>}

                  <div className="week-projects">
                    {projectChips.length ? (
                      <>
                        {projectChips.map((project) => (
                          <span key={project}>
                            {project}
                          </span>
                        ))}
                        {extraProjectCount ? <span>+{extraProjectCount} more</span> : null}
                      </>
                    ) : (
                      <span className="empty-project">No project</span>
                    )}
                  </div>
                  <p className="week-entry-count">{day.entryCount} {day.entryCount === 1 ? "entry" : "entries"}</p>
                </article>
              );
            })}
        </div>
      </div>

      {!hasEntries ? (
        <div className="week-empty-state">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink">No hours logged this week yet</p>
              <p className="mt-1 text-sm text-moss">Choose a project and add your first entry.</p>
            </div>
            <Link href="/projects" className="tap-secondary bg-white">
              Choose project <ArrowRight size={16} aria-hidden="true" />
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
