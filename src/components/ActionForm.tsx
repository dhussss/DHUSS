"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useState, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { unstable_rethrow, useRouter } from "next/navigation";
import type { FormActionResult } from "@/lib/form-feedback";

const FormPendingContext = createContext(false);

export function useActionPending() {
  const native = useFormStatus();
  const pending = useContext(FormPendingContext);
  return native.pending || pending;
}

type ActionFormProps = Omit<ComponentProps<"form">, "action"> & {
  action: (data: FormData) => Promise<FormActionResult | void>;
};

export function ActionForm({ action, children, onSubmit, onReset, ...props }: ActionFormProps) {
  const router = useRouter();
  const [connectionError, setConnectionError] = useState("");
  const [finishing, setFinishing] = useState(false);
  const busy = useRef(false);
  const alert = useRef<HTMLParagraphElement>(null);
  const handledFeedback = useRef<FormActionResult | null>(null);
  const [feedback, dispatch, pending] = useActionState(async (_previous: FormActionResult, data: FormData): Promise<FormActionResult> => {
    try {
      return await action(data) ?? { success: true };
    } catch (error) {
      unstable_rethrow(error);
      return { error: "We couldn't complete that request. Check your connection and try again. Your details are still here." };
    }
  }, {});
  const effectivePending = pending || finishing;
  const errorMessage = connectionError || feedback.error;

  useEffect(() => {
    if (pending || handledFeedback.current === feedback || (!feedback.error && !feedback.success)) return;
    handledFeedback.current = feedback;

    if (feedback.error) {
      busy.current = false;
      setFinishing(false);
      return;
    }

    async function finishSubmission() {
      try {
        if (feedback.revalidation && (feedback.revalidation.paths.length > 0 || feedback.revalidation.tags.length > 0)) {
          await fetch("/api/revalidate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(feedback.revalidation)
          });
        }
      } catch {
        // The short cache expiry is a safe fallback when explicit invalidation is unavailable.
      }
      if (feedback.redirectTo) {
        if (feedback.redirectType === "replace") window.location.replace(feedback.redirectTo);
        else window.location.assign(feedback.redirectTo);
      } else {
        router.refresh();
      }
      busy.current = false;
      setFinishing(false);
    }

    void finishSubmission();
  }, [feedback, pending, router]);

  useEffect(() => {
    if (errorMessage) alert.current?.focus();
  }, [errorMessage, feedback]);

  function submit(event: Parameters<NonNullable<ComponentProps<"form">["onSubmit"]>>[0]) {
    onSubmit?.(event);
    if (event.defaultPrevented) return;
    if (busy.current) {
      event.preventDefault();
      return;
    }
    if (!navigator.onLine) {
      event.preventDefault();
      setConnectionError("You're offline. Your details are still here. Reconnect before saving.");
      return;
    }

    busy.current = true;
    setFinishing(true);
    setConnectionError("");
  }

  return (
    <FormPendingContext.Provider value={effectivePending}>
      <form {...props} action={dispatch} onSubmit={submit} onReset={(event) => {
        // Keep entered details when a handled server validation error resolves the action.
        event.preventDefault();
        onReset?.(event);
      }} aria-busy={effectivePending}>
        {!effectivePending && errorMessage ? (
          <p ref={alert} tabIndex={-1} role="alert" className="col-span-full rounded-lg border border-gum/30 bg-gum/10 p-3 text-sm font-semibold text-gum">
            {errorMessage}
          </p>
        ) : !effectivePending && feedback.success ? (
          <p role="status" className="col-span-full text-sm font-semibold text-mint">Changes saved.</p>
        ) : null}
        {children}
      </form>
    </FormPendingContext.Provider>
  );
}
