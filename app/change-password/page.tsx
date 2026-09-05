import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthShell } from "@/components/auth/auth-shell";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default function ChangePasswordPage() {
  return (
    <AuthLayout>
      <AuthShell
        title="Set a new password"
        description="You must replace the temporary password before you can use HRMS."
        footerText="Wrong account?"
        footerLinkHref="/logout"
        footerLinkLabel="Sign out"
      >
        <ChangePasswordForm />
      </AuthShell>
    </AuthLayout>
  );
}
