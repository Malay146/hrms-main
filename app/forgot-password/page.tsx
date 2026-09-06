import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <AuthShell
        title="Forgot password"
        description="Enter your work email and we will send a link to reset your password."
        footerText="Remembered it?"
        footerLinkHref="/login"
        footerLinkLabel="Sign in"
      >
        <ForgotPasswordForm />
      </AuthShell>
    </AuthLayout>
  );
}
