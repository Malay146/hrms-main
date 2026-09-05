"use client";

import React, { useEffect, useRef } from "react";
import Logo from "@/components/icons/logo";
import { signOutAction } from "@/lib/actions/auth";

export default function LogoutPage() {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <div className="min-h-screen w-screen bg-zinc-50 flex flex-col items-center justify-center p-6 select-none font-sans text-center">
      <form ref={formRef} action={signOutAction} className="max-w-md w-full">
        <div className="border border-zinc-200/80 bg-surface rounded-2xl p-8 flex flex-col items-center gap-6 shadow-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="relative flex items-center justify-center w-14 h-14 rounded-full border border-border bg-surface shadow-xs">
            <Logo className="w-6 h-6 text-zinc-950 animate-pulse" />
            <div className="absolute inset-0 rounded-full border-t-2 border-zinc-950 animate-spin" />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold text-zinc-950 tracking-tight leading-none">
              Signing Out...
            </h1>
            <p className="text-xs font-semibold text-zinc-400 leading-relaxed max-w-xs mx-auto">
              Securing your session and preparing your return to the portal entrance.
            </p>
          </div>

          <noscript>
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs px-4 py-2"
            >
              Sign out
            </button>
          </noscript>
        </div>
      </form>
    </div>
  );
}
