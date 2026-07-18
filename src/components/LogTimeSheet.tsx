"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarPlus, ClipboardPlus, Clock3, PackagePlus, X } from "lucide-react";
import { createExpenseItemAction, createTimeEntryAction } from "@/app/actions";
import { createSubcontractorTimeEntryAction } from "@/app/team/actions";
import { todayInputValue } from "@/lib/dates";
import { formatHours, parseClockTime } from "@/lib/time";
import { SubmitButton } from "@/components/SubmitButton";

type ProjectOption = {
  id: string;
  title: string;
  client: { businessName: string };
};

type AssignedProjectOption = {
  id: string;
  project: ProjectOption;
};

export function LogTimeSheet({
  projects,
  assignedProjects = [],
  defaultProjectId,
  buttonLabel = "Log Time",
  returnTo
}: {
  projects: ProjectOption[];
  assignedProjects?: AssignedProjectOption[];
  defaultProjectId?: string;
  buttonLabel?: string;
  returnTo?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"time" | "item">("time");
  const [entryMode, setEntryMode] = useState<"duration" | "range">("duration");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("15:00");
  const [durationHours, setDurationHours] = useState("8");
  const [logDayOff, setLogDayOff] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const initialTimeProject = defaultProjectId
    ? `owned:${defaultProjectId}`
    : projects[0]
      ? `owned:${projects[0].id}`
      : assignedProjects[0]
        ? `assigned:${assignedProjects[0].id}`
        : "";
  const [selectedTimeProject, setSelectedTimeProject] = useState(initialTimeProject);
  const selectedAssignmentId = selectedTimeProject.startsWith("assigned:") ? selectedTimeProject.slice("assigned:".length) : "";
  const selectedOwnedProjectId = selectedTimeProject.startsWith("owned:") ? selectedTimeProject.slice("owned:".length) : "";
  const isAssignedTime = Boolean(selectedAssignmentId);
  const timeReturnTo = returnTo ?? (pathname === "/" ? (isAssignedTime ? "/?assignedTimeSaved=1" : "/?timeSaved=1") : pathname);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const calculatedRange = useMemo(() => {
    const start = parseClockTime(startTime);
    const end = parseClockTime(endTime);
    if (start === null || end === null || end <= start) return "0";
    return formatHours(end - start);
  }, [startTime, endTime]);

  const timeProjectSelect = (
    <label>
      Project
      <select
        value={selectedTimeProject}
        onChange={(event) => {
          setSelectedTimeProject(event.target.value);
          if (event.target.value.startsWith("assigned:")) setLogDayOff(false);
        }}
        required
      >
        {projects.map((project) => (
          <option key={project.id} value={`owned:${project.id}`}>
            {project.title} - {project.client.businessName}
          </option>
        ))}
        {assignedProjects.map((assignment) => (
          <option key={assignment.id} value={`assigned:${assignment.id}`}>
            {assignment.project.title} - {assignment.project.client.businessName} (Assigned)
          </option>
        ))}
      </select>
    </label>
  );

  const ownedProjectSelect = (
    <label>
      Project
      <select name="projectId" defaultValue={defaultProjectId ?? projects[0]?.id ?? ""} required>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.title} - {project.client.businessName}</option>)}
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
        <div
          className="fixed inset-0 z-50 flex items-end bg-ink/40 p-3 backdrop-blur-sm sm:items-center sm:justify-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg overflow-auto rounded-lg border border-line bg-paper p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-ink shadow-lift"
            style={{ maxHeight: "calc(100dvh - 1.5rem)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-work-title"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="section-title">Quick entry</p>
                <h2 id="log-work-title" className="text-2xl font-semibold text-ink">Log work</h2>
              </div>
              <button
                type="button"
                ref={closeButtonRef}
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
                disabled={!projects.length}
                title={!projects.length ? "Items can only be added to your own projects" : undefined}
              >
                <PackagePlus className="mx-auto mb-1" size={18} aria-hidden="true" />
                Item
              </button>
            </div>

            {mode === "time" ? (
              <form action={isAssignedTime ? createSubcontractorTimeEntryAction : createTimeEntryAction} className="mt-5 grid gap-4">
                <input type="hidden" name="returnTo" value={timeReturnTo} />
                {isAssignedTime ? <input type="hidden" name="assignmentId" value={selectedAssignmentId} /> : <input type="hidden" name="projectId" value={selectedOwnedProjectId} />}
                {timeProjectSelect}
                <label>
                  Date
                  <input name="date" type="date" defaultValue={todayInputValue()} required />
                </label>

                {!isAssignedTime ? <label className="flex min-h-12 grid-cols-none flex-row items-center gap-3 rounded-lg border border-line bg-white px-3">
                  <input
                    className="size-5 min-h-0 w-auto"
                    type="checkbox"
                    name="logDayOff"
                    checked={logDayOff}
                    onChange={(event) => setLogDayOff(event.target.checked)}
                  />
                  Log day off
                </label> : <p className="rounded-lg border border-mint/20 bg-mint/10 p-3 text-sm font-bold text-moss">These hours will be submitted directly to the assigning contractor.</p>}

                {logDayOff ? (
                  <div className="rounded-lg border border-mint/25 bg-mint/10 p-3 text-sm font-bold leading-6 text-moss">
                    This records a planned zero-hour work day for averages. It will not create a billable time entry.
                  </div>
                ) : (
                  <>
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
                  </>
                )}

                <label>
                  Notes
                  <textarea name="notes" placeholder={logDayOff ? "Optional note for the day off" : "Work completed, site notes, materials handled"} />
                </label>

                <SubmitButton className="tap-primary" pendingLabel="Saving time...">
                  <ClipboardPlus size={20} aria-hidden="true" />
                  {logDayOff ? "Save Day Off" : "Save Time"}
                </SubmitButton>
              </form>
            ) : (
              <form action={createExpenseItemAction} className="mt-5 grid gap-4">
                <input type="hidden" name="returnTo" value={pathname} />
                {ownedProjectSelect}
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
                <SubmitButton className="tap-primary" pendingLabel="Saving item...">
                  <PackagePlus size={20} aria-hidden="true" />
                  Save Item
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
