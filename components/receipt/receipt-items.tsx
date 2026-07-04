"use client"

import { cn } from "@/lib/utils"
import { formatKsh } from "@/lib/receipt-utils"

interface ReceiptItem {
  name: string
  quantity: number
  price: number
<<<<<<< HEAD
  originalPrice?: number
  posDiscountAmount?: number
  promotionName?: string | null
=======
>>>>>>> 3411e520f0915d2f45cd3b71eaa4860363e9369d
}

interface ReceiptItemsProps {
  items: ReceiptItem[]
  className?: string
}

export function ReceiptItems({ items, className }: ReceiptItemsProps) {
  if (!items || items.length === 0) {
    return (
      <div className={cn("py-4", className)}>
        <p className="text-sm text-[#64748b] text-center">No items</p>
      </div>
    )
  }

  return (
    <div className={cn("py-4 border-b border-[#e5e7eb]", className)}>
<<<<<<< HEAD
=======
      {/* Section Title */}
>>>>>>> 3411e520f0915d2f45cd3b71eaa4860363e9369d
      <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">
        Items
      </h3>

<<<<<<< HEAD
      <div className="space-y-0">
        {items.map((item, idx) => {
          const hasDiscount =
            item.originalPrice != null &&
            item.posDiscountAmount != null &&
            item.posDiscountAmount > 0
          const itemTotal = (item.price ?? 0) * (item.quantity ?? 0)

=======
      {/* Items List */}
      <div className="space-y-0">
        {items.map((item, idx) => {
          const itemTotal = (item.price ?? 0) * (item.quantity ?? 0)
>>>>>>> 3411e520f0915d2f45cd3b71eaa4860363e9369d
          return (
            <div
              key={idx}
              className={cn(
<<<<<<< HEAD
                "py-2.5",
                idx < items.length - 1 && "border-b border-dashed border-[#e5e7eb]"
              )}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-4">
                  <p className="text-sm font-medium text-[#0f172a]">{item.name}</p>
                  {hasDiscount ? (
                    <div className="mt-1 space-y-0.5 text-xs text-[#64748b] tabular-nums">
                      <div className="flex justify-between gap-4">
                        <span>Original</span>
                        <span className="line-through">{formatKsh(item.originalPrice!)}</span>
                      </div>
                      <div className="flex justify-between gap-4 text-amber-700">
                        <span>Discount</span>
                        <span>-{formatKsh(item.posDiscountAmount!)}</span>
                      </div>
                      <div className="flex justify-between gap-4 font-semibold text-[#0f172a]">
                        <span>{item.quantity} × Now</span>
                        <span>{formatKsh(item.price)}</span>
                      </div>
                      {item.promotionName && (
                        <p className="text-[10px] text-amber-600 pt-0.5">
                          Promotion: {item.promotionName}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-[#64748b] mt-0.5 tabular-nums">
                      {item.quantity} × {formatKsh(item.price)}
                    </p>
                  )}
                </div>
                <p className="text-sm font-semibold text-[#0f172a] tabular-nums whitespace-nowrap">
                  {formatKsh(itemTotal)}
                </p>
              </div>
=======
                "flex justify-between items-start py-2.5",
                idx < items.length - 1 && "border-b border-dashed border-[#e5e7eb]"
              )}
            >
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-[#0f172a]">{item.name}</p>
                <p className="text-xs text-[#64748b] mt-0.5 tabular-nums">
                  {item.quantity} × {formatKsh(item.price)}
                </p>
              </div>
              <p className="text-sm font-semibold text-[#0f172a] tabular-nums whitespace-nowrap">
                {formatKsh(itemTotal)}
              </p>
>>>>>>> 3411e520f0915d2f45cd3b71eaa4860363e9369d
            </div>
          )
        })}
      </div>
    </div>
  )
}
<<<<<<< HEAD
=======

>>>>>>> 3411e520f0915d2f45cd3b71eaa4860363e9369d
