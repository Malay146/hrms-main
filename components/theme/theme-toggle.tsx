"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/utils/cn";
import { setDarkMode, useIsDarkMode } from "./use-theme";

export function ThemeToggle({ className }: { className?: string }) {
  const isDark = useIsDarkMode();
  return (
    <button
      type="button"
      onClick={() => setDarkMode(!isDark)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
        className,
      )}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
