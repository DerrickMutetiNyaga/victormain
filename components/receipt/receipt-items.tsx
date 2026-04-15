"use client"

import { cn } from "@/lib/utils"
import { formatKsh } from "@/lib/receipt-utils"

interface ReceiptItem {
  name: string
  quantity: number
  price: number
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
      {/* Section Title */}
      <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">
        Items
      </h3>

      {/* Items List */}
      <div className="space-y-0">
        {items.map((item, idx) => {
          const itemTotal = (item.price ?? 0) * (item.quantity ?? 0)
          return (
            <div
              key={idx}
              className={cn(
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
            </div>
          )
        })}
      </div>
    </div>
  )
}

