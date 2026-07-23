"use client"

import React, { memo, useEffect, useRef, useState } from "react"
import { ShoppingCart } from "lucide-react"
import { CartItem } from "@/types/menu"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
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
  const [pulse, setPulse] = useState(false)
  const prevCount = useRef(itemCount)

  useEffect(() => {
    if (itemCount > prevCount.current) {
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 700)
      prevCount.current = itemCount
      return () => clearTimeout(t)
    }
    prevCount.current = itemCount
  }, [itemCount])

  return (
    <AnimatePresence>
      {itemCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={styles.bar}
        >
          <button
            onClick={onOpenCart}
            className={cn(styles.button, pulse && styles.buttonPulse)}
          >
            <div className={styles.left}>
              <div className={styles.iconWrap}>
                <ShoppingCart className="h-4 w-4" />
              </div>
              <p className={styles.summary}>
                {itemCount} {itemCount === 1 ? "item" : "items"} · KES{" "}
                {(Number(total) || 0).toLocaleString()}
              </p>
            </div>
            <div className={styles.cta}>
              <span>View Order →</span>
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
