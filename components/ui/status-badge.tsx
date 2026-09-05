import type { ComponentProps } from "react"
import type { VariantProps } from "class-variance-authority"

import { Badge, badgeVariants } from "@/components/ui/badge"
import { cn } from "@/lib/shared/utils"

type StatusTone = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

const STATUS_MAP: Record<string, StatusTone> = {
  Active: "success",
  Approved: "success",
  "On Time": "success",
  Paid: "success",
  Hired: "success",
  Present: "success",

  Pending: "warning",
  Late: "warning",
  "On Leave": "warning",
  Processing: "warning",
  Interview: "warning",
  Technical: "warning",
  Screening: "neutral",
  Draft: "neutral",
  Submitted: "warning",
  Acknowledged: "success",

  Offer: "info",
  Applied: "neutral",

  Rejected: "destructive",
  Inactive: "neutral",
  Absent: "destructive",
}

export function statusToVariant(status: string): StatusTone {
  return STATUS_MAP[status] ?? "neutral"
}

interface StatusBadgeProps extends ComponentProps<"span"> {
  status: string
  className?: string
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  return (
    <Badge
      variant={statusToVariant(status)}
      className={cn(className)}
      {...props}
    >
      {status}
    </Badge>
  )
}
