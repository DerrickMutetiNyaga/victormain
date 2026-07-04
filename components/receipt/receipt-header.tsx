"use client"

import { cn } from "@/lib/utils"
import { getReceiptStatus, formatDateTime } from "@/lib/receipt-utils"

interface ReceiptHeaderProps {
  businessName?: string
  businessSubtitle?: string
  orderId: string
  status: string
  timestamp: Date | string
  highlightOrderId?: boolean
  className?: string
}

export function ReceiptHeader({
  businessName = "catha lounge",
  businessSubtitle = "Restaurant & Bar",
  orderId,
  status,
  timestamp,
  highlightOrderId = false,
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
      <div className={cn("mt-4", highlightOrderId && "rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-3")}>
        {highlightOrderId && (
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-800 mb-1">Order ID — use for payment</p>
        )}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span
            className={cn(
              "font-mono font-black text-[#0f172a] bg-[#f1f5f9] px-3 py-1.5 rounded-md break-all",
              highlightOrderId ? "text-lg sm:text-xl" : "text-sm font-semibold"
            )}
          >
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
      </div>

      {/* Date/Time */}
      <p className="text-xs text-[#64748b] mt-3 tabular-nums">
        {formatDateTime(timestamp)}
      </p>
    </div>
  )
}

