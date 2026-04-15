import { cn } from "@/lib/utils"

type Status = "PAID" | "PARTIALLY_PAID" | "NOT_PAID"

interface StatusBadgeProps {
  status: Status
  className?: string
}

const statusConfig: Record<Status, { bg: string; text: string; dot: string; label: string }> = {
  PAID: {
    bg: "bg-[#dcfce7]",
    text: "text-[#166534]",
    dot: "bg-[#16a34a]",
    label: "Paid",
  },
  PARTIALLY_PAID: {
    bg: "bg-[#fef3c7]",
    text: "text-[#92400e]",
    dot: "bg-[#f59e0b]",
    label: "Partially Paid",
  },
  NOT_PAID: {
    bg: "bg-[#fee2e2]",
    text: "text-[#991b1b]",
    dot: "bg-[#ef4444]",
    label: "Not Paid",
  },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.NOT_PAID

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
        config.bg,
        config.text,
        className
      )}
    >
      <div className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  )
}

