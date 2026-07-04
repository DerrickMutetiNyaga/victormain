"use client"

import { cn } from "@/lib/utils"
import { ScanToPayBlock } from "./scan-to-pay-block"

interface ReceiptFooterProps {
  orderId: string
  showQRCode?: boolean
  amountDue?: number | null
  tillNumber?: string | null
  isPaid?: boolean
  className?: string
}

export function ReceiptFooter({
  orderId,
  showQRCode = false,
  amountDue,
  tillNumber,
  isPaid = false,
  className,
}: ReceiptFooterProps) {
  const printedAt = new Date().toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const showScanToPay = showQRCode && !isPaid && amountDue != null && amountDue > 0

  return (
    <div className={cn("pt-4 border-t border-dashed border-[#e5e7eb]", className)}>
      {showScanToPay && (
        <div className="mb-4">
          <ScanToPayBlock
            orderId={orderId}
            amountDue={amountDue}
            tillNumber={tillNumber}
            isPaid={isPaid}
          />
        </div>
      )}

      {showQRCode && isPaid && (
        <div className="mb-4">
          <ScanToPayBlock orderId={orderId} isPaid amountDue={0} />
        </div>
      )}

      <p className="text-sm font-semibold text-[#0f172a] text-center">
        Thank you for your order!
      </p>
      <p className="text-xs text-[#64748b] mt-1 text-center">
        We appreciate your business
      </p>

      <p className="text-[10px] text-[#94a3b8] mt-3 text-center">
        Printed: {printedAt}
      </p>

      <p className="text-[9px] text-[#cbd5e1] mt-2 text-center print:hidden">
        Powered by Infusion POS
      </p>
    </div>
  )
}
