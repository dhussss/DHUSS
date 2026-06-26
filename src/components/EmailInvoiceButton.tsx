"use client";

import { useState } from "react";
import { Mail, MessageSquare } from "lucide-react";
import { prepareInvoiceEmailAction, prepareInvoiceSmsAction } from "@/app/actions";

export function EmailInvoiceButton({
  invoiceId,
  pdfHref,
  pdfFileName,
  to,
  phone,
  subject,
  body,
  smsBody,
  disabledReason,
  smsDisabledReason,
  className = "tap-primary w-full"
}: {
  invoiceId: string;
  pdfHref: string;
  pdfFileName: string;
  to: string;
  phone: string;
  subject: string;
  body: string;
  smsBody: string;
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
    formData.set("to", to);
    formData.set("subject", subject);
    formData.set("message", body);
    prepareInvoiceEmailAction(formData).catch((emailError) => {
      setError(emailError instanceof Error ? emailError.message : "Invoice email could not be recorded.");
    });

    fetchInvoicePdf(pdfHref)
      .then((pdf) => {
        downloadBlob(pdf, pdfFileName);
        setMessage("Email opened with the client address, subject, and message filled in. The PDF has also downloaded for attaching if your mail app needs it.");
      })
      .catch(() => {
        setMessage("Email opened with the client address, subject, and message filled in. Use the invoice link in the message if the PDF did not download.");
      })
      .finally(() => setIsPreparing(false));

    window.location.href = mailtoUrl(to, subject, body);
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
    formData.set("phone", phone);
    formData.set("message", smsBody);
    prepareInvoiceSmsAction(formData)
      .then(() => setMessage("SMS opened with the client phone number and invoice message filled in."))
      .catch((smsError) => setError(smsError instanceof Error ? smsError.message : "Invoice SMS could not be recorded."))
      .finally(() => setIsPreparing(false));

    window.location.href = smsUrl(phone, smsBody);
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

async function fetchInvoicePdf(pdfHref: string) {
  const response = await fetch(pdfHref, {
    credentials: "same-origin",
    headers: { Accept: "application/pdf" }
  });

  if (!response.ok) {
    throw new Error("PDF could not be generated.");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/pdf")) {
    throw new Error("PDF could not be generated.");
  }

  const blob = await response.blob();
  if (!blob.size) {
    throw new Error("PDF could not be generated.");
  }

  return blob;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function mailtoUrl(to: string, subject: string, body: string) {
  const recipients = to
    .split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean)
    .join(",");
  return `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function smsUrl(phone: string, body: string) {
  const recipient = phone.replace(/[^\d+]/g, "");
  const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? "&" : "?";
  return `sms:${recipient}${separator}body=${encodeURIComponent(body)}`;
}
