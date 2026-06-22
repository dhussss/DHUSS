"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  className,
  children,
  pendingLabel = "Saving...",
  disabled
}: {
  className: string;
  children: ReactNode;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" disabled={disabled || pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
