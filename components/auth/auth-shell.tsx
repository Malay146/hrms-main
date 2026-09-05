import Link from "next/link";
import Logo from "@/components/icons/logo";
import { cn } from "@/lib/shared/utils";

type AuthShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  footerText?: string;
  footerLinkHref?: string;
  footerLinkLabel?: string;
  className?: string;
};

export function AuthShell({
  title,
  description,
  children,
  footerText,
  footerLinkHref,
  footerLinkLabel,
  className,
}: AuthShellProps) {
  return (
    <div
      className={cn(
        "flex w-full max-w-xl flex-col items-center gap-6 text-center",
        className
      )}
    >
      <Link
        href="/"
        className="p-3 border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl shadow-[0px_1px_3px_0px_#00000015,inset_0px_1px_1px_0px_#ffffff40,inset_0px_-1px_3px_0px_#00000025] transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-white"
        aria-label="Back to home"
      >
        <Logo className="size-8" />
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-zinc-950 dark:text-white">
          {title}
        </h1>
        <p className="text-sm sm:text-base font-normal text-zinc-600 dark:text-zinc-400 max-w-xl leading-relaxed">
          {description}
        </p>
      </div>

      <div className="w-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/60 backdrop-blur-sm p-6 sm:p-8 shadow-sm">
        {children}
      </div>

      {footerText && footerLinkHref && footerLinkLabel ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {footerText}{" "}
          <Link
            href={footerLinkHref}
            className="font-semibold text-zinc-950 dark:text-white hover:underline underline-offset-4"
          >
            {footerLinkLabel}
          </Link>
        </p>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Need an account? Ask your administrator to create one.
        </p>
      )}
    </div>
  );
}
