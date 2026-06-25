"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { createClientAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ClientCreateForm() {
  const [error, setError] = useState("");

  function validateSubmit(event: FormEvent<HTMLFormElement>) {
    setError("");
    const formData = new FormData(event.currentTarget);
    const businessName = String(formData.get("businessName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();

    if (!businessName) {
      event.preventDefault();
      setError("Business name is required.");
      return;
    }

    if (email && !EMAIL_RE.test(email)) {
      event.preventDefault();
      setError("Enter a valid email address.");
    }
  }

  return (
    <form action={createClientAction} onSubmit={validateSubmit} noValidate className="grid gap-5">
      {error ? (
        <p className="rounded-lg border border-gum/30 bg-gum/10 p-3 text-sm font-bold text-gum" role="alert">
          {error}
        </p>
      ) : null}

      <label>
        Company/entity name
        <input name="businessName" placeholder="Client business or person" required />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Contact name
          <input name="contactName" />
        </label>
        <label>
          Email
          <input name="email" type="email" inputMode="email" />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" />
        </label>
        <label>
          ABN
          <input name="abn" />
        </label>
      </div>

      <label>
        Address
        <textarea name="address" rows={4} />
      </label>

      <label>
        Notes
        <textarea name="notes" rows={4} />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <Link href="/clients" className="tap-secondary w-full">
          <ArrowLeft size={20} aria-hidden="true" />
          Cancel
        </Link>
        <SubmitButton className="tap-primary w-full" pendingLabel="Saving client...">
          <Save size={20} aria-hidden="true" />
          Save Client
        </SubmitButton>
      </div>
    </form>
  );
}
