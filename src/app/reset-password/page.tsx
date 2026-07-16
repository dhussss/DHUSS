import { AuthCard } from "@/components/AuthCard";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password" description="Use at least 8 characters and keep it somewhere secure.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
