"use client";

import { useState } from "react";
import { Mail, MessageSquare } from "lucide-react";
import { sendInvoiceEmailAction, sendInvoiceSmsAction } from "@/app/actions";

export function EmailInvoiceButton({
  invoiceId,
  disabledReason,
  smsDisabledReason,
  className = "tap-primary w-full"
}: {
  invoiceId: string;
  disabledReason?: string;
  smsDisabledReason?: string;
  className?: string;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);

  function emailInvoice() {
    setMessage("");
    setError("");
    if (disabledReason) {
      setError(disabledReason);
      return;
    }

    setIsPreparing(true);

    const formData = new FormData();
    formData.set("invoiceId", invoiceId);
    sendInvoiceEmailAction(formData)
      .then((result) => setMessage(result.message))
      .catch((emailError) => setError(emailError instanceof Error ? emailError.message : "Invoice email could not be sent."))
      .finally(() => setIsPreparing(false));
  }

  function smsInvoice() {
    setMessage("");
    setError("");
    if (smsDisabledReason) {
      setError(smsDisabledReason);
      return;
    }

    setIsPreparing(true);

    const formData = new FormData();
    formData.set("invoiceId", invoiceId);
    sendInvoiceSmsAction(formData)
      .then((result) => setMessage(result.message))
      .catch((smsError) => setError(smsError instanceof Error ? smsError.message : "Invoice SMS/MMS could not be sent."))
      .finally(() => setIsPreparing(false));
  }

  return (
    <div className="grid gap-2">
      <button className={className} type="button" onClick={emailInvoice} disabled={Boolean(disabledReason) || isPreparing}>
        <Mail size={20} aria-hidden="true" />
        {isPreparing ? "Preparing..." : "Email Invoice"}
      </button>
      <button className="tap-secondary w-full" type="button" onClick={smsInvoice} disabled={Boolean(smsDisabledReason) || isPreparing}>
        <MessageSquare size={20} aria-hidden="true" />
        {isPreparing ? "Preparing..." : "SMS Invoice"}
      </button>
      {disabledReason ? <p className="text-xs font-bold leading-5 text-moss">{disabledReason}</p> : null}
      {smsDisabledReason ? <p className="text-xs font-bold leading-5 text-moss">{smsDisabledReason}</p> : null}
      {message ? <p className="rounded-lg border border-mint/30 bg-mint/10 p-3 text-xs font-bold leading-5 text-moss">{message}</p> : null}
      {error ? <p className="rounded-lg border border-gum/30 bg-gum/10 p-3 text-xs font-bold leading-5 text-gum">{error}</p> : null}
    </div>
  );
}
