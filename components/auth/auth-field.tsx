"use client";

import { cn } from "@/lib/utils";

type AuthFieldProps = {
  id: string;
  name?: string;
  label: string;
  type?: React.HTMLInputTypeAttribute;
  placeholder: string;
  autoComplete?: string;
  className?: string;
  required?: boolean;
  endAdornment?: React.ReactNode;
};

export function AuthField({
  id,
  name,
  label,
  type = "text",
  placeholder,
  autoComplete,
  className,
  required,
  endAdornment,
}: AuthFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5 text-left w-full", className)}>
      <label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name ?? id}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className={cn(
            "w-full px-4 py-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 shadow-[0_0_1px_rgba(0,0,0,0.5)] outline-none transition-colors focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-2 focus:ring-zinc-950/5 dark:focus:ring-white/10",
            endAdornment && "pr-11"
          )}
        />
        {endAdornment}
      </div>
    </div>
  );
}
