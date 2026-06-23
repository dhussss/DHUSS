"use client";

import { useState, useTransition } from "react";
import { Clipboard, Mail } from "lucide-react";
import { prepareInvoiceEmailAction } from "@/app/actions";

export function EmailComposer({
  invoiceId,
  initialTo,
  initialSubject,
  initialBody,
  disabledReason
}: {
  invoiceId: string;
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

  return (
    <section className="card grid gap-4">
      {message ? <p className="rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm font-bold text-moss">{message}</p> : null}
      {error || disabledReason ? (
        <p className="rounded-lg border border-gum/30 bg-gum/10 p-3 text-sm font-bold text-gum">{error || disabledReason}</p>
      ) : null}

      <label>
        To
        <input value={to} onChange={(event) => setTo(event.target.value)} type="email" placeholder="client@example.com" required />
      </label>
      <label>
        Subject
        <input value={subject} onChange={(event) => setSubject(event.target.value)} required />
      </label>
      <label>
        Body
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={14} required />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <button className="tap-primary w-full" type="button" onClick={openEmailApp} disabled={Boolean(disabledReason) || isPending}>
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

      <p className="text-xs font-bold text-moss">
        This opens your own email app. Trade Invoice Tracker records that the email was prepared, but it cannot confirm whether you send it.
      </p>
    </section>
  );
}

function mailtoUrl(to: string, subject: string, body: string) {
  const recipients = to
    .split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean)
    .map(encodeURIComponent)
    .join(",");
  const params = new URLSearchParams({ subject, body });
  return `mailto:${recipients}?${params.toString()}`;
}
