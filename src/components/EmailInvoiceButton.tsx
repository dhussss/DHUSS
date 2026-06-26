"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { prepareInvoiceEmailAction } from "@/app/actions";

export function EmailInvoiceButton({
  invoiceId,
  pdfHref,
  pdfFileName,
  to,
  subject,
  body,
  disabledReason,
  className = "tap-primary w-full"
}: {
  invoiceId: string;
  pdfHref: string;
  pdfFileName: string;
  to: string;
  subject: string;
  body: string;
  disabledReason?: string;
  className?: string;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState(disabledReason ?? "");
  const [isPending, startTransition] = useTransition();

  function emailInvoice() {
    setMessage("");
    setError(disabledReason ?? "");
    if (disabledReason) return;

    startTransition(async () => {
      try {
        const pdf = await fetchInvoicePdf(pdfHref);
        const file = new File([pdf], pdfFileName, { type: "application/pdf" });

        const formData = new FormData();
        formData.set("invoiceId", invoiceId);
        formData.set("to", to);
        formData.set("subject", subject);
        formData.set("message", body);
        await prepareInvoiceEmailAction(formData);

        if (canShareInvoiceFile(file)) {
          await navigator.share({
            files: [file],
            title: subject,
            text: body
          });
          setMessage("Invoice shared. Choose Mail, review the message, then send.");
          return;
        }

        downloadBlob(pdf, pdfFileName);
        window.location.href = mailtoUrl(to, subject, body);
        setMessage("Email opened and PDF downloaded. Attach the downloaded PDF before sending.");
      } catch (shareError) {
        if (isShareCancel(shareError)) return;
        setError(shareError instanceof Error ? shareError.message : "Invoice email could not be prepared.");
      }
    });
  }

  return (
    <div className="grid gap-2">
      <button className={className} type="button" onClick={emailInvoice} disabled={Boolean(disabledReason) || isPending}>
        <Mail size={20} aria-hidden="true" />
        {isPending ? "Preparing email..." : "Email Invoice"}
      </button>
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

function canShareInvoiceFile(file: File) {
  return Boolean(navigator.canShare?.({ files: [file] }));
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

function isShareCancel(error: unknown) {
  return error instanceof DOMException && (error.name === "AbortError" || error.name === "NotAllowedError");
}
