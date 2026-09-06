import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <AuthLayout>
      <AuthShell
        title="Register your organization"
        description="Create a company workspace. You become the administrator. Invite employees from People after you sign in."
        footerText="Already have an account?"
        footerLinkHref="/login"
        footerLinkLabel="Sign in"
      >
        <SignUpForm />
      </AuthShell>
    </AuthLayout>
  );
}
