"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/components/auth/password-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { resetPasswordAction } from "@/lib/actions/auth";

export function ResetPasswordForm({
  token,
  invalidReason,
}: {
  token: string | null;
  invalidReason?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState(invalidReason ?? "");
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col gap-4 text-left">
        <p className="text-sm font-medium text-red-600">
          {invalidReason || "This reset link is invalid or has expired."}
        </p>
        <Link
          href="/forgot-password"
          className="text-sm font-semibold text-zinc-950 hover:underline underline-offset-4"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await resetPasswordAction({
      token,
      newPassword: String(form.get("newPassword") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
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
      <PasswordField
        id="newPassword"
        name="newPassword"
        label="New password"
        placeholder="At least 8 characters, including a number"
        autoComplete="new-password"
        required
      />
      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm new password"
        placeholder="Re-enter the new password"
        autoComplete="new-password"
        required
      />
      {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
      <AuthSubmitButton disabled={pending}>
        {pending ? "Saving..." : "Reset password"}
      </AuthSubmitButton>
      <p className="text-center text-sm text-zinc-500">
        <Link href="/login" className="font-semibold text-zinc-950 hover:underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
