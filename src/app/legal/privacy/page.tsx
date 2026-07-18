import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PublicFooter } from "@/components/PublicFooter";
import { platform } from "@/lib/platform";

export const metadata: Metadata = { title: "Privacy" };

const sections = [
  ["Information used", "The service stores account, business, client, project, work, expense, team, invoice, payment-status, and communication information needed to provide its features."],
  ["How it is used", "Information is used to authenticate users, operate business workflows, generate documents, deliver communications you request, secure the service, and diagnose failures."],
  ["Business separation", "Application queries are scoped to the authenticated business owner. Assigned workers receive limited access to projects shared with them. Public invoice links use high-entropy tokens and can be disabled."],
  ["Service providers", "Hosting, authentication, database, storage, email, and messaging providers process information on behalf of the service. The final public provider list and retention schedule require formal publication before general rollout."],
  ["Your choices", "Signed-in users can download a structured export under More > Account and data. Account or business deletion requests require support review while financial-record retention rules are finalised."],
  ["Security", "Reasonable technical safeguards are used, but no online service can promise absolute security. Never share passwords, access tokens, or provider credentials through support messages."],
  ["Status of this notice", "This plain-language notice accurately describes the current product direction but is not a substitute for a privacy policy reviewed for the jurisdictions where the service will operate."]
] as const;

export default function PrivacyPage() {
  return (
    <main className="page-shell">
      <header className="page-header max-w-3xl"><p className="section-title">Trust</p><h1 className="page-title">Privacy summary</h1><p className="page-subtitle">How {platform.name} currently handles business information.</p></header>
      <div className="mt-6 grid max-w-3xl gap-3">
        {sections.map(([title, body]) => <section className="card" key={title}><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm font-medium leading-6 text-moss">{body}</p></section>)}
      </div>
      <Link href="/support" className="tap-secondary mt-6"><ArrowLeft size={18} aria-hidden="true" />Support</Link>
      <PublicFooter />
    </main>
  );
}
