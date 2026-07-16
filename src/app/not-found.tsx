import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
  return (
    <main className="page-shell items-center justify-center">
      <section className="surface-panel w-full max-w-lg p-6 text-center sm:p-8">
        <p className="section-title">Not found</p>
        <h1 className="mt-3 text-2xl font-black text-ink">That page is not available</h1>
        <p className="mt-2 text-sm font-medium leading-6 text-moss">It may have been moved, archived, or deleted.</p>
        <Link href="/" className="tap-primary mt-6 w-full">
          <ArrowLeft size={18} aria-hidden="true" /> Return Home
        </Link>
      </section>
    </main>
  );
}
