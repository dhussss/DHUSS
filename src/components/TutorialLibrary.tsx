"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Compass,
  FileDown,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Pause,
  Play,
  ReceiptText,
  RefreshCcw,
  Search,
  Settings2,
  UsersRound,
  WalletCards,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  completeTutorialAction,
  restartTutorialAction,
  saveTutorialProgressAction
} from "@/app/tutorials/actions";
import { clampTutorialStep, tutorialCategories, tutorials } from "@/lib/tutorials";
import type { TutorialDefinition, TutorialIcon } from "@/lib/tutorials";

export type TutorialProgressSnapshot = {
  tutorialKey: string;
  status: string;
  currentStep: number;
  completedAt: string | null;
};

type ProgressState = Record<string, TutorialProgressSnapshot>;
type StatusFilter = "ALL" | "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

const iconMap: Record<TutorialIcon, LucideIcon> = {
  workflow: BriefcaseBusiness,
  navigation: Compass,
  dashboard: LayoutDashboard,
  clients: UsersRound,
  projects: FolderKanban,
  hours: Clock3,
  export: FileDown,
  expenses: ReceiptText,
  invoices: FileText,
  payments: WalletCards,
  insights: BarChart3,
  planner: CalendarDays,
  settings: Settings2,
  team: UsersRound
};

const statusLabels: Record<Exclude<StatusFilter, "ALL">, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed"
};

export function TutorialLibrary({
  showTeam,
  initialProgress,
  initialGuide,
  initialStep = 0
}: {
  showTeam: boolean;
  initialProgress: TutorialProgressSnapshot[];
  initialGuide?: string;
  initialStep?: number;
}) {
  const router = useRouter();
  const available = useMemo(() => tutorials.filter((tutorial) => showTeam || !tutorial.employersOnly), [showTeam]);
  const [progress, setProgress] = useState<ProgressState>(() => Object.fromEntries(initialProgress.map((item) => [item.tutorialKey, item])));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [activeKey, setActiveKey] = useState<string | null>(() => available.some((item) => item.key === initialGuide) ? initialGuide ?? null : null);
  const [activeStep, setActiveStep] = useState(() => clampTutorialStep(initialGuide, initialStep));
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const active = available.find((tutorial) => tutorial.key === activeKey) ?? null;

  useEffect(() => {
    if (!activeKey) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [activeKey]);

  useEffect(() => {
    if (!active) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeTutorial();
      if (event.key === "ArrowRight" && event.altKey) moveStep(1);
      if (event.key === "ArrowLeft" && event.altKey) moveStep(-1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const completedCount = available.filter((tutorial) => progress[tutorial.key]?.status === "COMPLETED").length;
  const inProgressCount = available.filter((tutorial) => progress[tutorial.key]?.status === "IN_PROGRESS").length;
  const completionPercent = available.length ? Math.round((completedCount / available.length) * 100) : 0;
  const normalisedQuery = query.trim().toLowerCase();
  const filtered = available.filter((tutorial) => {
    const tutorialStatus = statusOf(tutorial.key, progress);
    const matchesCategory = category === "All" || tutorial.category === category;
    const matchesStatus = statusFilter === "ALL" || tutorialStatus === statusFilter;
    const haystack = [tutorial.title, tutorial.summary, tutorial.purpose, tutorial.category, ...tutorial.keywords].join(" ").toLowerCase();
    return matchesCategory && matchesStatus && (!normalisedQuery || haystack.includes(normalisedQuery));
  });

  const grouped = tutorialCategories
    .map((name) => ({ name, tutorials: filtered.filter((tutorial) => tutorial.category === name) }))
    .filter((group) => group.tutorials.length > 0);

  function persist(
    action: (formData: FormData) => Promise<void>,
    tutorialKey: string,
    step: number,
    status: "IN_PROGRESS" | "COMPLETED"
  ) {
    const previous = progress[tutorialKey];
    const optimistic: TutorialProgressSnapshot = {
      tutorialKey,
      currentStep: step,
      status,
      completedAt: status === "COMPLETED" ? new Date().toISOString() : null
    };
    const formData = new FormData();
    formData.set("tutorialKey", tutorialKey);
    formData.set("currentStep", String(step));
    setProgress((current) => ({
      ...current,
      [tutorialKey]: optimistic
    }));
    setError("");
    startTransition(async () => {
      try {
        await action(formData);
      } catch {
        setProgress((current) => {
          if (current[tutorialKey] !== optimistic) return current;
          if (previous) return { ...current, [tutorialKey]: previous };

          const next = { ...current };
          delete next[tutorialKey];
          return next;
        });
        setError("Your progress could not be saved. The tutorial is still open, so you can try again.");
      }
    });
  }

  function openTutorial(tutorial: TutorialDefinition) {
    const saved = progress[tutorial.key];
    const nextStep = saved?.status === "IN_PROGRESS" ? Math.min(saved.currentStep, tutorial.steps.length - 1) : 0;
    setActiveKey(tutorial.key);
    setActiveStep(nextStep);
    setError("");
    router.replace(`/tutorials?guide=${encodeURIComponent(tutorial.key)}&step=${nextStep + 1}`, { scroll: false });
    if (!saved) persist(saveTutorialProgressAction, tutorial.key, nextStep, "IN_PROGRESS");
  }

  function closeTutorial() {
    setActiveKey(null);
    setError("");
    router.replace("/tutorials", { scroll: false });
  }

  function moveStep(direction: -1 | 1) {
    if (!active) return;
    const nextStep = Math.max(0, Math.min(activeStep + direction, active.steps.length - 1));
    if (nextStep === activeStep) return;
    setActiveStep(nextStep);
    router.replace(`/tutorials?guide=${encodeURIComponent(active.key)}&step=${nextStep + 1}`, { scroll: false });
    if (progress[active.key]?.status !== "COMPLETED") {
      persist(saveTutorialProgressAction, active.key, nextStep, "IN_PROGRESS");
    }
  }

  function completeActive() {
    if (!active) return;
    persist(completeTutorialAction, active.key, active.steps.length - 1, "COMPLETED");
  }

  function restartActive() {
    if (!active) return;
    setActiveStep(0);
    persist(restartTutorialAction, active.key, 0, "IN_PROGRESS");
    router.replace(`/tutorials?guide=${encodeURIComponent(active.key)}&step=1`, { scroll: false });
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-line bg-white shadow-soft" aria-labelledby="learning-progress-title">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="section-title">Your learning progress</p>
            <h2 id="learning-progress-title" className="mt-1 text-2xl font-semibold text-ink">Build confidence one workflow at a time</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-moss">Start with the complete work lifecycle, then learn individual tools when they become relevant.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <ProgressMetric value={`${completionPercent}%`} label="complete" />
            <ProgressMetric value={String(completedCount)} label="finished" />
            <ProgressMetric value={String(inProgressCount)} label="in progress" />
          </div>
        </div>
        <div className="h-2 bg-paper" aria-label={`${completionPercent}% of available tutorials complete`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent}>
          <div className="h-full bg-mint transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${completionPercent}%` }} />
        </div>
      </section>

      <section className="mt-5" aria-labelledby="tutorial-library-title">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-title">Learning centre</p>
            <h2 id="tutorial-library-title" className="mt-1 text-2xl font-semibold text-ink">Tutorial library</h2>
          </div>
          <label className="relative block w-full lg:max-w-md">
            <span className="sr-only">Search tutorials</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-moss" size={19} aria-hidden="true" />
            <input className="min-h-12 pl-11" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search hours, invoices, GST..." />
          </label>
        </div>

        <div className="mt-4 overflow-x-auto pb-1" aria-label="Tutorial categories">
          <div className="flex min-w-max gap-2">
            {["All", ...tutorialCategories].map((item) => (
              <button key={item} type="button" className={`filter-chip ${category === item ? "is-active" : ""}`} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Tutorial status">
          {(["ALL", "NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as StatusFilter[]).map((item) => (
            <button key={item} type="button" className={`filter-chip ${statusFilter === item ? "is-active" : ""}`} aria-pressed={statusFilter === item} onClick={() => setStatusFilter(item)}>{item === "ALL" ? "All progress" : statusLabels[item]}</button>
          ))}
        </div>

        {grouped.length ? (
          <div className="mt-6 grid gap-8">
            {grouped.map((group) => (
              <section key={group.name} aria-labelledby={`tutorial-category-${slug(group.name)}`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 id={`tutorial-category-${slug(group.name)}`} className="text-lg font-semibold text-ink">{group.name}</h3>
                  <span className="text-xs font-bold text-moss">{group.tutorials.length} guide{group.tutorials.length === 1 ? "" : "s"}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.tutorials.map((tutorial) => <TutorialCard key={tutorial.key} tutorial={tutorial} progress={progress[tutorial.key]} onOpen={() => openTutorial(tutorial)} />)}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-line bg-paper/40 p-8 text-center">
            <BookOpenCheck className="mx-auto text-mint" size={26} aria-hidden="true" />
            <h3 className="mt-3 text-lg font-semibold text-ink">No matching tutorials</h3>
            <p className="mt-1 text-sm font-medium text-moss">Try a broader search or clear the category and progress filters.</p>
            <button type="button" className="tap-secondary mt-4" onClick={() => { setQuery(""); setCategory("All"); setStatusFilter("ALL"); }}>Clear filters</button>
          </div>
        )}
      </section>

      {active ? (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/45 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTutorial(); }}>
          <section className="flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-xl border border-line bg-paper shadow-lift sm:max-h-[92vh] sm:rounded-xl" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-summary">
            <div className="flex items-start justify-between gap-4 border-b border-line bg-white p-4 sm:p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="section-title">{active.category}</p>
                  <TutorialStatus status={statusOf(active.key, progress)} />
                  <span className="text-xs font-bold text-moss">{active.durationMinutes} min</span>
                </div>
                <h2 id="tutorial-title" className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">{active.title}</h2>
                <p id="tutorial-summary" className="mt-1 text-sm font-medium leading-6 text-moss">{active.summary}</p>
              </div>
              <button ref={closeButtonRef} type="button" className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-white" onClick={closeTutorial} aria-label="Close tutorial"><X size={19} aria-hidden="true" /></button>
            </div>

            <div className="overflow-y-auto overscroll-contain">
              <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="grid content-start gap-4">
                  <TutorialDemo tutorial={active} />
                  <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
                    <PurposeLine term="Why it matters" detail={active.purpose} />
                    <PurposeLine term="When to use it" detail={active.whenToUse} />
                    <PurposeLine term="You will leave knowing" detail={active.outcome} />
                  </dl>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-moss">Step {activeStep + 1} of {active.steps.length}</p>
                    {progress[active.key]?.status === "COMPLETED" ? <button type="button" className="inline-flex items-center gap-1.5 text-xs font-bold text-mint" onClick={restartActive}><RefreshCcw size={14} aria-hidden="true" />Restart</button> : null}
                  </div>
                  <div className="mt-2 flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={active.steps.length} aria-valuenow={activeStep + 1} aria-label={`Step ${activeStep + 1} of ${active.steps.length}`}>
                    {active.steps.map((step, index) => <span key={step.title} className={`h-1.5 flex-1 rounded-full ${index <= activeStep ? "bg-mint" : "bg-line"}`} />)}
                  </div>

                  <article className="mt-5 min-h-64 rounded-xl border border-line bg-white p-5 sm:p-6" aria-live="polite">
                    <span className="grid size-9 place-items-center rounded-lg bg-ink text-sm font-black text-white">{activeStep + 1}</span>
                    <h3 className="mt-5 text-2xl font-semibold text-ink">{active.steps[activeStep].title}</h3>
                    <p className="mt-3 text-sm font-medium leading-7 text-moss">{active.steps[activeStep].body}</p>
                    {active.steps[activeStep].points?.length ? (
                      <ul className="mt-4 grid gap-2">
                        {active.steps[activeStep].points?.map((point) => <li key={point} className="flex gap-2 text-sm font-medium text-moss"><Check className="mt-0.5 shrink-0 text-mint" size={16} aria-hidden="true" />{point}</li>)}
                      </ul>
                    ) : null}
                  </article>

                  {error ? <p className="mt-3 rounded-lg border border-gum/30 bg-gum/10 p-3 text-sm font-bold text-gum" role="alert">{error}</p> : null}
                  <p className="mt-3 text-xs font-medium text-moss">Tip: use Alt + Left or Alt + Right to move between steps.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-2 border-t border-line bg-white p-3 sm:flex sm:items-center sm:justify-between sm:p-4">
              <Link href={active.actionHref} className="tap-secondary order-3 w-full sm:order-none sm:w-auto">{active.actionLabel}<ArrowRight size={16} aria-hidden="true" /></Link>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <button type="button" className="tap-secondary" onClick={() => moveStep(-1)} disabled={activeStep === 0 || isPending}><ArrowLeft size={17} aria-hidden="true" />Back</button>
                {activeStep === active.steps.length - 1 ? (
                  <button type="button" className="tap-primary" onClick={completeActive} disabled={isPending || progress[active.key]?.status === "COMPLETED"}><CheckCircle2 size={17} aria-hidden="true" />{progress[active.key]?.status === "COMPLETED" ? "Completed" : "Mark complete"}</button>
                ) : (
                  <button type="button" className="tap-primary" onClick={() => moveStep(1)} disabled={isPending}>Next<ArrowRight size={17} aria-hidden="true" /></button>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function TutorialCard({ tutorial, progress, onOpen }: { tutorial: TutorialDefinition; progress?: TutorialProgressSnapshot; onOpen: () => void }) {
  const Icon = iconMap[tutorial.icon];
  const status = progress?.status === "COMPLETED" ? "COMPLETED" : progress ? "IN_PROGRESS" : "NOT_STARTED";
  const stepText = status === "IN_PROGRESS" && progress ? `Continue at step ${Math.min(progress.currentStep + 1, tutorial.steps.length)}` : status === "COMPLETED" ? "Replay tutorial" : "Start tutorial";
  return (
    <button type="button" onClick={onOpen} className="group flex min-h-48 flex-col rounded-xl border border-line bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-mint/50 hover:shadow-lift motion-reduce:hover:translate-y-0">
      <div className="flex items-start justify-between gap-3">
        <span className="icon-tile shrink-0"><Icon size={20} aria-hidden="true" /></span>
        <TutorialStatus status={status} />
      </div>
      <h4 className="mt-4 text-xl font-semibold text-ink">{tutorial.title}</h4>
      <p className="mt-2 flex-1 text-sm font-medium leading-6 text-moss">{tutorial.summary}</p>
      <span className="mt-4 flex items-center justify-between gap-3 text-sm font-bold text-mint"><span>{stepText}</span><span className="text-xs text-moss">{tutorial.durationMinutes} min</span></span>
    </button>
  );
}

function TutorialStatus({ status }: { status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" }) {
  const Icon = status === "COMPLETED" ? CheckCircle2 : status === "IN_PROGRESS" ? Clock3 : Circle;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.68rem] font-bold ${status === "COMPLETED" ? "bg-mint/10 text-mint" : status === "IN_PROGRESS" ? "bg-yolk/20 text-ink" : "bg-paper text-moss"}`}><Icon size={12} aria-hidden="true" />{statusLabels[status]}</span>;
}

function TutorialDemo({ tutorial }: { tutorial: TutorialDefinition }) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setFrame(0);
    if (!playing || reducedMotion || tutorial.demoFrames.length < 2) return;
    const timer = window.setInterval(() => setFrame((current) => (current + 1) % tutorial.demoFrames.length), 2200);
    return () => window.clearInterval(timer);
  }, [playing, reducedMotion, tutorial]);

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-ink text-white">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <figcaption className="text-xs font-bold uppercase text-white/70">Workflow demonstration</figcaption>
        <button type="button" className="grid size-8 place-items-center rounded-lg bg-white/10 text-white" onClick={() => setPlaying((current) => !current)} aria-label={playing ? "Pause demonstration" : "Play demonstration"} disabled={reducedMotion}>{playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}</button>
      </div>
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-4 gap-2" aria-hidden="true">
          {tutorial.demoFrames.map((item, index) => (
            <div key={`${tutorial.key}-${item.label}`} className={`h-1.5 rounded-full transition-colors duration-300 motion-reduce:transition-none ${index <= frame ? "bg-mint" : "bg-white/15"}`} />
          ))}
        </div>
        <div className="mt-5 flex min-h-36 items-center gap-4 rounded-lg border border-white/10 bg-white/[0.06] p-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-mint text-sm font-black text-white shadow-soft">{tutorial.demoFrames[frame].label}</span>
          <div key={`${tutorial.key}-${frame}`} className="motion-safe:animate-[fadeIn_300ms_ease-out]">
            <p className="text-lg font-semibold text-white">{tutorial.demoFrames[frame].title}</p>
            <p className="mt-1 text-sm font-medium leading-6 text-white/65">{tutorial.demoFrames[frame].detail}</p>
          </div>
        </div>
        {reducedMotion ? <p className="mt-3 text-xs font-medium text-white/60">Animation is paused because reduced motion is enabled.</p> : null}
        <details className="mt-3 text-xs text-white/70">
          <summary className="cursor-pointer font-bold text-white/80">Read demonstration transcript</summary>
          <ol className="mt-2 grid gap-1.5 pl-4">
            {tutorial.demoFrames.map((item) => <li key={item.title}><strong>{item.title}:</strong> {item.detail}</li>)}
          </ol>
        </details>
      </div>
    </figure>
  );
}

function PurposeLine({ term, detail }: { term: string; detail: string }) {
  return <div className="border-l-2 border-mint pl-3"><dt className="text-xs font-bold uppercase text-mint">{term}</dt><dd className="mt-1 text-sm font-medium leading-6 text-moss">{detail}</dd></div>;
}

function ProgressMetric({ value, label }: { value: string; label: string }) {
  return <div><strong className="block text-xl font-semibold text-ink">{value}</strong><span className="text-xs font-bold text-moss">{label}</span></div>;
}

function statusOf(tutorialKey: string, progress: ProgressState): "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" {
  const value = progress[tutorialKey]?.status;
  return value === "COMPLETED" ? "COMPLETED" : value === "IN_PROGRESS" ? "IN_PROGRESS" : "NOT_STARTED";
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
