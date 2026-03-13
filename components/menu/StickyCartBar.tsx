"use client"

import React, { memo } from "react"
import { ShoppingCart, ArrowRight } from "lucide-react"
import { CartItem } from "@/types/menu"
import { motion, AnimatePresence } from "framer-motion"

interface StickyCartBarProps {
  items: CartItem[]
  total: number
  onOpenCart: () => void
}

export const StickyCartBar = memo(function StickyCartBar({
  items,
  total,
  onOpenCart,
}: StickyCartBarProps) {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <AnimatePresence>
      {itemCount > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 220 }}
          className="fixed bottom-0 inset-x-0 z-50 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2"
        >
          <button
            onClick={onOpenCart}
            className="w-full h-[62px] rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-black flex items-center justify-between px-5 shadow-2xl shadow-amber-500/40 active:scale-[0.98] transition-transform"
          >
            {/* Left: icon + info */}
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 rounded-xl bg-black/15 flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="h-5 w-5 text-black" />
                <span className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1 rounded-full bg-black text-amber-400 text-[10px] font-bold flex items-center justify-center">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              </div>
              <div className="text-left">
                <p className="text-[13px] font-bold text-black leading-none">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </p>
                <p className="text-[11px] font-semibold text-black/70 mt-0.5">
                  KES {total.toLocaleString()} <span className="text-black/50">incl. VAT</span>
                </p>
              </div>
            </div>

            {/* Right: CTA */}
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-bold text-black">View Cart</span>
              <ArrowRight className="h-4 w-4 text-black" strokeWidth={2.5} />
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
