"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthField } from "@/components/auth/auth-field";
import { PasswordField } from "@/components/auth/password-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { signInAction } from "@/lib/actions/auth";

export function LoginForm({ passwordResetSuccess = false }: { passwordResetSuccess?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await signInAction({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(result.data.redirectTo);
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {passwordResetSuccess ? (
        <p className="text-xs font-semibold text-emerald-700 rounded-lg border border-emerald-200/60 bg-emerald-50 px-3 py-2">
          Password updated. Sign in with your new password.
        </p>
      ) : null}

      <AuthField
        id="email"
        name="email"
        label="Email address"
        type="email"
        placeholder="you@company.com"
        autoComplete="email"
        required
      />

      <div className="flex flex-col gap-1.5">
        <PasswordField
          id="password"
          name="password"
          label="Password"
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}

      <AuthSubmitButton disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </AuthSubmitButton>
    </form>
  );
}
