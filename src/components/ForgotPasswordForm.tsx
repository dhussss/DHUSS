"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

export function ForgotPasswordForm({ initialError = "" }: { initialError?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`
    });

    setPending(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="grid gap-4">
        <p className="rounded-xl border border-mint/25 bg-mint/10 p-4 text-sm font-semibold leading-6 text-ink">
          Check your email for a password reset link. It may take a minute to arrive.
        </p>
        <Link href="/login" className="tap-secondary">Back to Login</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label>
        Account email
        <input name="email" type="email" autoComplete="email" required autoFocus />
      </label>
      {error ? <p className="rounded-lg border border-gum/30 bg-gum/10 p-3 text-sm font-bold text-gum">{error}</p> : null}
      <button className="tap-primary" type="submit" disabled={pending} aria-busy={pending}>
        <Mail size={20} aria-hidden="true" />
        {pending ? "Sending link..." : "Send Reset Link"}
      </button>
      <Link href="/login" className="text-center text-sm font-bold text-mint">Back to login</Link>
    </form>
  );
}
