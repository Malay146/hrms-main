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
    const result = await signUpOrganizationAction();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <AuthField
        id="name"
        name="name"
        label="Full name"
        placeholder="John Doe"
        autoComplete="name"
        required
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AuthField
          id="organization-name"
          name="organization-name"
          label="Organization name"
          placeholder="Acme Inc."
          autoComplete="organization"
          required
        />
        <AuthField
          id="organization-email"
          name="organization-email"
          label="Organization email"
          type="email"
          placeholder="hello@acme.com"
          autoComplete="email"
          required
        />
      </div>

      <PasswordField
        id="password"
        name="password"
        label="Password"
        placeholder="Create a strong password"
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
        {pending ? "Creating workspace..." : "Sign Up"}
      </AuthSubmitButton>
    </form>
  );
}
