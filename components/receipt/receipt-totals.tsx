"use client"

import { cn } from "@/lib/utils"
import { formatKsh } from "@/lib/receipt-utils"

interface ReceiptTotalsProps {
  subtotal: number | null | undefined
  vat: number | null | undefined
  total: number | null | undefined
  amountReceived?: number | null
  change?: number | null
  isPaid?: boolean
  className?: string
}

export function ReceiptTotals({
  subtotal,
  vat,
  total,
  amountReceived,
  change,
  isPaid = true,
  className,
}: ReceiptTotalsProps) {
  return (
    <div className={cn("py-4", className)}>
      {/* Totals - Right Aligned Block */}
      <div className="flex flex-col items-end space-y-1.5">
        {/* Subtotal */}
        <div className="flex items-center justify-between w-48 text-sm">
          <span className="text-[#64748b]">Subtotal</span>
          <span className="font-medium text-[#0f172a] tabular-nums">
            {formatKsh(subtotal)}
          </span>
        </div>

        {/* VAT is already included in item prices; no separate tax line */}

        {/* Divider */}
        <div className="w-48 border-t border-[#0f172a] my-2" />

        {/* Total */}
        <div className="flex items-center justify-between w-48">
          <span className="text-base font-bold text-[#0f172a]">TOTAL</span>
          <span className="text-xl font-bold text-[#0f172a] tabular-nums">
            {formatKsh(total)}
          </span>
        </div>

        {/* Amount Received (if paid with cash and applicable) */}
        {isPaid && amountReceived != null && amountReceived > 0 && (
          <>
            <div className="w-48 border-t border-dashed border-[#e5e7eb] my-2" />
            <div className="flex items-center justify-between w-48 text-sm">
              <span className="text-[#64748b]">Received</span>
              <span className="font-medium text-[#0f172a] tabular-nums">
                {formatKsh(amountReceived)}
              </span>
            </div>
            {change != null && change > 0 && (
              <div className="flex items-center justify-between w-48 text-sm">
                <span className="text-[#64748b]">Change</span>
                <span className="font-semibold text-[#2563eb] tabular-nums">
                  {formatKsh(change)}
                </span>
              </div>
            )}
          </>
        )}

        {/* Due Amount (if not paid) */}
        {!isPaid && total != null && (
          <div className="flex items-center justify-between w-48 text-sm mt-2">
            <span className="text-[#991b1b] font-medium">Amount Due</span>
            <span className="font-bold text-[#991b1b] tabular-nums">
              {formatKsh(total)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

