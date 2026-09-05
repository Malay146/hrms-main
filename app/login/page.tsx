import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthField } from "@/components/auth/auth-field";
import { PasswordField } from "@/components/auth/password-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

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
        <form className="flex flex-col gap-4">
          <AuthField
            id="email"
            label="Email address"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
          />

          <PasswordField
            id="password"
            label="Password"
            placeholder="Enter your password"
            autoComplete="current-password"
          />

          <div className="flex items-center justify-between gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="size-4 rounded border-zinc-300 dark:border-zinc-700 text-zinc-950 focus:ring-zinc-950/20 dark:focus:ring-white/20"
              />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Remember me
              </span>
            </label>

            <Link
              href="#"
              className="text-sm font-medium text-zinc-950 dark:text-white hover:underline underline-offset-4 shrink-0"
            >
              Forgot password?
            </Link>
          </div>

          <AuthSubmitButton>Sign in</AuthSubmitButton>
        </form>
      </AuthShell>
    </AuthLayout>
  );
}
