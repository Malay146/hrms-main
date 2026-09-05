"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="fixed inset-0 z-[100] cursor-default bg-overlay backdrop-blur-[2px] animate-in fade-in duration-200"
      />
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className={cn(
            "pointer-events-auto w-full max-w-md bg-surface border border-border rounded-2xl shadow-lg animate-in fade-in zoom-in-95 duration-200 ease-out",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
            <div className="flex flex-col gap-1 text-left min-w-0">
              <h2
                id="modal-title"
                className="text-base font-bold text-zinc-950 leading-tight"
              >
                {title}
              </h2>
              {description ? (
                <p className="text-xs text-zinc-400 font-semibold">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer p-1.5 rounded-lg border border-border text-zinc-400 hover:text-zinc-800 hover:bg-surface-hover bg-surface shadow-3xs active:scale-95 transition-[transform,background-color,color] duration-150 ease-out shrink-0"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="px-6 py-5">{children}</div>
        </div>
      </div>
    </>
  );
}
