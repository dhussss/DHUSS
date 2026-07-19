"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  className,
  children,
  pendingLabel = "Saving...",
  disabled,
  name,
  value
}: {
  className: string;
  children: ReactNode;
  pendingLabel?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" disabled={disabled || pending} aria-busy={pending} name={name} value={value}>
      {pending ? pendingLabel : children}
    </button>
  );
}
