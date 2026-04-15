"use client"

import { cn } from "@/lib/utils"
import { getPaymentStyle } from "@/lib/receipt-utils"

interface MetaItem {
  label: string
  value: string | React.ReactNode
  valueClassName?: string
}

interface ReceiptMetaProps {
  items: MetaItem[]
  paymentMethod?: string | null
  mpesaReceiptCode?: string | null
  glovoOrderNumber?: string | null
  className?: string
}

export function ReceiptMeta({
  items,
  paymentMethod,
  mpesaReceiptCode,
  glovoOrderNumber,
  className,
}: ReceiptMetaProps) {
  const paymentConfig = getPaymentStyle(paymentMethod)

  // Build meta rows (2-column layout)
  const metaRows: MetaItem[] = [...items]

  return (
    <div className={cn("py-4 border-b border-[#e5e7eb]", className)}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        {metaRows.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center">
            <span className="text-xs text-[#64748b]">{item.label}</span>
            <span
              className={cn(
                "text-sm font-medium text-[#0f172a] text-right",
                item.valueClassName
              )}
            >
              {item.value}
            </span>
          </div>
        ))}

        {/* Payment Method Row */}
        {paymentMethod && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#64748b]">Payment</span>
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold",
                  paymentConfig.bgClass,
                  paymentConfig.textClass
                )}
              >
                {paymentConfig.label}
              </span>
            </div>

            {/* M-Pesa Receipt Code */}
            {paymentMethod?.toLowerCase() === "mpesa" && mpesaReceiptCode && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#64748b]">Receipt</span>
                <span className="font-mono text-xs text-[#64748b]">
                  {mpesaReceiptCode}
                </span>
              </div>
            )}
            {paymentMethod?.toLowerCase() === "glovo" && glovoOrderNumber && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#64748b]">Glovo Order #</span>
                <span className="font-mono text-xs text-[#64748b]">
                  {glovoOrderNumber}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

