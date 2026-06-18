"use client";

import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";

export function ConfirmSubmitButton({
  message,
  className,
  disabled,
  children
}: {
  message: string;
  className: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      className={className}
      type="submit"
      disabled={disabled}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      <Trash2 size={20} aria-hidden="true" />
      {children}
    </button>
  );
}
