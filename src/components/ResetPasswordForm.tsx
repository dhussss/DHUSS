"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

export function ResetPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setPending(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setPending(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
  }

  if (saved) {
    return (
      <div className="grid gap-4">
        <p className="rounded-xl border border-mint/25 bg-mint/10 p-4 text-sm font-semibold leading-6 text-ink">
          Your password has been updated.
        </p>
        <Link href="/" className="tap-primary">Continue to Dashboard</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label>
        New password
        <input name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus />
      </label>
      <label>
        Confirm password
        <input name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      {error ? <p className="rounded-lg border border-gum/30 bg-gum/10 p-3 text-sm font-bold text-gum">{error}</p> : null}
      <button className="tap-primary" type="submit" disabled={pending} aria-busy={pending}>
        <KeyRound size={20} aria-hidden="true" />
        {pending ? "Updating password..." : "Update Password"}
      </button>
    </form>
  );
}
