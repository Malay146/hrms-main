import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = params.token?.trim() || null;
  const invalidReason =
    params.error === "INVALID_TOKEN"
      ? "This reset link is invalid or has expired."
      : !token
        ? "Open the link from your email to reset your password."
        : null;

  return (
    <AuthLayout>
      <AuthShell
        title="Choose a new password"
        description="Pick a strong password you have not used here before."
        footerText="Back to"
        footerLinkHref="/login"
        footerLinkLabel="Sign in"
      >
        <ResetPasswordForm token={token} invalidReason={invalidReason} />
      </AuthShell>
    </AuthLayout>
  );
}
