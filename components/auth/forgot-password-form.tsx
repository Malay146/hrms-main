"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthField } from "@/components/auth/auth-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { requestPasswordResetAction } from "@/lib/actions/auth";

export function ForgotPasswordForm() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await requestPasswordResetAction({
      email: String(form.get("email") ?? ""),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.data.message);
    event.currentTarget.reset();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <AuthField
        id="email"
        name="email"
        label="Email address"
        type="email"
        placeholder="you@company.com"
        autoComplete="email"
        required
      />

      {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
      {message ? <p className="text-xs font-semibold text-emerald-700">{message}</p> : null}

      <AuthSubmitButton disabled={pending}>
        {pending ? "Sending..." : "Send reset link"}
      </AuthSubmitButton>

      <p className="text-center text-sm text-zinc-500">
        <Link href="/login" className="font-semibold text-zinc-950 hover:underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
