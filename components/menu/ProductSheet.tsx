"use client"

import React, { memo } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Plus, Minus, X } from "lucide-react"
import Image from "next/image"
import { MenuItem } from "@/types/menu"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface ProductSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: MenuItem | null
  quantity: number
  onAdd: () => void
  onRemove: () => void
}

const tagConfig: Record<string, { label: string; className: string }> = {
  popular: { label: "Popular", className: "bg-amber-500 text-black" },
  "best-seller": { label: "Best Seller", className: "bg-orange-500 text-white" },
  "premium-pick": { label: "Premium", className: "bg-purple-500 text-white" },
  "house-favorite": { label: "House Fav", className: "bg-rose-500 text-white" },
  "staff-pick": { label: "Staff Pick", className: "bg-sky-500 text-white" },
  "best-value": { label: "Best Value", className: "bg-emerald-500 text-white" },
}

export const ProductSheet = memo(function ProductSheet({
  open,
  onOpenChange,
  item,
  quantity,
  onAdd,
  onRemove,
}: ProductSheetProps) {
  if (!item) return null

  const tag = item.tag ? tagConfig[item.tag] : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showClose={false}
        className="p-0 overflow-hidden rounded-t-3xl border-t border-white/[0.08] bg-[#13131E] max-h-[88vh]"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col h-full"
        >
          {/* Image section — starts at modal top */}
          <div className="relative h-52 w-full overflow-hidden bg-[#1C1C2C] flex-shrink-0">
            {/* Handle bar — overlayed at top */}
            <div className="absolute top-0 left-0 right-0 flex justify-center pt-3 pb-1 z-30 pointer-events-none">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            <Image
              src={item.image || "/placeholder.jpg"}
              alt={item.name}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
            {/* Gradient overlay bottom */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#13131E] to-transparent" />

            {/* Close button */}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-3 right-3 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center z-20 active:scale-90 transition-transform"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Tag */}
            {tag && (
              <span
                className={cn(
                  "absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-bold z-20",
                  tag.className
                )}
              >
                {tag.label}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
            <SheetHeader>
              {item.brand && (
                <p className="text-amber-400/80 text-[11px] font-semibold uppercase tracking-widest mb-1">
                  {item.brand}
                </p>
              )}
              <SheetTitle className="text-white text-xl font-extrabold text-left leading-tight">
                {item.name}
              </SheetTitle>
            </SheetHeader>

            <p className="text-white/50 text-sm leading-relaxed mt-3">
              {item.description}
            </p>

            {/* Pairing tip */}
            {(item.category === "whiskey" ||
              item.category === "vodka" ||
              item.category === "rum") && (
              <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/[0.08] border border-amber-500/[0.12]">
                <p className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                  Perfect Pairing
                </p>
                <p className="text-white/50 text-sm">
                  Try with a mixer or ice for the perfect serve
                </p>
              </div>
            )}

            {/* Price + quantity */}
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/[0.07]">
              <div>
                <p className="text-white/35 text-xs font-semibold uppercase tracking-wider">Price</p>
                <p className="text-amber-400 text-2xl font-extrabold mt-0.5 tracking-tight">
                  KES {item.price.toLocaleString()}
                </p>
              </div>

              {quantity > 0 && (
                <div className="flex items-center gap-4">
                  <button
                    onClick={onRemove}
                    className="h-11 w-11 rounded-full border-2 border-white/[0.12] text-white flex items-center justify-center active:scale-90 transition-all hover:border-white/30"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <span className="text-white text-xl font-extrabold min-w-[2rem] text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={onAdd}
                    className="h-11 w-11 rounded-full bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center active:scale-90 transition-all"
                  >
                    <Plus className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* CTA */}
          <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 flex-shrink-0 border-t border-white/[0.06]">
            {item.inStock ? (
              <button
                onClick={onAdd}
                className="w-full h-14 rounded-2xl font-bold text-[15px] bg-gradient-to-r from-amber-500 to-amber-400 text-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl shadow-amber-500/25"
              >
                <Plus className="h-5 w-5" strokeWidth={2.5} />
                {quantity > 0 ? `Add Another (${quantity} in cart)` : "Add to Order"}
              </button>
            ) : (
              <div className="w-full h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <p className="text-red-400 font-semibold text-sm">Currently Out of Stock</p>
              </div>
            )}
          </div>
        </motion.div>
      </SheetContent>
    </Sheet>
  )
})
