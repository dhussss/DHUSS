import type { ReactNode } from "react";
import { BriefcaseBusiness } from "lucide-react";
import { PublicFooter } from "@/components/PublicFooter";
import { platform } from "@/lib/platform";

export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="page-shell flex min-h-screen items-center justify-center">
      <section className="w-full max-w-sm">
        <div className="pb-6">
          <span className="grid size-10 place-items-center rounded-lg bg-ink text-white shadow-crisp">
            <BriefcaseBusiness size={20} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-mint">{platform.name}</p>
          <h1 className="mt-5 text-3xl font-semibold text-ink">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-moss">{description}</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft sm:p-6">{children}</div>
        <PublicFooter compact />
      </section>
    </main>
  );
}
