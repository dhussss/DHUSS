import { AuthForm } from "@/components/AuthForm";
import { AuthCard } from "@/components/AuthCard";

export default function LoginPage() {
  return (
    <AuthCard title="Welcome back" description="Log in to your private workspace.">
      <AuthForm mode="login" />
    </AuthCard>
  );
}
