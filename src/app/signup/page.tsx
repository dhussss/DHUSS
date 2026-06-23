import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <main className="page-shell flex min-h-screen items-center justify-center">
      <section className="surface-panel w-full max-w-md">
        <div className="bg-ink p-5 text-white">
          <p className="text-sm font-black uppercase text-mint">Trade Invoice Tracker</p>
          <h1 className="mt-2 text-3xl font-black tracking-normal">Create account</h1>
          <p className="mt-2 text-sm font-bold text-white/70">Start a private invoicing workspace.</p>
        </div>
        <div className="p-5">
          <AuthForm mode="signup" />
        </div>
      </section>
    </main>
  );
}
