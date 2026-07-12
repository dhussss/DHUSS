import { BriefcaseBusiness } from "lucide-react";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="page-shell flex min-h-screen items-center justify-center">
      <section className="surface-panel w-full max-w-md">
        <div className="border-b border-line bg-white p-6 sm:p-7">
          <span className="grid size-11 place-items-center rounded-xl bg-ink text-white shadow-[0_1px_1px_rgba(21,24,29,0.2),0_10px_22px_-8px_rgba(21,24,29,0.5)]">
            <BriefcaseBusiness size={20} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-ink">Welcome back</h1>
          <p className="mt-2 text-sm font-medium text-moss">Log in to your private workspace.</p>
        </div>
        <div className="p-6 sm:p-7">
          <AuthForm mode="login" />
        </div>
      </section>
    </main>
  );
}
