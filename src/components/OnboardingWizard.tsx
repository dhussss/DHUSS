"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Check,
  Clock3,
  FileText,
  FolderKanban,
  ReceiptText,
  UserRound,
  UsersRound,
  WalletCards
} from "lucide-react";
import { saveOnboardingSetupAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

type BusinessStructure = "SOLE_TRADER" | "EMPLOYER";
type StepKey = "structure" | "details" | "workflow" | "team" | "ready";

type InitialValues = {
  businessStructure: BusinessStructure | null;
  tradingName: string;
  contactName: string;
  defaultHourlyRate: string;
  paymentTermsDays: number;
  gstRegistered: boolean;
  invoicePrefix: string;
};

const workflowItems = [
  {
    key: "client",
    title: "Add the client",
    short: "Save their contact and billing details once.",
    detail: "Clients hold the business name, contact, email, phone, ABN and address used across their jobs and future invoices.",
    icon: UserRound
  },
  {
    key: "project",
    title: "Create the job",
    short: "Set the client and your charge rate.",
    detail: "Projects keep hours, materials, expenses and invoices together, so every job has one clear history.",
    icon: FolderKanban
  },
  {
    key: "work",
    title: "Log the work",
    short: "Add hours and costs as you go.",
    detail: "Use Log Work from Home or open the project. Unbilled work stays visible until you include it on an invoice.",
    icon: Clock3
  },
  {
    key: "expenses",
    title: "Record expenses",
    short: "Keep project and business costs traceable.",
    detail: "Record what you paid, let the app calculate GST when applicable, and link the cost to a project when it belongs to a specific job.",
    icon: ReceiptText
  },
  {
    key: "invoice",
    title: "Create the invoice",
    short: "Turn unbilled work into a reviewed draft.",
    detail: "Choose a date range, import eligible hours and expenses, verify GST and totals, then inspect the generated PDF before sending anything.",
    icon: FileText
  },
  {
    key: "payment",
    title: "Track payment",
    short: "Follow sent invoices through to paid.",
    detail: "Invoice status drives outstanding and overdue totals. Mark payment only after confirming it, and use reversals when a status was entered incorrectly.",
    icon: WalletCards
  },
  {
    key: "insights",
    title: "Review the business",
    short: "Use your records to see trends and gaps.",
    detail: "Insights combines time, invoices, payments, expenses and wages into workload and financial signals. Planning estimates are guidance, not tax advice.",
    icon: BarChart3
  }
] as const;

export function OnboardingWizard({ initialValues }: { initialValues: InitialValues }) {
  const [businessStructure, setBusinessStructure] = useState<BusinessStructure | null>(initialValues.businessStructure);
  const [tradingName, setTradingName] = useState(initialValues.tradingName);
  const [contactName, setContactName] = useState(initialValues.contactName);
  const [defaultHourlyRate, setDefaultHourlyRate] = useState(initialValues.defaultHourlyRate);
  const [paymentTermsDays, setPaymentTermsDays] = useState(String(initialValues.paymentTermsDays));
  const [gstRegistered, setGstRegistered] = useState(initialValues.gstRegistered);
  const [invoicePrefix, setInvoicePrefix] = useState(initialValues.invoicePrefix);
  const [activeWorkflow, setActiveWorkflow] = useState<(typeof workflowItems)[number]["key"]>("client");
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState("");

  const steps: StepKey[] = businessStructure === "EMPLOYER"
    ? ["structure", "details", "workflow", "team", "ready"]
    : ["structure", "details", "workflow", "ready"];
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const progress = ((stepIndex + 1) / steps.length) * 100;
  const selectedWorkflow = workflowItems.find((item) => item.key === activeWorkflow) ?? workflowItems[0];
  const SelectedWorkflowIcon = selectedWorkflow.icon;

  function next() {
    setError("");
    if (step === "structure" && !businessStructure) {
      setError("Choose the setup that best describes your business.");
      return;
    }
    if (step === "details") {
      if (!tradingName.trim() || !contactName.trim()) {
        setError("Add your business name and your name to continue.");
        return;
      }
      if (!Number.isFinite(Number(defaultHourlyRate)) || Number(defaultHourlyRate) <= 0) {
        setError("Add your usual hourly charge rate to continue.");
        return;
      }
      const terms = Number(paymentTermsDays);
      if (!Number.isInteger(terms) || terms < 1 || terms > 90) {
        setError("Payment terms must be between 1 and 90 days.");
        return;
      }
      if (!invoicePrefix.trim()) {
        setError("Add an invoice prefix to continue.");
        return;
      }
    }
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  return (
    <form action={saveOnboardingSetupAction} className="mx-auto w-full max-w-3xl">
      <input type="hidden" name="businessStructure" value={businessStructure ?? ""} />
      <input type="hidden" name="tradingName" value={tradingName} />
      <input type="hidden" name="contactName" value={contactName} />
      <input type="hidden" name="defaultHourlyRate" value={defaultHourlyRate} />
      <input type="hidden" name="paymentTermsDays" value={paymentTermsDays} />
      <input type="hidden" name="gstRegistered" value={gstRegistered ? "on" : ""} />
      <input type="hidden" name="invoicePrefix" value={invoicePrefix} />

      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-moss">Step {stepIndex + 1} of {steps.length}</p>
          <p className="mt-1 text-xs font-semibold text-moss">About 2 minutes</p>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-line sm:w-64" aria-label={`${Math.round(progress)}% complete`}>
          <div className="h-full rounded-full bg-mint transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-lift">
        <div className="p-5 sm:p-8">
          {step === "structure" ? (
            <div>
              <p className="section-title">Your setup</p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">How do you work?</h1>
              <p className="mt-2 text-sm font-medium leading-6 text-moss">This keeps your workspace relevant and decides whether team setup is included.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <ChoiceCard
                  selected={businessStructure === "SOLE_TRADER"}
                  icon={UserRound}
                  title="I work for myself"
                  body="Sole trader or independent contractor. Keep the focus on your clients, jobs, hours and invoices."
                  onClick={() => setBusinessStructure("SOLE_TRADER")}
                />
                <ChoiceCard
                  selected={businessStructure === "EMPLOYER"}
                  icon={UsersRound}
                  title="People work for me"
                  body="You use subcontractors or employees and need project assignments, their hours, billing and wage tracking."
                  onClick={() => setBusinessStructure("EMPLOYER")}
                />
              </div>
            </div>
          ) : null}

          {step === "details" ? (
            <div>
              <p className="section-title">Invoice basics</p>
              <h1 className="mt-2 text-3xl font-black">Set up your business</h1>
              <p className="mt-2 text-sm font-medium leading-6 text-moss">Only the essentials for now. Payment details, logo and invoice wording can be added later.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">Business or trading name<input value={tradingName} onChange={(event) => setTradingName(event.target.value)} autoComplete="organization" /></label>
                <label>Your name<input value={contactName} onChange={(event) => setContactName(event.target.value)} autoComplete="name" /></label>
                <label>Usual hourly charge<input value={defaultHourlyRate} onChange={(event) => setDefaultHourlyRate(event.target.value)} type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="95.00" /></label>
                <label>Invoice prefix<input value={invoicePrefix} onChange={(event) => setInvoicePrefix(event.target.value)} maxLength={16} placeholder="INV-" /></label>
                <label>Payment terms<input value={paymentTermsDays} onChange={(event) => setPaymentTermsDays(event.target.value)} type="number" min="1" max="90" inputMode="numeric" /></label>
                <label className="sm:col-span-2 flex min-h-14 grid-cols-none flex-row items-center gap-3 rounded-xl border border-line bg-paper/40 px-4">
                  <input className="size-5 min-h-0 w-auto" type="checkbox" checked={gstRegistered} onChange={(event) => setGstRegistered(event.target.checked)} />
                  <span><strong className="block text-ink">I am registered for GST</strong><span className="mt-0.5 block text-xs font-medium text-moss">Invoices will calculate GST using your business profile settings.</span></span>
                </label>
              </div>
            </div>
          ) : null}

          {step === "workflow" ? (
            <div>
              <p className="section-title">The everyday flow</p>
              <h1 className="mt-2 text-3xl font-black">From job to paid</h1>
              <p className="mt-2 text-sm font-medium leading-6 text-moss">Tap each stage to see how the pieces stay connected.</p>
              <div className="mt-6 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                <div className="grid gap-2">
                  {workflowItems.map((item, index) => {
                    const Icon = item.icon;
                    const selected = activeWorkflow === item.key;
                    return (
                      <button key={item.key} type="button" onClick={() => setActiveWorkflow(item.key)} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-mint bg-mint/10" : "border-line bg-white hover:border-mint/40"}`}>
                        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${selected ? "bg-mint text-white" : "bg-paper text-moss"}`}><Icon size={18} aria-hidden="true" /></span>
                        <span><span className="block text-sm font-black text-ink">{index + 1}. {item.title}</span><span className="mt-0.5 block text-xs font-medium text-moss">{item.short}</span></span>
                      </button>
                    );
                  })}
                </div>
                <div className="rounded-xl border border-mint/20 bg-paper/60 p-5">
                  <span className="grid size-11 place-items-center rounded-xl bg-ink text-white"><SelectedWorkflowIcon size={21} aria-hidden="true" /></span>
                  <h2 className="mt-4 text-xl font-black">{selectedWorkflow.title}</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-moss">{selectedWorkflow.detail}</p>
                </div>
              </div>
            </div>
          ) : null}

          {step === "team" ? (
            <div>
              <p className="section-title">Team workflow</p>
              <h1 className="mt-2 text-3xl font-black">Keep their hours traceable</h1>
              <p className="mt-2 text-sm font-medium leading-6 text-moss">Your team uses the same simple logging flow while you retain control of jobs, charge rates and payments.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <GuideCard number="1" title="Invite" body="Create a linking code in Team. They sign up with their own login and join your workspace." />
                <GuideCard number="2" title="Assign" body="Choose the project, their hourly pay rate and the hourly rate you charge the client." />
                <GuideCard number="3" title="Track" body="Their hours appear on your project and invoice, then remain visible until you record their wage payment." />
              </div>
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-mint/20 bg-mint/10 p-4 text-sm font-semibold leading-6 text-moss">
                <Check className="mt-0.5 shrink-0 text-mint" size={19} aria-hidden="true" />
                Team members cannot edit your project setup. They can view assigned jobs and log their own hours from Home or Projects.
              </div>
            </div>
          ) : null}

          {step === "ready" ? (
            <div className="text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-mint text-white shadow-soft"><Check size={28} aria-hidden="true" /></span>
              <p className="section-title mt-5">Guided first job</p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">Now do it for real</h1>
              <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-6 text-moss">We will guide you through a real client, job, time entry and invoice draft. Setup only finishes after you have completed each step yourself.</p>
              <div className="mx-auto mt-6 grid max-w-lg gap-2 text-left">
                <ReadyLine icon={UserRound} text="Add your first client" />
                <ReadyLine icon={FolderKanban} text="Create their first project" />
                <ReadyLine icon={Clock3} text="Log work as it happens" />
                <ReadyLine icon={ReceiptText} text="Invoice everything still marked unbilled" />
                {businessStructure === "EMPLOYER" ? <ReadyLine icon={UsersRound} text="Open Team to invite and assign your people" /> : null}
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-5 rounded-xl border border-gum/30 bg-gum/10 p-3 text-sm font-bold text-gum" role="alert">{error}</p> : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-paper/50 p-4 sm:px-8 sm:py-5">
          <button type="button" className="tap-secondary" onClick={() => { setError(""); setStepIndex((current) => Math.max(0, current - 1)); }} disabled={stepIndex === 0}>
            <ArrowLeft size={18} aria-hidden="true" />Back
          </button>
          {step === "ready" ? (
            <SubmitButton className="tap-primary" pendingLabel="Starting guide...">Start guided setup<ArrowRight size={18} aria-hidden="true" /></SubmitButton>
          ) : (
            <button type="button" className="tap-primary" onClick={next}>Continue<ArrowRight size={18} aria-hidden="true" /></button>
          )}
        </div>
      </section>
    </form>
  );
}

function ChoiceCard({ selected, icon: Icon, title, body, onClick }: { selected: boolean; icon: typeof BriefcaseBusiness; title: string; body: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`relative min-h-52 rounded-2xl border p-5 text-left transition ${selected ? "border-mint bg-mint/10 ring-2 ring-mint/15" : "border-line bg-white hover:border-mint/40 hover:shadow-soft"}`}>
      {selected ? <span className="absolute right-4 top-4 grid size-7 place-items-center rounded-full bg-mint text-white"><Check size={16} aria-hidden="true" /></span> : null}
      <span className={`grid size-12 place-items-center rounded-xl ${selected ? "bg-mint text-white" : "bg-paper text-moss"}`}><Icon size={23} aria-hidden="true" /></span>
      <span className="mt-5 block text-xl font-black text-ink">{title}</span>
      <span className="mt-2 block text-sm font-medium leading-6 text-moss">{body}</span>
    </button>
  );
}

function GuideCard({ number, title, body }: { number: string; title: string; body: string }) {
  return <article className="rounded-xl border border-line bg-paper/50 p-4"><span className="grid size-8 place-items-center rounded-lg bg-ink text-sm font-black text-white">{number}</span><h2 className="mt-4 text-lg font-black">{title}</h2><p className="mt-2 text-sm font-medium leading-6 text-moss">{body}</p></article>;
}

function ReadyLine({ icon: Icon, text }: { icon: typeof BriefcaseBusiness; text: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-line bg-paper/50 p-3"><span className="grid size-9 place-items-center rounded-lg bg-white text-mint"><Icon size={18} aria-hidden="true" /></span><span className="text-sm font-bold text-ink">{text}</span></div>;
}
