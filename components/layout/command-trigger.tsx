"use client";

import { useEffect, useState } from "react";
import SearchIcon from "@/components/icons/navbar/search";
import CommandIcon from "@/components/icons/navbar/command";
import { cn } from "@/utils/cn";

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}

export function CommandTrigger({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center w-[280px] h-10 bg-surface border border-border rounded-lg px-3 gap-2 shadow-2xs hover:border-border-strong focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-focus-ring/40 transition-all duration-150 cursor-text text-left",
        className,
      )}
      aria-label="Open command palette"
    >
      <SearchIcon className="w-5 h-5 text-icon-secondary shrink-0" />
      <span className="text-body text-text-tertiary flex-1 truncate select-none">
        Find Something
      </span>
      <div className="flex items-center gap-0.5 bg-surface-secondary border border-border rounded px-1.5 py-0.5 text-text-secondary select-none text-[10px] font-medium leading-none shrink-0 shadow-3xs">
        <CommandIcon className="size-4" />
        <span className="text-button">K</span>
      </div>
    </button>
  );
}
