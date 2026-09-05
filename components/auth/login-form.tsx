"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthField } from "@/components/auth/auth-field";
import { PasswordField } from "@/components/auth/password-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { signInAction } from "@/lib/actions/auth";

export function LoginForm() {
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
    router.push(result.data.role === "admin" ? "/admin" : "/employee");
    router.refresh();
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

      <PasswordField
        id="password"
        name="password"
        label="Password"
        placeholder="Enter your password"
        autoComplete="current-password"
        required
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

      {error ? (
        <p className="text-xs font-semibold text-red-600">{error}</p>
      ) : null}

      <AuthSubmitButton disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </AuthSubmitButton>
    </form>
  );
}
