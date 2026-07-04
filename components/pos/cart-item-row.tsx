"use client"

import { cn } from "@/lib/utils"
import { Minus, Plus, X } from "lucide-react"

interface CartItemRowProps {
  item: {
    id: string
    name: string
    price: number
    quantity: number
    size?: string
    image?: string
    stock?: number
<<<<<<< HEAD
    originalPrice?: number
    posDiscount?: {
      discountAmount: number
      badgeLabel?: string
      promotionName?: string | null
    }
=======
>>>>>>> 3411e520f0915d2f45cd3b71eaa4860363e9369d
  }
  onUpdateQuantity: (id: string, quantity: number, size?: string) => void
  onRemove: (id: string, size?: string) => void
  className?: string
}

export function CartItemRow({
  item,
  onUpdateQuantity,
  onRemove,
  className,
}: CartItemRowProps) {
  const lineTotal = item.price * item.quantity
<<<<<<< HEAD
  const hasPosDiscount = Boolean(item.originalPrice != null && item.posDiscount)
=======
>>>>>>> 3411e520f0915d2f45cd3b71eaa4860363e9369d

  const formatKsh = (amount: number) =>
    `KSh ${amount.toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-2.5 bg-muted/50 rounded-xl border border-border transition-colors hover:bg-muted/70",
        className
      )}
    >
<<<<<<< HEAD
=======
      {/* Top Row: Image, Details, Price */}
>>>>>>> 3411e520f0915d2f45cd3b71eaa4860363e9369d
      <div className="flex items-start gap-2.5">
        <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
          <img
            src={item.image || "/placeholder.svg?height=48&width=48&query=drink"}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0">
<<<<<<< HEAD
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-xs font-semibold text-foreground leading-tight line-clamp-2">
              {item.name}
            </h4>
            {hasPosDiscount && item.posDiscount?.badgeLabel && (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white">
                {item.posDiscount.badgeLabel}
              </span>
            )}
          </div>
=======
          <h4 className="text-xs font-semibold text-foreground leading-tight line-clamp-2">
            {item.name}
          </h4>
>>>>>>> 3411e520f0915d2f45cd3b71eaa4860363e9369d
          {item.size && (
            <span className="inline-block mt-0.5 text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              {item.size}
            </span>
          )}
<<<<<<< HEAD

          {hasPosDiscount ? (
            <div className="mt-1 space-y-0.5 rounded-md bg-white/60 border border-border/40 px-2 py-1.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Original</span>
                <span className="text-muted-foreground line-through tabular-nums">
                  {formatKsh(item.originalPrice!)}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-amber-700 font-medium">Discount</span>
                <span className="text-amber-700 font-semibold tabular-nums">
                  -{formatKsh(item.posDiscount!.discountAmount)}
                </span>
              </div>
              <div className="flex justify-between text-[10px] pt-0.5 border-t border-dashed border-border/50">
                <span className="text-emerald-700 font-bold">Now</span>
                <span className="text-emerald-700 font-bold tabular-nums">
                  {formatKsh(item.price)}
                </span>
              </div>
              {item.posDiscount?.promotionName && (
                <p className="text-[9px] text-amber-600 pt-0.5">
                  Promo: {item.posDiscount.promotionName}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
              {formatKsh(item.price)} each
            </p>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-emerald-700 tabular-nums">
=======
          <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
            {formatKsh(item.price)} each
          </p>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-foreground tabular-nums">
>>>>>>> 3411e520f0915d2f45cd3b71eaa4860363e9369d
            {formatKsh(lineTotal)}
          </p>
        </div>
      </div>

<<<<<<< HEAD
=======
      {/* Bottom Row: Quantity (+ / -) min 44px touch + Remove */}
>>>>>>> 3411e520f0915d2f45cd3b71eaa4860363e9369d
      <div className="flex items-center justify-between pt-1.5 border-t border-border">
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1, item.size)}
            className="min-h-[44px] min-w-[44px] h-9 w-9 rounded-lg bg-card border border-border hover:bg-muted flex items-center justify-center transition-colors touch-manipulation focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Decrease quantity"
          >
            <Minus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <div className="min-w-[36px] h-9 flex items-center justify-center">
            <span className="text-xs font-bold text-foreground tabular-nums">
              {item.quantity}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1, item.size)}
            disabled={(item.stock ?? Infinity) <= item.quantity}
            className={cn(
              "min-h-[44px] min-w-[44px] h-9 w-9 rounded-lg flex items-center justify-center transition-colors touch-manipulation focus:outline-none focus:ring-2 focus:ring-ring",
              (item.stock ?? Infinity) <= item.quantity
                ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                : "bg-emerald-100 hover:bg-emerald-200 text-emerald-700"
            )}
            aria-label="Increase quantity"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onRemove(item.id, item.size)}
          className="min-h-[44px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-destructive hover:bg-destructive/10 transition-colors touch-manipulation focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Remove item"
        >
          <X className="h-3.5 w-3.5" />
          Remove
        </button>
      </div>
    </div>
  )
}
<<<<<<< HEAD
=======

>>>>>>> 3411e520f0915d2f45cd3b71eaa4860363e9369d
