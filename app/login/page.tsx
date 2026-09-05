import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthLayout>
      <AuthShell
        title="Welcome Back"
        description="Sign in with the account an administrator created for you."
      >
        <LoginForm />
      </AuthShell>
    </AuthLayout>
  );
}
