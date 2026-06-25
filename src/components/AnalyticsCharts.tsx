"use client";

import Link from "next/link";
import { useState } from "react";
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
  const maxMinutes = weeklyPerformanceScale(days, rollingAverageDailyMinutes);
  const averagePercent = chartPercent(rollingAverageDailyMinutes, maxMinutes);
  const averageTop = 100 - averagePercent;
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
          <div className="rounded-lg border border-line bg-white p-4">
            <div className="grid grid-cols-7 gap-3">
              {days.map((day) => {
                const barPercent = chartPercent(day.totalMinutes, maxMinutes);
                // The small zero-day bar is visual only; it is not included in scale calculation.
                const visiblePercent = day.totalMinutes ? Math.max(8, barPercent) : 2;

                return (
                  <div key={day.date} className={`rounded-lg border p-3 ${day.isToday ? "border-mint bg-mint/10 ring-2 ring-mint/20" : "border-line bg-paper/60"}`}>
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

function weeklyPerformanceScale(days: WeekPerformanceDay[], rollingAverageDailyMinutes: number) {
  // Bars and the average line must share this exact chart max; zero-day visual baselines never affect it.
  return Math.max(8 * 60, rollingAverageDailyMinutes, ...days.map((day) => day.totalMinutes));
}

function chartPercent(value: number, max: number) {
  if (!max) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
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
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const width = 760;
  const height = 320;
  const padLeft = 104;
  const padRight = 30;
  const padTop = 38;
  const padBottom = 72;
  const maxMinutes = Math.max(8 * 60, ...points.map((point) => Math.max(point.minutes, point.rollingAverageMinutes)));
  const usableWidth = width - padLeft - padRight;
  const usableHeight = height - padTop - padBottom;
  const x = (index: number) => padLeft + (points.length <= 1 ? usableWidth / 2 : (index / (points.length - 1)) * usableWidth);
  const y = (minutes: number) => padTop + usableHeight - (minutes / maxMinutes) * usableHeight;
  const barWidth = Math.max(4, Math.min(12, usableWidth / Math.max(1, points.length) * 0.54));
  const linePoints = points.map((point, index) => `${x(index).toFixed(1)},${y(point.rollingAverageMinutes).toFixed(1)}`).join(" ");
  const hasData = points.some((point) => point.minutes > 0);
  const active = points.find((point) => point.date === activeDate) ?? [...points].reverse().find((point) => point.minutes > 0) ?? points.at(-1);
  const yTicks = [0, Math.round(maxMinutes / 2), maxMinutes];
  const xLabels = [0, Math.floor(points.length / 2), points.length - 1].filter((index, position, array) => index >= 0 && array.indexOf(index) === position);

  if (!hasData) {
    return <EmptyChart icon={TrendingUp} title="No quarter workload yet" body="Daily hours will appear here once time entries are logged this quarter." />;
  }

  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-title">Quarter trend</p>
          <h2 className="mt-1 text-2xl font-black tracking-normal">Daily hours and 7-day average</h2>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-moss">
            Shows daily logged hours for the current quarter with a rolling 7-day average to reveal workload pace.
          </p>
        </div>
        <p className="text-sm font-bold text-moss">Y-axis: hours</p>
      </div>

      {active ? (
        <ChartCallout
          title={formatDateAU(active.date)}
          rows={[
            ["Hours logged", `${formatHours(active.minutes)}h`],
            ["7-day average", `${formatHours(active.rollingAverageMinutes, "minutes")}h`],
            ["Projects", active.projects.length ? active.projects.slice(0, 3).join(", ") : "No project logged"]
          ]}
        />
      ) : null}

      <svg className="mt-4 h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily hours over the current quarter with rolling seven day average">
        <text x={padLeft} y="16" textAnchor="start" className="fill-moss text-[0.72rem] font-black">
          Hours
        </text>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={padLeft} x2={width - padRight} y1={y(tick)} y2={y(tick)} stroke="#e5e0d6" strokeWidth="1.5" />
            <text x={padLeft - 10} y={y(tick) + 4} textAnchor="end" className="fill-moss text-[0.75rem] font-black">
              {formatHours(tick, "minutes")}
            </text>
          </g>
        ))}
        <line x1={padLeft} x2={width - padRight} y1={height - padBottom} y2={height - padBottom} stroke="#d9d2c5" strokeWidth="2" />
        <line x1={padLeft} x2={padLeft} y1={padTop} y2={height - padBottom} stroke="#d9d2c5" strokeWidth="2" />
        {points.map((point, index) => {
          const barHeight = Math.max(point.minutes > 0 ? 3 : 1, (point.minutes / maxMinutes) * usableHeight);
          return (
            <g
              key={point.date}
              tabIndex={0}
              role="button"
              aria-label={`${formatDateAU(point.date)}: ${formatHours(point.minutes)} hours, ${formatHours(point.rollingAverageMinutes, "minutes")} hour rolling average`}
              onMouseEnter={() => setActiveDate(point.date)}
              onFocus={() => setActiveDate(point.date)}
              onClick={() => setActiveDate(point.date)}
            >
              <rect x={x(index) - barWidth / 2} y={height - padBottom - barHeight} width={barWidth} height={barHeight} rx="3" fill="rgb(var(--color-accent-rgb))" opacity={point.minutes > 0 ? 0.62 : 0.22}>
                <title>{`${formatDateAU(point.date)}: ${formatHours(point.minutes)}h logged`}</title>
              </rect>
            </g>
          );
        })}
        <polyline fill="none" stroke="#17211c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={linePoints} />
        {points.map((point, index) => (
          point.date === active?.date ? <circle key={`${point.date}-active`} cx={x(index)} cy={y(point.rollingAverageMinutes)} r="6" fill="rgb(var(--color-accent-rgb))" stroke="#fff" strokeWidth="3" /> : null
        ))}
        {xLabels.map((index) => (
          <text key={points[index].date} x={x(index)} y={height - 28} textAnchor="middle" className="fill-moss text-[0.78rem] font-black">
            {points[index].label}
          </text>
        ))}
        <text x={(width + padLeft - padRight) / 2} y={height - 8} textAnchor="middle" className="fill-moss text-[0.72rem] font-black">
          Current quarter dates
        </text>
      </svg>
    </div>
  );
}

export function FinancialYearChart({ points, start, end }: { points: FinancialYearPoint[]; start: string; end: string }) {
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const width = 760;
  const height = 320;
  const padLeft = 116;
  const padRight = 32;
  const padTop = 38;
  const padBottom = 72;
  const maxCents = Math.max(100, ...points.map((point) => Math.max(point.paidCents, point.cumulativePaidCents)));
  const usableWidth = width - padLeft - padRight;
  const usableHeight = height - padTop - padBottom;
  const x = (index: number) => padLeft + (points.length <= 1 ? usableWidth / 2 : (index / (points.length - 1)) * usableWidth);
  const y = (cents: number) => padTop + usableHeight - (cents / maxCents) * usableHeight;
  const barWidth = Math.max(24, Math.min(42, usableWidth / Math.max(1, points.length) * 0.48));
  const linePoints = points.map((point, index) => `${x(index).toFixed(1)},${y(point.cumulativePaidCents).toFixed(1)}`).join(" ");
  const hasData = points.some((point) => point.paidCents > 0 || point.cumulativePaidCents > 0);
  const active = points.find((point) => point.month === activeMonth) ?? [...points].reverse().find((point) => point.paidCents > 0) ?? points.at(-1);
  const yTicks = [0, Math.round(maxCents / 2), maxCents];

  if (!hasData) {
    return <EmptyChart icon={ReceiptText} title="No paid invoices this financial year yet" body="Monthly paid income will appear once invoices are marked paid." />;
  }

  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-title">Financial year</p>
          <h2 className="mt-1 text-2xl font-black tracking-normal">Monthly paid income</h2>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-moss">
            Shows paid invoice income by month across the Australian financial year. The line shows cumulative paid income.
          </p>
        </div>
        <p className="text-sm font-bold text-moss">
          {formatDateAU(start)} - {formatDateAU(end)}
        </p>
      </div>

      {active ? (
        <ChartCallout
          title={active.label}
          rows={[
            ["Paid income", formatMoney(active.paidCents)],
            ["Cumulative FY paid", formatMoney(active.cumulativePaidCents)]
          ]}
        />
      ) : null}

      <svg className="mt-4 h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly paid invoice income across the financial year">
        <text x={padLeft} y="16" textAnchor="start" className="fill-moss text-[0.72rem] font-black">
          Dollars
        </text>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={padLeft} x2={width - padRight} y1={y(tick)} y2={y(tick)} stroke="#e5e0d6" strokeWidth="1.5" />
            <text x={padLeft - 10} y={y(tick) + 4} textAnchor="end" className="fill-moss text-[0.75rem] font-black">
              {axisMoney(tick)}
            </text>
          </g>
        ))}
        <line x1={padLeft} x2={width - padRight} y1={height - padBottom} y2={height - padBottom} stroke="#d9d2c5" strokeWidth="2" />
        <line x1={padLeft} x2={padLeft} y1={padTop} y2={height - padBottom} stroke="#d9d2c5" strokeWidth="2" />
        {points.map((point, index) => {
          const barHeight = Math.max(point.paidCents > 0 ? 4 : 1, (point.paidCents / maxCents) * usableHeight);
          return (
            <g
              key={point.month}
              tabIndex={0}
              role="button"
              aria-label={`${point.label}: ${formatMoney(point.paidCents)} paid income, ${formatMoney(point.cumulativePaidCents)} cumulative`}
              onMouseEnter={() => setActiveMonth(point.month)}
              onFocus={() => setActiveMonth(point.month)}
              onClick={() => setActiveMonth(point.month)}
            >
              <rect x={x(index) - barWidth / 2} y={height - padBottom - barHeight} width={barWidth} height={barHeight} rx="6" fill="rgb(var(--color-accent-rgb))" opacity={point.paidCents > 0 ? 0.72 : 0.18}>
                <title>{`${point.label}: ${formatMoney(point.paidCents)} paid`}</title>
              </rect>
            </g>
          );
        })}
        <polyline fill="none" stroke="#17211c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={linePoints} />
        {points.map((point, index) => (
          <circle key={`${point.month}-dot`} cx={x(index)} cy={y(point.cumulativePaidCents)} r={point.month === active?.month ? 6 : 4} fill={point.month === active?.month ? "rgb(var(--color-accent-rgb))" : "#17211c"} stroke="#fff" strokeWidth="2" />
        ))}
        {points.map((point, index) => (
          <text key={`${point.month}-label`} x={x(index)} y={height - 28} textAnchor="middle" className="fill-moss text-[0.78rem] font-black">
            {point.label}
          </text>
        ))}
        <text x={(width + padLeft - padRight) / 2} y={height - 8} textAnchor="middle" className="fill-moss text-[0.72rem] font-black">
          Australian financial year months
        </text>
      </svg>
    </div>
  );
}

function ChartCallout({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="mt-4 rounded-lg border border-line bg-paper/70 p-3">
      <p className="text-sm font-black text-ink">{title}</p>
      <div className="mt-2 grid gap-1">
        {rows.map(([label, value]) => (
          <p key={label} className="flex flex-col gap-1 text-sm font-bold text-moss sm:flex-row sm:items-center sm:justify-between">
            <span>{label}</span>
            <span className="text-ink">{value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function axisMoney(cents: number) {
  if (Math.abs(cents) >= 100_000) return `$${Math.round(cents / 100_000)}k`;
  return formatMoney(cents).replace(".00", "");
}

export function InsightCards({ cards }: { cards: InsightCard[] }) {
  const tones = {
    mint: "border-mint/30 bg-mint/10",
    yolk: "border-mint/30 bg-mint/10",
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
