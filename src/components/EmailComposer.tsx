"use client";

import { useState, useTransition } from "react";
import { Clipboard, Download, Mail } from "lucide-react";
import { prepareInvoiceEmailAction } from "@/app/actions";

export function EmailComposer({
  invoiceId,
  pdfHref,
  pdfFileName,
  initialTo,
  initialSubject,
  initialBody,
  disabledReason
}: {
  invoiceId: string;
  pdfHref: string;
  pdfFileName: string;
  initialTo: string;
  initialSubject: string;
  initialBody: string;
  disabledReason?: string;
}) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPending, startTransition] = useTransition();

  function openEmailApp() {
    setError("");
    setMessage("");

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("invoiceId", invoiceId);
        formData.set("to", to);
        formData.set("subject", subject);
        formData.set("message", body);
        await prepareInvoiceEmailAction(formData);
        window.location.href = mailtoUrl(to, subject, body);
        setMessage("Email app opened. Send it from your mail app when ready.");
      } catch (openError) {
        setError(openError instanceof Error ? openError.message : "The email could not be prepared.");
      }
    });
  }

  async function copyEmailText() {
    setError("");
    setMessage("");
    try {
      await navigator.clipboard.writeText([`To: ${to}`, `Subject: ${subject}`, "", body].join("\n"));
      setMessage("Email text copied.");
    } catch {
      setError("Copy failed. Select the text and copy it manually.");
    }
  }

  async function downloadPdf() {
    setError("");
    setMessage("");
    setIsDownloading(true);

    try {
      const response = await fetch(pdfHref, {
        credentials: "same-origin",
        headers: { Accept: "application/pdf" }
      });

      if (!response.ok) {
        throw new Error("PDF download failed.");
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/pdf")) {
        throw new Error("PDF response was not a PDF.");
      }

      const blob = await response.blob();
      if (!blob.size) {
        throw new Error("PDF download was empty.");
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = pdfFileName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage("PDF downloaded. Attach it to your email before sending.");
    } catch {
      setError("PDF download failed. Go back to the invoice and use Print Preview as a fallback.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <section className="grid gap-4">
      {(message || error || disabledReason) ? (
        <div className="grid gap-2">
          {message ? <p className="rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm font-bold text-moss">{message}</p> : null}
          {error || disabledReason ? (
            <p className="rounded-lg border border-gum/30 bg-gum/10 p-3 text-sm font-bold text-gum">{error || disabledReason}</p>
          ) : null}
        </div>
      ) : null}

      <div className="card grid gap-4">
        <div>
          <p className="section-title">Prepare email</p>
          <h2 className="mt-1 text-2xl font-black tracking-normal text-ink">Review before opening your email app</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-moss">
            This will open in your email app as plain text. Download the PDF first, then attach it manually before sending.
          </p>
        </div>

        <div className="grid gap-4">
          <label>
            Recipient
            <input value={to} onChange={(event) => setTo(event.target.value)} type="email" placeholder="client@example.com" required />
          </label>
          <label>
            Subject
            <input value={subject} onChange={(event) => setSubject(event.target.value)} required />
          </label>
          <label>
            Message
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={12} required className="text-sm font-semibold leading-7 text-ink" />
          </label>
        </div>

        <div className="grid gap-2 lg:grid-cols-3">
          <button className="tap-primary w-full" type="button" onClick={downloadPdf} disabled={isDownloading}>
            <Download size={20} aria-hidden="true" />
            {isDownloading ? "Creating PDF..." : "Create PDF"}
          </button>
          <button className="tap-secondary w-full" type="button" onClick={openEmailApp} disabled={Boolean(disabledReason) || isPending}>
            {isPending ? (
              "Preparing..."
            ) : (
              <>
                <Mail size={20} aria-hidden="true" />
                Open Email App
              </>
            )}
          </button>
          <button className="tap-secondary w-full" type="button" onClick={copyEmailText}>
            <Clipboard size={20} aria-hidden="true" />
            Copy Email Text
          </button>
        </div>

        <p className="text-xs font-bold leading-5 text-moss">
          Browser email links cannot reliably attach PDFs automatically. Download the PDF, open your email app, attach it manually, then mark the invoice as sent after sending.
        </p>
      </div>

      <article className="surface-panel">
        <div className="border-b border-line bg-paper px-5 py-4">
          <p className="section-title">Prepared email preview</p>
          <div className="mt-3 grid gap-2 text-sm font-bold text-ink">
            <p>
              <span className="text-moss">To:</span> {to || "client@example.com"}
            </p>
            <p>
              <span className="text-moss">Subject:</span> {subject || "Invoice"}
            </p>
          </div>
        </div>
        <div className="bg-white px-5 py-6 sm:px-7">
          <div className="mx-auto max-w-2xl">
            <PreviewBody body={body} />
          </div>
        </div>
      </article>
    </section>
  );
}

function mailtoUrl(to: string, subject: string, body: string) {
  const recipients = to
    .split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean)
    .join(",");
  return `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function PreviewBody({ body }: { body: string }) {
  return <pre className="whitespace-pre-wrap break-words font-sans text-sm font-semibold leading-7 text-ink">{body}</pre>;
}
