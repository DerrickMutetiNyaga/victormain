"use client"

import React, { memo } from "react"
import { ShoppingCart, ArrowRight } from "lucide-react"
import { CartItem } from "@/types/menu"
import { motion, AnimatePresence } from "framer-motion"
import styles from "./sticky-cart-bar.module.css"

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
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className={styles.bar}
        >
          <button onClick={onOpenCart} className={styles.button}>
            <div className={styles.left}>
              <div className={styles.iconWrap}>
                <ShoppingCart className="h-4 w-4" />
              </div>
              <p className={styles.summary}>
                {itemCount} {itemCount === 1 ? "item" : "items"} · KES{" "}
                {total.toLocaleString()}
              </p>
            </div>
            <div className={styles.cta}>
              <span>View Order</span>
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
