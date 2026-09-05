import React, { useEffect } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, X } from "lucide-react";
import { cn } from "@/utils/cn";

export type ToastType = "success" | "warning" | "error" | "info";

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

export const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <CheckCircle2 className="size-4 text-zinc-500" />,
    warning: <AlertTriangle className="size-4 text-zinc-500" />,
    error: <AlertCircle className="size-4 text-zinc-500" />,
    info: <AlertCircle className="size-4 text-zinc-500" />,
  };

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface/90 backdrop-blur-md shadow-lg animate-in slide-in-from-bottom-4 duration-300 select-none",
      )}
    >
      {icons[type]}
      <span className="text-xs font-semibold text-text-primary">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="cursor-pointer ml-2 p-0.5 rounded-lg hover:bg-surface-hover text-zinc-400 hover:text-zinc-700 active:scale-95 transition-[transform,background-color,color] duration-150 ease-out focus:outline-none"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
};
