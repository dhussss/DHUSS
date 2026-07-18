import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LifeBuoy, Mail, ShieldCheck } from "lucide-react";
import { PublicFooter } from "@/components/PublicFooter";
import { platform } from "@/lib/platform";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <main className="page-shell">
      <header className="page-header max-w-3xl">
        <p className="section-title">{platform.name}</p>
        <h1 className="page-title">Support and product help</h1>
        <p className="page-subtitle">Help with accounts, invoices, data access, and service issues.</p>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="card">
          <LifeBuoy size={22} className="text-mint" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold">Using the product</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-moss">Signed-in users can open Tutorials under More for guided client, project, work, invoice, expense, and team workflows.</p>
        </article>
        <article className="card">
          <Mail size={22} className="text-mint" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold">Contact support</h2>
          {platform.supportEmail ? (
            <a className="mt-3 inline-flex font-bold text-mint" href={`mailto:${platform.supportEmail}`}>{platform.supportEmail}</a>
          ) : (
            <p className="mt-2 text-sm font-medium leading-6 text-moss">A public support address is being finalised. During controlled beta, use the support channel provided with your invitation.</p>
          )}
        </article>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex gap-3">
          <ShieldCheck size={21} className="mt-0.5 shrink-0 text-mint" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-ink">When reporting a problem</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-moss">Include the page, approximate time, and any on-screen reference number. Do not send passwords, database URLs, bank credentials, or full client records.</p>
          </div>
        </div>
      </section>

      <Link href="/login" className="tap-secondary mt-6"><ArrowLeft size={18} aria-hidden="true" />Return to login</Link>
      <PublicFooter />
    </main>
  );
}
