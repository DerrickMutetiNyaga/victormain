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
          className="fixed bottom-0 inset-x-0 z-50 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-2"
        >
          <button
            onClick={onOpenCart}
            className="mx-auto w-full max-w-screen-md h-[54px] rounded-xl bg-[#0f172a]/92 border border-white/10 backdrop-blur-xl text-white flex items-center justify-between px-4 shadow-xl shadow-black/30 active:scale-[0.985] transition-transform"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative h-8 w-8 rounded-lg bg-amber-400/12 border border-amber-300/20 flex items-center justify-center shrink-0">
                <ShoppingCart className="h-4 w-4 text-amber-300" />
              </div>
              <p className="text-[13px] font-semibold text-white/95 truncate">
                {itemCount} {itemCount === 1 ? "item" : "items"} · KES {total.toLocaleString()}
              </p>
            </div>

            {/* Right: CTA */}
            <div className="flex items-center gap-1 text-amber-300">
              <span className="text-[13px] font-bold">View Order</span>
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
