"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthField } from "@/components/auth/auth-field";
import { PasswordField } from "@/components/auth/password-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { signUpOrganizationAction } from "@/lib/actions/auth";

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await signUpOrganizationAction({
      name: String(form.get("name") ?? ""),
      organizationName: String(form.get("organization-name") ?? ""),
      organizationEmail: String(form.get("organization-email") ?? ""),
      password: String(form.get("password") ?? ""),
      confirmPassword: String(form.get("confirm-password") ?? ""),
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
      <AuthField
        id="organization-name"
        name="organization-name"
        label="Organization name"
        placeholder="Acme Inc."
        autoComplete="organization"
        required
      />

      <AuthField
        id="name"
        name="name"
        label="Your name"
        placeholder="Jane Doe"
        autoComplete="name"
        required
      />

      <AuthField
        id="organization-email"
        name="organization-email"
        label="Work email"
        type="email"
        placeholder="jane@acme.com"
        autoComplete="email"
        required
      />

      <PasswordField
        id="password"
        name="password"
        label="Password"
        placeholder="At least 8 characters, with a number"
        autoComplete="new-password"
        required
      />

      <PasswordField
        id="confirm-password"
        name="confirm-password"
        label="Confirm password"
        placeholder="Re-enter your password"
        autoComplete="new-password"
        required
      />

      {error ? (
        <p className="text-xs font-semibold text-red-600">{error}</p>
      ) : null}

      <AuthSubmitButton disabled={pending}>
        {pending ? "Creating organization..." : "Create organization"}
      </AuthSubmitButton>
    </form>
  );
}
