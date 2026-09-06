import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthLayout>
      <AuthShell
        title="Welcome Back"
        description="Sign in to your organization's HRMS workspace."
        footerText="New company?"
        footerLinkHref="/sign-up"
        footerLinkLabel="Register an organization"
      >
        <LoginForm />
      </AuthShell>
    </AuthLayout>
  );
}
