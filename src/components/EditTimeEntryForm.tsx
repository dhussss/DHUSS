"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { updateTimeEntryAction } from "@/app/actions";
import { formatHours, parseClockTime } from "@/lib/time";
import { SubmitButton } from "@/components/SubmitButton";

type EditableTimeEntry = {
  id: string;
  projectId: string;
  dateValue: string;
  startTime: string | null;
  endTime: string | null;
  durationHours: string;
  notes: string;
};

export function EditTimeEntryForm({ entry }: { entry: EditableTimeEntry }) {
  const initialMode = entry.startTime && entry.endTime ? "range" : "duration";
  const [entryMode, setEntryMode] = useState<"duration" | "range">(initialMode);
  const [startTime, setStartTime] = useState(entry.startTime ?? "07:00");
  const [endTime, setEndTime] = useState(entry.endTime ?? "15:00");
  const [durationHours, setDurationHours] = useState(entry.durationHours);

  const calculatedRange = useMemo(() => {
    const start = parseClockTime(startTime);
    const end = parseClockTime(endTime);
    if (start === null || end === null || end <= start) return "0";
    return formatHours(end - start);
  }, [startTime, endTime]);

  return (
    <form action={updateTimeEntryAction} className="mt-6 grid gap-4">
      <input type="hidden" name="entryId" value={entry.id} />
      <input type="hidden" name="projectId" value={entry.projectId} />

      <label>
        Date
        <input name="date" type="date" defaultValue={entry.dateValue} required />
      </label>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-white p-1">
        <button
          type="button"
          className={`min-h-11 rounded-md text-sm font-bold ${entryMode === "duration" ? "bg-mint text-white" : "text-moss"}`}
          onClick={() => setEntryMode("duration")}
        >
          Total hours
        </button>
        <button
          type="button"
          className={`min-h-11 rounded-md text-sm font-bold ${entryMode === "range" ? "bg-mint text-white" : "text-moss"}`}
          onClick={() => setEntryMode("range")}
        >
          Start/end
        </button>
      </div>

      <input type="hidden" name="entryMode" value={entryMode} />

      {entryMode === "duration" ? (
        <label>
          Hours
          <input
            name="durationHours"
            type="number"
            inputMode="decimal"
            min="0.25"
            step="0.25"
            value={durationHours}
            onChange={(event) => setDurationHours(event.target.value)}
            required
          />
        </label>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label>
            Start
            <input
              name="startTime"
              type="time"
              step="900"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              required
            />
          </label>
          <label>
            End
            <input name="endTime" type="time" step="900" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
          </label>
          <p className="col-span-2 rounded-lg bg-mint/10 px-3 py-2 text-sm font-bold text-mint">
            Calculated: {calculatedRange} hours
          </p>
        </div>
      )}

      <label>
        Notes
        <textarea name="notes" defaultValue={entry.notes} placeholder="Work completed, site notes, materials handled" />
      </label>

      <SubmitButton className="tap-primary" pendingLabel="Saving changes...">
        <Save size={20} aria-hidden="true" />
        Save Changes
      </SubmitButton>
    </form>
  );
}
