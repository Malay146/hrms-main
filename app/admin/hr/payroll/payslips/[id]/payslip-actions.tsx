"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { sendPayslipEmailAction } from "@/lib/actions/payroll/payruns";

export function PayslipEmailButton({
  payslipId,
  status,
  sentAt,
}: {
  payslipId: string;
  status: string;
  sentAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const ready = status === "validated" || status === "paid";

  function send() {
    startTransition(async () => {
      const result = await sendPayslipEmailAction(payslipId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Payslip emailed to the employee.");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending || !ready}
      onClick={send}
      className="cursor-pointer px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
    >
      <Mail className="size-4" />
      {pending ? "Sending…" : sentAt ? "Resend email" : "Email payslip"}
    </button>
  );
}
