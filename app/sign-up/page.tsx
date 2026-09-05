import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthField } from "@/components/auth/auth-field";
import { PasswordField } from "@/components/auth/password-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

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
        <form className="flex flex-col gap-4">
          <AuthField
            id="name"
            label="Full name"
            placeholder="John Doe"
            autoComplete="name"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AuthField
              id="organization-name"
              label="Organization name"
              placeholder="Acme Inc."
              autoComplete="organization"
            />
            <AuthField
              id="organization-email"
              label="Organization email"
              type="email"
              placeholder="hello@acme.com"
              autoComplete="email"
            />
          </div>

          <PasswordField
            id="password"
            label="Password"
            placeholder="Create a strong password"
            autoComplete="new-password"
          />

          <PasswordField
            id="confirm-password"
            label="Confirm password"
            placeholder="Re-enter your password"
            autoComplete="new-password"
          />

          <AuthSubmitButton>Sign Up</AuthSubmitButton>
        </form>
      </AuthShell>
    </AuthLayout>
  );
}
