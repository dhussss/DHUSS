import { AuthCard } from "@/components/AuthCard";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const initialError = query?.error === "reset_expired"
    ? "That password reset link has expired or was already used. Request a new link below."
    : "";

  return (
    <AuthCard title="Reset password" description="We will email you a secure link to choose a new password.">
      <ForgotPasswordForm initialError={initialError} />
    </AuthCard>
  );
}
