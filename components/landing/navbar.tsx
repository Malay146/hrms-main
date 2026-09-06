"use client";

import React from "react";
import Link from "next/link";
import Logo from "@/components/icons/logo";
import { ArrowRight } from "lucide-react";

export default function LandingNavbar() {
  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] sm:w-[80%] max-w-6xl rounded-xl border border-zinc-200/80 bg-white/80 backdrop-blur-md dark:bg-zinc-950/80 dark:border-zinc-800 transition-colors shadow-xs">
      <div className="flex items-center justify-between px-3 h-16 sm:px-4">
        {/* Left: Logo and Brand Name */}
        <Link
          href="/"
          className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 rounded-lg p-1"
        >
            <Logo className="size-6 text-zinc-950 dark:text-white" />
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-zinc-950 dark:text-white tracking-tight">
              HRMS
            </span>
          </div>
        </Link>

        {/* Right: Register + Login */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-950 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700 transition-all active:scale-95 cursor-pointer"
          >
            Register organization
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 rounded-md shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Login
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
