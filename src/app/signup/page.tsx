import { AuthForm } from "@/components/AuthForm";
import { AuthCard } from "@/components/AuthCard";

export default function SignupPage() {
  return (
    <AuthCard title="Create account" description="Start your private invoicing workspace.">
      <AuthForm mode="signup" />
    </AuthCard>
  );
}
