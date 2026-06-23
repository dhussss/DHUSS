"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";

export function ConfirmSubmitButton({
  message,
  className,
  disabled,
  pendingLabel = "Working...",
  children,
  showDefaultIcon = true
}: {
  message: string;
  className: string;
  disabled?: boolean;
  pendingLabel?: string;
  children: ReactNode;
  showDefaultIcon?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={className}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      {showDefaultIcon ? <Trash2 size={20} aria-hidden="true" /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}
