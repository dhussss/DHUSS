"use client";

import { useMemo, useState } from "react";
import { Check, Clipboard, FileClock } from "lucide-react";
import { addDays, dateInputValue, formatExportDate, parseInputDate } from "@/lib/dates";
import { formatHours } from "@/lib/time";

type ExportEntry = {
  id: string;
  projectId: string;
  date: string;
  durationMinutes: number;
  notes: string | null;
};

type ExportProject = {
  id: string;
  title: string;
  client: string;
  unbilledMinutes: number;
};

function minutesByDay(entries: ExportEntry[], projectId: string, start: Date, end: Date) {
  const totals = new Map<string, { minutes: number; notes: string[] }>();

  for (const entry of entries) {
    const date = new Date(entry.date);
    if (entry.projectId !== projectId || date < start || date > end) continue;
    const key = dateInputValue(date);
    const day = totals.get(key) ?? { minutes: 0, notes: [] };
    day.minutes += entry.durationMinutes;
    const note = entry.notes?.trim();
    if (note) {
      day.notes.push(...note.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    }
    totals.set(key, day);
  }

  return totals;
}

export function HoursExportClient({
  projects,
  defaultProjectId,
  defaultStart,
  defaultEnd,
  entries
}: {
  projects: ExportProject[];
  defaultProjectId?: string;
  defaultStart?: string;
  defaultEnd?: string;
  entries: ExportEntry[];
}) {
  const [projectId, setProjectId] = useState(
    defaultProjectId && projects.some((project) => project.id === defaultProjectId) ? defaultProjectId : projects[0]?.id ?? ""
  );
  const [start, setStart] = useState(defaultStart || dateInputValue(addDays(new Date(), -6)));
  const [end, setEnd] = useState(defaultEnd || dateInputValue(new Date()));
  const [includeZeroDays, setIncludeZeroDays] = useState(false);
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => {
    if (!projectId || !start || !end) return "";

    const startDate = parseInputDate(start);
    const endDate = parseInputDate(end);
    if (endDate < startDate) return "End date must be after start date.";

    const totals = minutesByDay(entries, projectId, startDate, endDate);
    const lines: string[] = [];
    let totalMinutes = 0;

    for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
      const key = dateInputValue(cursor);
      const day = totals.get(key) ?? { minutes: 0, notes: [] };
      const minutes = day.minutes;
      if (!includeZeroDays && minutes === 0) continue;
      totalMinutes += minutes;
      lines.push(`${formatExportDate(cursor)}: ${formatHours(minutes)} hrs`);
      lines.push(...day.notes.map((note) => `    * ${note}`));
    }

    lines.push(`TOTAL: ${formatHours(totalMinutes)} hrs`);
    return lines.join("\n");
  }, [end, entries, includeZeroDays, projectId, start]);

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="grid gap-5">
      <section className="card grid gap-4">
        <label>
          Project
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title} - {project.client} - {formatHours(project.unbilledMinutes)}h unbilled
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            Start date
            <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label>
            End date
            <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
          </label>
        </div>
        <label className="flex min-h-12 cursor-pointer grid-cols-none flex-row items-center gap-3 rounded-lg border border-line bg-white px-3">
          <input
            className="size-5 min-h-0 w-auto"
            type="checkbox"
            checked={includeZeroDays}
            onChange={(event) => setIncludeZeroDays(event.target.checked)}
          />
          Include zero-hour days
        </label>
      </section>

      <section className="card">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-mint/10 text-mint">
            <FileClock size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="section-title">Generated text</p>
            <h2 className="text-xl font-black">Weekly hours report</h2>
          </div>
        </div>
        <pre className="mt-4 min-h-44 whitespace-pre-wrap rounded-lg border border-line bg-[#fffdfa] p-4 text-sm leading-7 text-ink">
          {output}
        </pre>
        <button type="button" className="tap-primary mt-4 w-full" onClick={copy}>
          {copied ? <Check size={20} aria-hidden="true" /> : <Clipboard size={20} aria-hidden="true" />}
          {copied ? "Copied" : "Copy to Clipboard"}
        </button>
      </section>
    </div>
  );
}
