"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarPlus, ClipboardPlus, Clock3, CloudOff, PackagePlus, RotateCcw, Trash2, X } from "lucide-react";
import { createExpenseItemAction, createTimeEntryAction } from "@/app/actions";
import { createSubcontractorTimeEntryAction } from "@/app/team/actions";
import { todayInputValue } from "@/lib/dates";
import { formatHours, parseClockTime } from "@/lib/time";
import { SubmitButton } from "@/components/SubmitButton";
import { useOnlineStatus } from "@/lib/use-online-status";

type ProjectOption = {
  id: string;
  title: string;
  client: { businessName: string };
};

type AssignedProjectOption = {
  id: string;
  project: ProjectOption;
};

type WorkDraft = {
  updatedAt: string;
  mode: "time" | "item";
  selectedTimeProject: string;
  entryMode: "duration" | "range";
  startTime: string;
  endTime: string;
  durationHours: string;
  logDayOff: boolean;
  timeDate: string;
  timeNotes: string;
  selectedItemProject: string;
  itemDate: string;
  itemDescription: string;
  itemQuantity: string;
  itemUnitCost: string;
  itemNotes: string;
};

function hasMeaningfulDraft(draft: WorkDraft, today: string, savedMode: string | null) {
  const timeChanged = savedMode !== "time" && (
    draft.timeDate !== today || draft.timeNotes.trim() || draft.entryMode !== "duration" ||
    draft.durationHours !== "8" || draft.startTime !== "07:00" || draft.endTime !== "15:00" || draft.logDayOff
  );
  const itemChanged = savedMode !== "item" && (
    draft.itemDate !== today || draft.itemDescription.trim() || draft.itemQuantity !== "1" ||
    draft.itemUnitCost.trim() || draft.itemNotes.trim()
  );
  return Boolean(timeChanged || itemChanged);
}

export function LogTimeSheet({
  projects,
  assignedProjects = [],
  defaultProjectId,
  buttonLabel = "Log Time",
  returnTo,
  storageScope
}: {
  projects: ProjectOption[];
  assignedProjects?: AssignedProjectOption[];
  defaultProjectId?: string;
  buttonLabel?: string;
  returnTo?: string;
  storageScope: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const online = useOnlineStatus();
  const defaultDate = useMemo(() => todayInputValue(), []);
  const lastProjectKey = `trade-invoice-tracker:last-work-project:v1:${storageScope}`;
  const draftKey = `trade-invoice-tracker:work-draft:v1:${storageScope}`;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"time" | "item">("time");
  const [entryMode, setEntryMode] = useState<"duration" | "range">("duration");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("15:00");
  const [durationHours, setDurationHours] = useState("8");
  const [logDayOff, setLogDayOff] = useState(false);
  const [timeDate, setTimeDate] = useState(defaultDate);
  const [timeNotes, setTimeNotes] = useState("");
  const [selectedItemProject, setSelectedItemProject] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [itemDate, setItemDate] = useState(defaultDate);
  const [itemDescription, setItemDescription] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [itemUnitCost, setItemUnitCost] = useState("");
  const [itemNotes, setItemNotes] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const draftLoadedRef = useRef(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const initialTimeProject = defaultProjectId
    ? `owned:${defaultProjectId}`
    : projects[0]
      ? `owned:${projects[0].id}`
      : assignedProjects[0]
        ? `assigned:${assignedProjects[0].id}`
        : "";
  const [selectedTimeProject, setSelectedTimeProject] = useState(initialTimeProject);
  const availableProjectKeys = useMemo(
    () => new Set([
      ...projects.map((project) => `owned:${project.id}`),
      ...assignedProjects.map((assignment) => `assigned:${assignment.id}`)
    ]),
    [assignedProjects, projects]
  );
  const selectedAssignmentId = selectedTimeProject.startsWith("assigned:") ? selectedTimeProject.slice("assigned:".length) : "";
  const selectedOwnedProjectId = selectedTimeProject.startsWith("owned:") ? selectedTimeProject.slice("owned:".length) : "";
  const isAssignedTime = Boolean(selectedAssignmentId);
  const timeReturnTo = returnTo ?? (pathname === "/" ? (isAssignedTime ? "/?assignedTimeSaved=1" : "/?timeSaved=1") : pathname);

  useEffect(() => {
    if (defaultProjectId) return;
    try {
      const storedProject = window.localStorage.getItem(lastProjectKey);
      if (storedProject && availableProjectKeys.has(storedProject)) {
        setSelectedTimeProject(storedProject);
        if (storedProject.startsWith("owned:")) setSelectedItemProject(storedProject.slice("owned:".length));
      }
    } catch {
      // The first available project remains selected when browser storage is unavailable.
    }
  }, [availableProjectKeys, defaultProjectId, lastProjectKey]);

  useEffect(() => {
    if (draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    const savedMode = searchParams.get("workSaved");

    try {
      const rawDraft = window.localStorage.getItem(draftKey);
      const draft = rawDraft ? JSON.parse(rawDraft) as WorkDraft : null;
      const fresh = draft && Date.now() - new Date(draft.updatedAt).getTime() < 14 * 24 * 60 * 60 * 1000;

      if (draft && fresh) {
        if (savedMode !== "time") {
          if (availableProjectKeys.has(draft.selectedTimeProject)) setSelectedTimeProject(draft.selectedTimeProject);
          setEntryMode(draft.entryMode === "range" ? "range" : "duration");
          setStartTime(draft.startTime || "07:00");
          setEndTime(draft.endTime || "15:00");
          setDurationHours(draft.durationHours || "8");
          setLogDayOff(Boolean(draft.logDayOff));
          setTimeDate(draft.timeDate || defaultDate);
          setTimeNotes(draft.timeNotes || "");
        }
        if (savedMode !== "item") {
          if (projects.some((project) => project.id === draft.selectedItemProject)) setSelectedItemProject(draft.selectedItemProject);
          setItemDate(draft.itemDate || defaultDate);
          setItemDescription(draft.itemDescription || "");
          setItemQuantity(draft.itemQuantity || "1");
          setItemUnitCost(draft.itemUnitCost || "");
          setItemNotes(draft.itemNotes || "");
        }
        if (!savedMode && (draft.mode === "time" || draft.mode === "item")) setMode(draft.mode);
        setRestoredDraft(hasMeaningfulDraft(draft, defaultDate, savedMode));
      }
    } catch {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // Continue with a clean in-memory form when storage is unavailable.
      }
    }
    setDraftReady(true);
  }, [availableProjectKeys, defaultDate, draftKey, projects, searchParams]);

  useEffect(() => {
    const requestedMode = searchParams.get("logWork");
    const savedMode = searchParams.get("workSaved");
    if (requestedMode === "time" || requestedMode === "item") {
      setMode(requestedMode === "item" && projects.length === 0 ? "time" : requestedMode);
      setOpen(true);
    }
    if (!requestedMode && !savedMode) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("logWork");
    url.searchParams.delete("workSaved");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [projects.length, searchParams]);

  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      const draft: WorkDraft = {
        updatedAt: new Date().toISOString(), mode, selectedTimeProject, entryMode, startTime, endTime,
        durationHours, logDayOff, timeDate, timeNotes, selectedItemProject, itemDate,
        itemDescription, itemQuantity, itemUnitCost, itemNotes
      };
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        // Work entry remains usable when browser storage is unavailable.
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draftKey, draftReady, durationHours, endTime, entryMode, itemDate, itemDescription, itemNotes, itemQuantity, itemUnitCost, logDayOff, mode, selectedItemProject, selectedTimeProject, startTime, timeDate, timeNotes]);

  function discardDraft() {
    setEntryMode("duration");
    setStartTime("07:00");
    setEndTime("15:00");
    setDurationHours("8");
    setLogDayOff(false);
    setTimeDate(defaultDate);
    setTimeNotes("");
    setSelectedItemProject(defaultProjectId ?? projects[0]?.id ?? "");
    setItemDate(defaultDate);
    setItemDescription("");
    setItemQuantity("1");
    setItemUnitCost("");
    setItemNotes("");
    setRestoredDraft(false);
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // State is still cleared for this session.
    }
  }

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
          try {
            window.localStorage.setItem(lastProjectKey, event.target.value);
          } catch {
            // The selection still works for this entry when storage is unavailable.
          }
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
      <select name="projectId" value={selectedItemProject} onChange={(event) => {
        setSelectedItemProject(event.target.value);
        try {
          window.localStorage.setItem(lastProjectKey, `owned:${event.target.value}`);
        } catch {
          // The selection still works for this entry when storage is unavailable.
        }
      }} required>
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

            {!online ? (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-yolk/40 bg-yolk/10 p-3 text-sm font-semibold leading-6 text-ink" role="status">
                <CloudOff className="mt-0.5 shrink-0 text-yolk" size={18} aria-hidden="true" />
                <span>You’re offline. Keep entering the details: this draft stays on this device, and Save will become available when you reconnect.</span>
              </div>
            ) : null}

            {restoredDraft ? (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-mint/25 bg-mint/[0.07] p-3 text-sm font-semibold text-moss" role="status">
                <span>Unfinished work restored from this device.</span>
                <button type="button" className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-gum" onClick={discardDraft}>
                  <Trash2 size={15} aria-hidden="true" />Discard
                </button>
              </div>
            ) : null}

            {mode === "time" ? (
              <form action={isAssignedTime ? createSubcontractorTimeEntryAction : createTimeEntryAction} className="mt-5 grid gap-4">
                <input type="hidden" name="returnTo" value={timeReturnTo} />
                {isAssignedTime ? <input type="hidden" name="assignmentId" value={selectedAssignmentId} /> : <input type="hidden" name="projectId" value={selectedOwnedProjectId} />}
                {timeProjectSelect}
                <label>
                  Date
                  <input name="date" type="date" value={timeDate} onChange={(event) => setTimeDate(event.target.value)} required />
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
                  <textarea name="notes" value={timeNotes} onChange={(event) => setTimeNotes(event.target.value)} placeholder={logDayOff ? "Optional note for the day off" : "Work completed, site notes, materials handled"} />
                </label>

                <div className="grid gap-2 sm:grid-cols-2">
                  <SubmitButton className="tap-primary" pendingLabel="Saving time..." disabled={!online}>
                    <ClipboardPlus size={20} aria-hidden="true" />
                    {logDayOff ? "Save Day Off" : "Save Time"}
                  </SubmitButton>
                  <SubmitButton className="tap-secondary" pendingLabel="Saving time..." name="continueLogging" value="1" disabled={!online}>
                    <RotateCcw size={18} aria-hidden="true" />
                    Save &amp; log another
                  </SubmitButton>
                </div>
              </form>
            ) : (
              <form action={createExpenseItemAction} className="mt-5 grid gap-4">
                <input type="hidden" name="returnTo" value={pathname} />
                {ownedProjectSelect}
                <label>
                  Date purchased
                  <input name="datePurchased" type="date" value={itemDate} onChange={(event) => setItemDate(event.target.value)} required />
                </label>
                <label>
                  Description
                  <input name="description" value={itemDescription} onChange={(event) => setItemDescription(event.target.value)} placeholder="Materials, hire, consumables" required />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    Quantity
                    <input name="quantity" type="number" inputMode="decimal" min="0.01" step="0.01" value={itemQuantity} onChange={(event) => setItemQuantity(event.target.value)} required />
                  </label>
                  <label>
                    Unit cost
                    <input name="unitCost" type="number" inputMode="decimal" min="0.01" step="0.01" value={itemUnitCost} onChange={(event) => setItemUnitCost(event.target.value)} placeholder="0.00" required />
                  </label>
                </div>
                <label>
                  Notes
                  <textarea name="itemNotes" value={itemNotes} onChange={(event) => setItemNotes(event.target.value)} placeholder="Receipt detail or item notes" />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <SubmitButton className="tap-primary" pendingLabel="Saving item..." disabled={!online}>
                    <PackagePlus size={20} aria-hidden="true" />
                    Save Item
                  </SubmitButton>
                  <SubmitButton className="tap-secondary" pendingLabel="Saving item..." name="continueLogging" value="1" disabled={!online}>
                    <RotateCcw size={18} aria-hidden="true" />
                    Save &amp; add another
                  </SubmitButton>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
