"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
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

export function ActionForm({ action, children, onSubmit, ...props }: ActionFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FormActionResult>({});
  const busy = useRef(false);
  const alert = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (feedback.error) alert.current?.focus();
  }, [feedback]);

  function submit(event: Parameters<NonNullable<ComponentProps<"form">["onSubmit"]>>[0]) {
    onSubmit?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (busy.current) return;
    if (!navigator.onLine) {
      setFeedback({ error: "You're offline. Your details are still here. Reconnect before saving." });
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    busy.current = true;
    setFeedback({});
    // Manual dispatch preserves uncontrolled inputs after a validation failure.
    startTransition(async () => {
      try {
        const result = await action(data);
        setFeedback(result ?? { success: true });
        if (!result?.error) router.refresh();
      } catch {
        setFeedback({ error: "We couldn't complete that request. Check your connection and try again. Your details are still here." });
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <FormPendingContext.Provider value={pending}>
      <form {...props} onSubmit={submit} aria-busy={pending}>
        {feedback.error ? (
          <p ref={alert} tabIndex={-1} role="alert" className="col-span-full rounded-lg border border-gum/30 bg-gum/10 p-3 text-sm font-semibold text-gum">
            {feedback.error}
          </p>
        ) : feedback.success ? (
          <p role="status" className="col-span-full text-sm font-semibold text-mint">Changes saved.</p>
        ) : null}
        {children}
      </form>
    </FormPendingContext.Provider>
  );
}
