"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthField } from "@/components/auth/auth-field";

type PasswordFieldProps = {
  id: string;
  name?: string;
  label: string;
  placeholder: string;
  autoComplete?: string;
  className?: string;
  required?: boolean;
};

export function PasswordField({
  id,
  name,
  label,
  placeholder,
  autoComplete,
  className,
  required,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <AuthField
      id={id}
      name={name ?? id}
      label={label}
      type={visible ? "text" : "password"}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className={className}
      required={required}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </button>
      }
    />
  );
}
