"use client";

import { useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { createSubcontractorTimeEntryAction } from "@/app/team/actions";
import { todayInputValue } from "@/lib/dates";
import { formatHours, parseClockTime } from "@/lib/time";
import { SubmitButton } from "@/components/SubmitButton";

type AssignmentOption = {
  id: string;
  payRateCents: number;
  project: { title: string; client: { businessName: string } };
};

export function SubcontractorTimeForm({ assignments, returnTo = "/team/work?saved=1", hideProjectSelector = false }: { assignments: AssignmentOption[]; returnTo?: string; hideProjectSelector?: boolean }) {
  const [entryMode, setEntryMode] = useState<"duration" | "range">("duration");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("15:00");
  const calculatedRange = useMemo(() => {
    const start = parseClockTime(startTime);
    const end = parseClockTime(endTime);
    return start === null || end === null || end <= start ? "0" : formatHours(end - start);
  }, [endTime, startTime]);

  if (!assignments.length) return null;

  return (
    <form action={createSubcontractorTimeEntryAction} className="card mt-4 grid gap-4">
      <input type="hidden" name="returnTo" value={returnTo} />
      {hideProjectSelector ? <input type="hidden" name="assignmentId" value={assignments[0].id} /> : (
        <label>
          Assigned project
          <select name="assignmentId" defaultValue={assignments[0].id} required>
          {assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.project.title} - {assignment.project.client.businessName}
            </option>
          ))}
          </select>
        </label>
      )}
      <label>
        Date
        <input name="date" type="date" defaultValue={todayInputValue()} required />
      </label>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-paper p-1">
        <button type="button" className={`min-h-11 rounded-md text-sm font-bold ${entryMode === "duration" ? "bg-mint text-white" : "text-moss"}`} onClick={() => setEntryMode("duration")}>Total hours</button>
        <button type="button" className={`min-h-11 rounded-md text-sm font-bold ${entryMode === "range" ? "bg-mint text-white" : "text-moss"}`} onClick={() => setEntryMode("range")}>Start/end</button>
      </div>
      <input type="hidden" name="entryMode" value={entryMode} />

      {entryMode === "duration" ? (
        <label>
          Hours
          <input name="durationHours" type="number" inputMode="decimal" min="0.25" step="0.25" defaultValue="8" required />
        </label>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label>Start<input name="startTime" type="time" step="900" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></label>
          <label>End<input name="endTime" type="time" step="900" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label>
          <p className="col-span-2 rounded-lg bg-mint/10 px-3 py-2 text-sm font-semibold text-mint">Calculated: {calculatedRange} hours</p>
        </div>
      )}

      <label>
        Work completed
        <textarea name="notes" placeholder="What you worked on or any site notes" />
      </label>
      <SubmitButton className="tap-primary" pendingLabel="Submitting hours...">
        <Clock3 size={19} aria-hidden="true" />
        Submit hours
      </SubmitButton>
    </form>
  );
}
