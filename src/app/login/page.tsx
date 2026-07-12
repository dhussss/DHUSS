import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="page-shell flex min-h-screen items-center justify-center">
      <section className="surface-panel w-full max-w-md">
        <div className="border-b border-line bg-white p-5 sm:p-6">
          <p className="text-sm font-bold text-mint">Trade Invoice Tracker</p>
          <h1 className="mt-2 text-3xl font-black tracking-normal text-ink">Welcome back</h1>
          <p className="mt-2 text-sm font-medium text-moss">Log in to your private workspace.</p>
        </div>
        <div className="p-5">
          <AuthForm mode="login" />
        </div>
      </section>
    </main>
  );
}
