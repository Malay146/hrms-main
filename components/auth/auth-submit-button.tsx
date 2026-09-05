import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthSubmitButtonProps = {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

export function AuthSubmitButton({
  children,
  className,
  disabled,
}: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={cn(
        "group mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold text-sm shadow-lg shadow-zinc-950/10 dark:shadow-white/5 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all duration-200 active:scale-[0.98] cursor-pointer",
        className
      )}
    >
      <span>{children}</span>
      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
    </button>
  );
}
