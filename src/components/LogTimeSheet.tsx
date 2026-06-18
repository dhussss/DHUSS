"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarPlus, ClipboardPlus, Clock3, PackagePlus, X } from "lucide-react";
import { createExpenseItemAction, createTimeEntryAction } from "@/app/actions";
import { todayInputValue } from "@/lib/dates";
import { formatHours, parseClockTime } from "@/lib/time";

type ProjectOption = {
  id: string;
  title: string;
  client: { businessName: string };
};

export function LogTimeSheet({
  projects,
  defaultProjectId,
  buttonLabel = "Log Time"
}: {
  projects: ProjectOption[];
  defaultProjectId?: string;
  buttonLabel?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"time" | "item">("time");
  const [entryMode, setEntryMode] = useState<"duration" | "range">("duration");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("15:00");
  const [durationHours, setDurationHours] = useState("8");

  const calculatedRange = useMemo(() => {
    const start = parseClockTime(startTime);
    const end = parseClockTime(endTime);
    if (start === null || end === null || end <= start) return "0";
    return formatHours(end - start);
  }, [startTime, endTime]);

  const projectSelect = (
    <label>
      Project
      <select name="projectId" defaultValue={defaultProjectId ?? projects[0]?.id ?? ""} required>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.title} - {project.client.businessName}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <button type="button" className="tap-primary w-full sm:w-auto" onClick={() => setOpen(true)}>
        <CalendarPlus size={20} aria-hidden="true" />
        {buttonLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/40 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-lg bg-paper p-4 shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="section-title">Quick entry</p>
                <h2 className="text-2xl font-black tracking-normal">Log work</h2>
              </div>
              <button
                type="button"
                className="grid size-11 place-items-center rounded-lg border border-line bg-white text-ink"
                onClick={() => setOpen(false)}
                aria-label="Close log form"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-white p-1">
              <button
                type="button"
                className={`min-h-11 rounded-md text-sm font-bold ${mode === "time" ? "bg-ink text-white" : "text-moss"}`}
                onClick={() => setMode("time")}
              >
                <Clock3 className="mx-auto mb-1" size={18} aria-hidden="true" />
                Time
              </button>
              <button
                type="button"
                className={`min-h-11 rounded-md text-sm font-bold ${mode === "item" ? "bg-ink text-white" : "text-moss"}`}
                onClick={() => setMode("item")}
              >
                <PackagePlus className="mx-auto mb-1" size={18} aria-hidden="true" />
                Item
              </button>
            </div>

            {mode === "time" ? (
              <form action={createTimeEntryAction} className="mt-5 grid gap-4">
                <input type="hidden" name="returnTo" value={pathname} />
                {projectSelect}
                <label>
                  Date
                  <input name="date" type="date" defaultValue={todayInputValue()} required />
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
                      <input
                        name="endTime"
                        type="time"
                        step="900"
                        value={endTime}
                        onChange={(event) => setEndTime(event.target.value)}
                        required
                      />
                    </label>
                    <p className="col-span-2 rounded-lg bg-mint/10 px-3 py-2 text-sm font-bold text-mint">
                      Calculated: {calculatedRange} hours
                    </p>
                  </div>
                )}

                <label>
                  Notes
                  <textarea name="notes" placeholder="Work completed, site notes, materials handled" />
                </label>

                <button className="tap-primary" type="submit">
                  <ClipboardPlus size={20} aria-hidden="true" />
                  Save Time
                </button>
              </form>
            ) : (
              <form action={createExpenseItemAction} className="mt-5 grid gap-4">
                <input type="hidden" name="returnTo" value={pathname} />
                {projectSelect}
                <label>
                  Date purchased
                  <input name="datePurchased" type="date" defaultValue={todayInputValue()} required />
                </label>
                <label>
                  Description
                  <input name="description" placeholder="Materials, hire, consumables" required />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    Quantity
                    <input name="quantity" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue="1" required />
                  </label>
                  <label>
                    Unit cost
                    <input name="unitCost" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" required />
                  </label>
                </div>
                <label>
                  Notes
                  <textarea name="itemNotes" placeholder="Receipt detail or item notes" />
                </label>
                <button className="tap-primary" type="submit">
                  <PackagePlus size={20} aria-hidden="true" />
                  Save Item
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
