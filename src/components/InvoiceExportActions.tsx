"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Clipboard, Printer } from "lucide-react";

export function InvoiceExportActions({ invoiceText }: { invoiceText: string }) {
  const [message, setMessage] = useState("");

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage("Copy failed. Select and copy the invoice text manually.");
    }
  }

  return (
    <div className="grid gap-2">
      {message ? <p className="rounded-lg border border-mint/30 bg-mint/10 p-2 text-xs font-bold text-moss">{message}</p> : null}
      <button className="tap-secondary w-full" type="button" onClick={() => window.print()}>
        <Printer size={20} aria-hidden="true" />
        Print / Save PDF
      </button>
      <button className="tap-secondary w-full" type="button" onClick={() => copy("Invoice text", invoiceText)}>
        <Clipboard size={20} aria-hidden="true" />
        Copy Invoice Text
      </button>
    </div>
  );
}

export function CopyTextButton({
  value,
  label,
  copiedLabel,
  className = "tap-secondary w-full",
  children
}: {
  value: string;
  label: string;
  copiedLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(copiedLabel ?? `${label} copied.`);
    } catch {
      setMessage("Copy failed.");
    }
  }

  return (
    <span className="grid gap-1">
      <button className={className} type="button" onClick={copy}>
        {children}
      </button>
      {message ? <span className="text-xs font-bold text-moss">{message}</span> : null}
    </span>
  );
}
