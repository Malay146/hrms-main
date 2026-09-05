import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthLayout>
      <AuthShell
        title="Welcome Back"
        description="Sign in to your organization workspace to manage employees, track attendance, process payroll, and stay on top of HR operations."
        footerText="Don't have an account?"
        footerLinkHref="/sign-up"
        footerLinkLabel="Create one"
      >
        <LoginForm />
      </AuthShell>
    </AuthLayout>
  );
}
