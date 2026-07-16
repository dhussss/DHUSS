import { AuthCard } from "@/components/AuthCard";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset password" description="We will email you a secure link to choose a new password.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
