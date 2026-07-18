import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PublicFooter } from "@/components/PublicFooter";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <main className="page-shell">
      <header className="page-header max-w-3xl"><p className="section-title">Trust</p><h1 className="page-title">Terms of use summary</h1><p className="page-subtitle">Important operating expectations for the controlled beta.</p></header>
      <div className="mt-6 grid max-w-3xl gap-3">
        <section className="card"><h2 className="text-lg font-semibold">Your responsibilities</h2><p className="mt-2 text-sm font-medium leading-6 text-moss">Keep account access secure, enter accurate business and tax information, review invoices before delivery, and use communications only for legitimate clients and work.</p></section>
        <section className="card"><h2 className="text-lg font-semibold">Financial information</h2><p className="mt-2 text-sm font-medium leading-6 text-moss">Tax, GST, super, wage, and reporting figures are organisational aids rather than accounting, tax, payroll, or legal advice. Verify critical figures with an appropriately qualified adviser.</p></section>
        <section className="card"><h2 className="text-lg font-semibold">Availability and changes</h2><p className="mt-2 text-sm font-medium leading-6 text-moss">The service may change during beta and can experience outages. Maintain appropriate copies of critical business records and exported invoices.</p></section>
        <section className="card"><h2 className="text-lg font-semibold">Acceptable use</h2><p className="mt-2 text-sm font-medium leading-6 text-moss">Do not send spam, impersonate another business, attempt unauthorised access, upload malicious content, or use the service unlawfully.</p></section>
        <section className="card"><h2 className="text-lg font-semibold">Legal review required</h2><p className="mt-2 text-sm font-medium leading-6 text-moss">These are transparent beta terms, not final public terms. Formal terms covering the operating entity, fees, liability, retention, disputes, and applicable law must be approved before general public rollout.</p></section>
      </div>
      <Link href="/support" className="tap-secondary mt-6"><ArrowLeft size={18} aria-hidden="true" />Support</Link>
      <PublicFooter />
    </main>
  );
}
