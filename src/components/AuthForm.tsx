"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const isSignup = mode === "signup";
  const next = searchParams.get("next") || "/";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const supabase = createClient();

    const result = isSignup
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
          }
        })
      : await supabase.auth.signInWithPassword({ email, password });

    setPending(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (isSignup && !result.data.session) {
      setMessage("Check your email to confirm your account, then log in.");
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={8} required />
      </label>

      {error ? <p className="rounded-lg border border-gum/30 bg-gum/10 p-3 text-sm font-bold text-gum">{error}</p> : null}
      {message ? <p className="rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm font-bold text-mint">{message}</p> : null}

      <button className="tap-primary" type="submit" disabled={pending}>
        {isSignup ? <UserPlus size={20} aria-hidden="true" /> : <LogIn size={20} aria-hidden="true" />}
        {pending ? "Please wait..." : isSignup ? "Create Account" : "Log In"}
      </button>

      <p className="text-center text-sm font-medium text-moss">
        {isSignup ? "Already have an account? " : "Need an account? "}
        <Link className="text-mint" href={`${isSignup ? "/login" : "/signup"}?next=${encodeURIComponent(next)}`}>
          {isSignup ? "Log in" : "Sign up"}
        </Link>
      </p>
    </form>
  );
}
