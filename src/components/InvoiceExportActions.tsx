"use client";

import { useState } from "react";
import { Clipboard, Mail, Printer } from "lucide-react";

export function InvoiceExportActions({
  invoiceText,
  emailText
}: {
  invoiceText: string;
  emailText: string;
}) {
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
      <button className="tap-secondary w-full" type="button" onClick={() => copy("Email text", emailText)}>
        <Mail size={20} aria-hidden="true" />
        Copy Email Text
      </button>
    </div>
  );
}
