"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCcw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page-shell items-center justify-center">
      <section className="surface-panel w-full max-w-lg p-6 text-center sm:p-8">
        <span className="mx-auto grid size-12 place-items-center rounded-lg bg-gum/10 text-gum">
          <AlertTriangle size={24} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-ink">Something did not load</h1>
        <p className="mt-2 text-sm font-medium leading-6 text-moss">
          Your data has not been removed. Check your connection and try again.
        </p>
        {error.digest ? <p className="mt-2 text-xs font-semibold text-moss">Reference: {error.digest}</p> : null}
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" className="tap-primary" onClick={reset}>
            <RefreshCcw size={18} aria-hidden="true" /> Try Again
          </button>
          <Link href="/" className="tap-secondary">Return Home</Link>
        </div>
      </section>
    </main>
  );
}
