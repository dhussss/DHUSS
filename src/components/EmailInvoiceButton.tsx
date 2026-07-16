"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, MessageSquare } from "lucide-react";
import { sendInvoiceSmsAction } from "@/app/actions";

export function EmailInvoiceButton({
  invoiceId,
  invoiceStatus,
  confirmIncomplete,
  disabledReason,
  smsDisabledReason,
  className = "tap-primary w-full"
}: {
  invoiceId: string;
  invoiceStatus: string;
  confirmIncomplete: boolean;
  disabledReason?: string;
  smsDisabledReason?: string;
  className?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);
  const [hasDelivered, setHasDelivered] = useState(false);
  const [hasWarning, setHasWarning] = useState(false);

  function smsInvoice() {
    setMessage("");
    setError("");
    setHasWarning(false);
    if (smsDisabledReason) {
      setError(smsDisabledReason);
      return;
    }
    const statusNote = invoiceStatus === "DRAFT" ? " It will also be marked sent and its work recorded as billed." : "";
    if (!window.confirm(`Send this invoice by SMS/MMS now?${statusNote}`)) return;

    setIsPreparing(true);

    const formData = new FormData();
    formData.set("invoiceId", invoiceId);
    if (confirmIncomplete) formData.set("confirmIncomplete", "on");
    sendInvoiceSmsAction(formData)
      .then((result) => {
        setMessage(result.message);
        setHasWarning(Boolean(result.warning));
        setHasDelivered(true);
        router.refresh();
      })
      .catch((smsError) => setError(smsError instanceof Error ? smsError.message : "Invoice SMS/MMS could not be sent."))
      .finally(() => setIsPreparing(false));
  }

  return (
    <div className="grid gap-2">
      {disabledReason ? (
        <button className={className} type="button" disabled>
          <Mail size={20} aria-hidden="true" />
          Email Invoice
        </button>
      ) : (
        <Link className={className} href={`/invoices/${invoiceId}/email`}>
          <Mail size={20} aria-hidden="true" />
          Review & Email Invoice
        </Link>
      )}
      <button className="tap-secondary w-full" type="button" onClick={smsInvoice} disabled={Boolean(smsDisabledReason) || isPreparing || hasDelivered}>
        <MessageSquare size={20} aria-hidden="true" />
        {isPreparing ? "Sending..." : hasDelivered ? "SMS accepted" : "SMS Invoice"}
      </button>
      {disabledReason ? <p className="text-xs font-bold leading-5 text-moss">{disabledReason}</p> : null}
      {smsDisabledReason ? <p className="text-xs font-bold leading-5 text-moss">{smsDisabledReason}</p> : null}
      {message ? (
        <p className={`rounded-lg border p-3 text-xs font-bold leading-5 ${hasWarning ? "border-gum/30 bg-gum/10 text-gum" : "border-mint/30 bg-mint/10 text-moss"}`}>
          {message}
        </p>
      ) : null}
      {error ? <p className="rounded-lg border border-gum/30 bg-gum/10 p-3 text-xs font-bold leading-5 text-gum">{error}</p> : null}
    </div>
  );
}
