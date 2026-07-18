import type { Metadata } from "next";
import Link from "next/link";
import { Download, ExternalLink, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { platform } from "@/lib/platform";

export const metadata: Metadata = { title: "Account and data" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <main className="page-shell">
      <header className="page-header"><p className="section-title">Account</p><h1 className="page-title">Your access and business data</h1><p className="page-subtitle">Download your records and understand the current account lifecycle.</p></header>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="card">
          <p className="section-title">Signed in as</p>
          <p className="mt-3 font-semibold text-ink">{user.email || "Authenticated user"}</p>
          <p className="mt-2 text-sm font-medium leading-6 text-moss">Your private records are selected using your authenticated account on the server. Business record identifiers are never accepted from this page.</p>
        </article>
        <article className="card">
          <p className="section-title">Data portability</p>
          <h2 className="mt-3 text-xl font-semibold">Download business data</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-moss">Creates a JSON export of your business profile, clients, projects, work, expenses, invoices, and team ledger. Public-link tokens and internal owner identifiers are excluded.</p>
          <a href="/account/data-export" className="tap-primary mt-5"><Download size={18} aria-hidden="true" />Download Export</a>
        </article>
      </section>

      <section className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-5">
        <div className="flex items-start gap-3"><ShieldAlert size={21} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" /><div><h2 className="font-semibold text-ink">Account and business deletion</h2><p className="mt-2 text-sm font-medium leading-6 text-moss">Automated deletion is intentionally unavailable while financial-record retention, team ownership, pending invoices, and file cleanup rules are being finalised. Contact support for a reviewed export and closure request.</p></div></div>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/support" className="tap-secondary"><ExternalLink size={18} aria-hidden="true" />Contact Support</Link>
        <Link href="/legal/privacy" className="tap-secondary">Privacy Summary</Link>
      </div>
      <p className="mt-6 text-xs font-semibold text-moss">{platform.name} does not silently transfer or delete business ownership.</p>
    </main>
  );
}
