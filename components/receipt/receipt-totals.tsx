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
  totalLinkedPayments?: number | null
  balanceDue?: number | null
  overpaymentAmount?: number | null
  changeGiven?: boolean | null
  paymentStatusLabel?: string | null
  className?: string
}

export function ReceiptTotals({
  subtotal,
  vat,
  total,
  amountReceived,
  change,
  isPaid = true,
  totalLinkedPayments,
  balanceDue,
  overpaymentAmount,
  changeGiven,
  paymentStatusLabel,
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

        {totalLinkedPayments != null && totalLinkedPayments > 0 && (
          <>
            <div className="w-48 border-t border-dashed border-[#e5e7eb] my-2" />
            <div className="flex items-center justify-between w-48 text-sm">
              <span className="text-[#64748b]">Paid (linked)</span>
              <span className="font-medium text-[#0f172a] tabular-nums">{formatKsh(totalLinkedPayments)}</span>
            </div>
            {balanceDue != null && balanceDue > 0 && (
              <div className="flex items-center justify-between w-48 text-sm">
                <span className="text-[#b45309] font-medium">Balance due</span>
                <span className="font-semibold text-[#b45309] tabular-nums">{formatKsh(balanceDue)}</span>
              </div>
            )}
            {overpaymentAmount != null && overpaymentAmount > 0 && (
              <>
                <div className="flex items-center justify-between w-48 text-sm">
                  <span className="text-[#64748b]">Excess / change</span>
                  <span className="font-semibold text-[#5b21b6] tabular-nums">{formatKsh(overpaymentAmount)}</span>
                </div>
                <div className="flex items-center justify-between w-48 text-xs text-[#64748b]">
                  <span>Change given</span>
                  <span className="font-medium text-[#0f172a]">{changeGiven ? "Yes" : "No"}</span>
                </div>
              </>
            )}
            {paymentStatusLabel && (
              <div className="flex items-center justify-between w-48 text-xs mt-1">
                <span className="text-[#64748b]">Pay status</span>
                <span className="font-semibold text-[#0f172a]">{paymentStatusLabel}</span>
              </div>
            )}
          </>
        )}

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

