import type { ReactNode } from "react";
import { BriefcaseBusiness } from "lucide-react";

export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="page-shell flex min-h-screen items-center justify-center">
      <section className="surface-panel w-full max-w-md">
        <div className="border-b border-line bg-white p-6 sm:p-7">
          <span className="grid size-11 place-items-center rounded-xl bg-ink text-white shadow-[0_1px_1px_rgba(21,24,29,0.2),0_10px_22px_-8px_rgba(21,24,29,0.5)]">
            <BriefcaseBusiness size={20} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-3xl font-black text-ink">{title}</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-moss">{description}</p>
        </div>
        <div className="p-6 sm:p-7">{children}</div>
      </section>
    </main>
  );
}
