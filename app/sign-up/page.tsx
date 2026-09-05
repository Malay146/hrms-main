import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <AuthLayout>
      <AuthShell
        title="Get Started with Smarter HR"
        description="Set up your organization in minutes and simplify employee management, attendance, payroll, and leave tracking—all from one secure platform."
        footerText="Already have an account?"
        footerLinkHref="/login"
        footerLinkLabel="Sign in"
      >
        <SignUpForm />
      </AuthShell>
    </AuthLayout>
  );
}
