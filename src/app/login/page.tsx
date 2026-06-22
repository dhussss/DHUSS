import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="page-shell flex min-h-screen items-center justify-center">
      <section className="card w-full max-w-md">
        <p className="section-title">Trade Invoice Tracker</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">Log in</h1>
        <p className="mt-2 text-sm font-bold text-moss">Access your private workspace.</p>
        <div className="mt-6">
          <AuthForm mode="login" />
        </div>
      </section>
    </main>
  );
}
