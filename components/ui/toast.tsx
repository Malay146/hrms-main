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
    success: <CheckCircle2 className="size-4 text-emerald-500" />,
    warning: <AlertTriangle className="size-4 text-amber-500" />,
    error: <AlertCircle className="size-4 text-red-500" />,
    info: <AlertCircle className="size-4 text-blue-500" />,
  };

  const borderColors = {
    success: "border-emerald-500/20",
    warning: "border-amber-500/20",
    error: "border-red-500/20",
    info: "border-blue-500/20",
  };

  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border bg-surface/90 backdrop-blur-md shadow-lg animate-in slide-in-from-bottom-4 duration-300 select-none",
      borderColors[type]
    )}>
      {icons[type]}
      <span className="text-xs font-bold text-text-primary">{message}</span>
      <button 
        onClick={onClose}
        className="cursor-pointer ml-2 p-0.5 rounded-lg hover:bg-surface-hover text-zinc-400 hover:text-zinc-700 active:scale-95 transition-all focus:outline-none"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
};
