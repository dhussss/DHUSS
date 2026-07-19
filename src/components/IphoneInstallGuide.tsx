"use client";

import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Share, Smartphone, X } from "lucide-react";

const STORAGE_KEY = "trade-invoice-tracker:iphone-install-guide:v1";

const steps = [
  {
    title: "Tap the Share button",
    body: "In your iPhone browser, tap the square with the upward arrow. It is usually in the toolbar at the bottom of Safari.",
    image: "/guides/iphone-install-share.png",
    alt: "Illustration showing the Share button in the iPhone browser toolbar"
  },
  {
    title: "Choose Add to Home Screen",
    body: "Scroll through the Share menu and tap Add to Home Screen. If it is missing, open this page in Safari and try again.",
    image: "/guides/iphone-install-menu.png",
    alt: "Illustration showing Add to Home Screen highlighted in the iPhone Share menu"
  },
  {
    title: "Confirm by tapping Add",
    body: "Keep the app name as Trade Invoice Tracker, then tap Add in the top-right corner.",
    image: "/guides/iphone-install-confirm.png",
    alt: "Illustration showing the Add to Home Screen confirmation with the Add button highlighted"
  },
  {
    title: "Open it like a normal app",
    body: "The new icon appears on your Home Screen. From then on, launch Trade Invoice Tracker from that icon for the cleanest full-screen experience.",
    image: "/guides/iphone-install-launch.png",
    alt: "Illustration showing Trade Invoice Tracker installed on an iPhone Home Screen"
  }
] as const;

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function isAppleMobileDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isRunningStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as NavigatorWithStandalone).standalone);
}

function hasSeenGuide() {
  try {
    return Boolean(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

function rememberGuide(value: "dismissed" | "completed") {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Installation guidance still works when storage is unavailable.
  }
}

export function IphoneInstallGuide() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get("install") === "iphone";
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const closeGuide = useCallback((result: "dismissed" | "completed") => {
    rememberGuide(result);
    setOpen(false);

    if (requested) {
      const url = new URL(window.location.href);
      url.searchParams.delete("install");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [requested]);

  useEffect(() => {
    if (requested) {
      setStep(0);
      setOpen(true);
      return;
    }

    const isPublicInvoice = pathname.startsWith("/public/");
    if (!isPublicInvoice && isAppleMobileDevice() && !isRunningStandalone() && !hasSeenGuide()) {
      setStep(0);
      setOpen(true);
    }
  }, [pathname, requested]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeGuide("dismissed");
      if (event.key === "ArrowRight") setStep((current) => Math.min(current + 1, steps.length - 1));
      if (event.key === "ArrowLeft") setStep((current) => Math.max(current - 1, 0));
      if (event.key === "Tab") {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ) ?? []
        );
        const first = focusable[0];
        const last = focusable.at(-1);

        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [closeGuide, open]);

  if (!open) return null;

  const current = steps[step];
  const isLastStep = step === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end bg-ink/50 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeGuide("dismissed");
      }}
    >
      <section
        ref={dialogRef}
        className="flex max-h-[96dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-xl border border-line bg-white shadow-lift sm:max-h-[92vh] sm:rounded-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="iphone-install-title"
        aria-describedby="iphone-install-description"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-mint">
              <Smartphone size={18} aria-hidden="true" />
              <p className="section-title">Add to your iPhone</p>
            </div>
            <h2 id="iphone-install-title" className="mt-1 text-2xl font-semibold text-ink">Keep the app one tap away</h2>
            <p id="iphone-install-description" className="mt-1 text-sm font-medium leading-6 text-moss">Four quick steps. No App Store required.</p>
          </div>
          <button ref={closeButtonRef} type="button" className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-white" onClick={() => closeGuide("dismissed")} aria-label="Close iPhone installation guide">
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            Step {step + 1} of {steps.length}: {current.title}. {current.body}
          </p>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-moss">Step {step + 1} of {steps.length}</p>
            <div className="flex gap-1.5" aria-hidden="true">
              {steps.map((item, index) => <span key={item.title} className={`h-1.5 w-8 rounded-full ${index <= step ? "bg-mint" : "bg-line"}`} />)}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-line bg-paper">
            <Image key={current.image} src={current.image} alt={current.alt} width={1200} height={700} sizes="(max-width: 640px) 100vw, 560px" className="h-auto w-full motion-safe:animate-[fadeIn_220ms_ease-out]" priority={step === 0} unoptimized />
          </div>

          <div className="mt-5 flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-mint text-sm font-bold text-white">{step + 1}</span>
            <div>
              <h3 className="text-xl font-semibold text-ink">{current.title}</h3>
              <p className="mt-1 text-sm font-medium leading-6 text-moss">{current.body}</p>
            </div>
          </div>

          {step === 0 ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-mint/20 bg-mint/[0.06] p-3 text-sm font-medium text-moss">
              <Share className="shrink-0 text-mint" size={18} aria-hidden="true" />
              Installing gives you a full-screen app icon without changing your account or data.
            </div>
          ) : null}
        </div>

        <footer className="grid grid-cols-2 gap-2 border-t border-line bg-paper/60 p-3 sm:p-4">
          {step === 0 ? (
            <button type="button" className="tap-secondary" onClick={() => closeGuide("dismissed")}>Not now</button>
          ) : (
            <button type="button" className="tap-secondary" onClick={() => setStep((currentStep) => Math.max(currentStep - 1, 0))}><ArrowLeft size={17} aria-hidden="true" />Back</button>
          )}
          {isLastStep ? (
            <button type="button" className="tap-primary" onClick={() => closeGuide("completed")}><Check size={17} aria-hidden="true" />Done</button>
          ) : (
            <button type="button" className="tap-primary" onClick={() => setStep((currentStep) => Math.min(currentStep + 1, steps.length - 1))}>Next<ArrowRight size={17} aria-hidden="true" /></button>
          )}
        </footer>
      </section>
    </div>
  );
}
