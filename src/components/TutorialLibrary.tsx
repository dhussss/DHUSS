"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Clock3, FileText, FolderKanban, ReceiptText, UsersRound, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tutorial = {
  key: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  steps: string[];
  href: string;
  action: string;
  employersOnly?: boolean;
};

const tutorials: Tutorial[] = [
  {
    key: "first-job",
    title: "Client to invoice",
    summary: "The complete everyday workflow from a new client to a ready invoice.",
    icon: FolderKanban,
    steps: ["Add the client once with their billing details.", "Create a project and set your charge rate.", "Log hours and costs against that project.", "Create a draft from the unbilled work, review it, then send it."],
    href: "/clients/new",
    action: "Add a client"
  },
  {
    key: "hours",
    title: "Logging work",
    summary: "Record hours quickly and understand what stays unbilled.",
    icon: Clock3,
    steps: ["Use Log Work from Home or open a project.", "Choose total hours or start and end times.", "Add useful site notes before saving.", "Edit or remove an unbilled entry from the project if needed."],
    href: "/projects",
    action: "Open projects"
  },
  {
    key: "invoices",
    title: "Invoices and payment",
    summary: "Draft, review, email, and trace an invoice through to payment.",
    icon: FileText,
    steps: ["Choose a project and date range to collect unbilled work.", "Save the invoice as a draft and review the PDF.", "Email it only when the recipient and attachment look right.", "Mark it sent or paid; you can return it to an earlier state when needed."],
    href: "/invoices",
    action: "Open invoices"
  },
  {
    key: "expenses",
    title: "Costs and expenses",
    summary: "Keep project materials and business costs in the right place.",
    icon: ReceiptText,
    steps: ["Add billable materials from Log Work or the project.", "Use Expenses for broader business costs and tax records.", "Enter the amount paid; GST is calculated from your settings.", "Edit or remove costs while they are still safe to change."],
    href: "/expenses",
    action: "Open expenses"
  },
  {
    key: "calendar",
    title: "Finding missed billing",
    summary: "Use the project calendar colours to spot work that needs attention.",
    icon: CalendarDays,
    steps: ["Open a project and find Monthly Activity.", "Move backward or forward between months.", "Use the legend to distinguish unbilled, draft, sent, and paid work.", "Open the surrounding project records when a day looks incomplete."],
    href: "/projects",
    action: "View calendars"
  },
  {
    key: "team",
    title: "Team setup and wages",
    summary: "Connect a worker, assign jobs, and keep their hours and pay traceable.",
    icon: UsersRound,
    employersOnly: true,
    steps: ["Create a linking code and have the worker join with their own account.", "Assign a project with their pay rate and your client charge rate.", "Their logged hours appear on your project and invoices automatically.", "Track wage amounts and payment status from Team and Home."],
    href: "/team",
    action: "Open team"
  }
];

export function TutorialLibrary({ showTeam }: { showTeam: boolean }) {
  const available = tutorials.filter((tutorial) => showTeam || !tutorial.employersOnly);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = available.find((tutorial) => tutorial.key === activeKey) ?? null;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {available.map((tutorial) => {
          const Icon = tutorial.icon;
          return (
            <button key={tutorial.key} type="button" onClick={() => setActiveKey(tutorial.key)} className="group flex min-h-40 items-start gap-4 rounded-2xl border border-line bg-white p-5 text-left shadow-soft transition hover:border-mint/50">
              <span className="icon-tile shrink-0"><Icon size={21} aria-hidden="true" /></span>
              <span><span className="block text-xl font-black tracking-tight text-ink">{tutorial.title}</span><span className="mt-2 block text-sm font-medium leading-6 text-moss">{tutorial.summary}</span><span className="mt-3 block text-sm font-black text-mint">Open tutorial</span></span>
            </button>
          );
        })}
      </div>

      {active ? (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveKey(null); }}>
          <section className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl border border-line bg-paper shadow-lift" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
            <div className="flex items-start justify-between gap-4 border-b border-line bg-white p-5 sm:p-6">
              <div><p className="section-title">Tutorial</p><h2 id="tutorial-title" className="mt-1 text-2xl font-black tracking-tight text-ink">{active.title}</h2><p className="mt-2 text-sm font-medium leading-6 text-moss">{active.summary}</p></div>
              <button type="button" className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-white" onClick={() => setActiveKey(null)} aria-label="Close tutorial"><X size={19} aria-hidden="true" /></button>
            </div>
            <ol className="grid gap-3 p-5 sm:p-6">
              {active.steps.map((step, index) => <li key={step} className="flex gap-3 rounded-xl border border-line bg-white p-4"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-black text-white">{index + 1}</span><span className="text-sm font-semibold leading-6 text-moss">{step}</span></li>)}
            </ol>
            <div className="border-t border-line bg-white p-4 sm:px-6"><Link href={active.href} className="tap-primary w-full" onClick={() => setActiveKey(null)}>{active.action}</Link></div>
          </section>
        </div>
      ) : null}
    </>
  );
}
