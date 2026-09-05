"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/components/auth/password-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { changePasswordAction } from "@/lib/actions/auth";

export function ChangePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await changePasswordAction({
      currentPassword: String(form.get("currentPassword") ?? ""),
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
        id="currentPassword"
        name="currentPassword"
        label="Current password"
        placeholder="Password from your email"
        autoComplete="current-password"
        required
      />
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
      {error ? (
        <p className="text-xs font-semibold text-red-600">{error}</p>
      ) : null}
      <AuthSubmitButton disabled={pending}>
        {pending ? "Saving..." : "Save new password"}
      </AuthSubmitButton>
    </form>
  );
}
