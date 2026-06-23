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
            Edit the message here, then open it in your own email app.
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
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={16} required className="text-sm font-semibold leading-7 text-ink" />
          </label>
        </div>

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

        <p className="text-xs font-bold leading-5 text-moss">
          This opens your own email app. Trade Invoice Tracker records that the email was prepared, but it cannot confirm whether you send it.
        </p>
      </div>

      <article className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
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
          <div className="mx-auto max-w-2xl rounded-lg border border-line bg-white p-5 shadow-soft sm:p-7">
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
  return (
    <div className="grid gap-4 text-sm font-semibold leading-6 text-ink">
      {body.split(/\n{2,}/).map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        const isHeading = /^(Invoice Details|Payment Details|View Invoice Online:|Invoice Summary)$/i.test(trimmed);
        const isOnlineLink = trimmed.startsWith("View Invoice Online:");
        const isUrl = /^https?:\/\//.test(trimmed);

        if (isOnlineLink) {
          const link = trimmed.replace("View Invoice Online:", "").trim();
          return (
            <div key={`${trimmed}-${index}`} className="rounded-lg border border-mint/30 bg-mint/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-moss">View Invoice Online</p>
              <p className="mt-2 break-all text-sm font-black text-mint">{link}</p>
            </div>
          );
        }

        if (isHeading) {
          return (
            <h3 key={`${trimmed}-${index}`} className="mt-1 border-t border-line pt-4 text-xs font-black uppercase tracking-[0.16em] text-moss first:mt-0 first:border-t-0 first:pt-0">
              {trimmed}
            </h3>
          );
        }

        if (isUrl) {
          return (
            <p key={`${trimmed}-${index}`} className="rounded-lg border border-mint/30 bg-mint/10 p-3 font-black text-mint break-all">
              {trimmed}
            </p>
          );
        }

        return (
          <p key={`${trimmed}-${index}`} className="whitespace-pre-line">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}
