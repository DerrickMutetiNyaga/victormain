"use client"

import { cn } from "@/lib/utils"
import { getReceiptStatus, formatDateTime } from "@/lib/receipt-utils"

interface ReceiptHeaderProps {
  businessName?: string
  businessSubtitle?: string
  orderId: string
  status: string
  timestamp: Date | string
  className?: string
}

export function ReceiptHeader({
  businessName = "CATHA LODGE",
  businessSubtitle = "Restaurant & Bar",
  orderId,
  status,
  timestamp,
  className,
}: ReceiptHeaderProps) {
  const statusConfig = getReceiptStatus(status)

  return (
    <div className={cn("text-center pb-4 border-b border-[#e5e7eb]", className)}>
      {/* Business Name */}
      <h1 className="text-lg font-bold text-[#0f172a] tracking-tight">
        {businessName}
      </h1>
      {businessSubtitle && (
        <p className="text-xs text-[#64748b] mt-0.5">{businessSubtitle}</p>
      )}

      {/* Order ID + Status Row */}
      <div className="flex items-center justify-center gap-3 mt-4">
        <span className="font-mono text-sm font-semibold text-[#0f172a] bg-[#f1f5f9] px-3 py-1 rounded-md">
          #{orderId}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide",
            statusConfig.bgClass,
            statusConfig.textClass
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {statusConfig.label}
        </span>
      </div>

      {/* Date/Time */}
      <p className="text-xs text-[#64748b] mt-3 tabular-nums">
        {formatDateTime(timestamp)}
      </p>
    </div>
  )
}

