"use client"

import React, { memo } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Plus, Minus, X } from "lucide-react"
import Image from "next/image"
import { MenuItem } from "@/types/menu"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import styles from "./product-sheet.module.css"

interface ProductSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: MenuItem | null
  quantity: number
  onAdd: () => void
  onRemove: () => void
}

const tagConfig: Record<string, { label: string; className: string }> = {
  popular: { label: "Popular", className: styles.tagPopular },
  "best-seller": { label: "Best Seller", className: styles.tagGold },
  "premium-pick": { label: "Premium", className: styles.tagGold },
  "house-favorite": { label: "House Fav", className: styles.tagOxblood },
  "staff-pick": { label: "Staff Pick", className: styles.tagGold },
  "best-value": { label: "Best Value", className: styles.tagPopular },
}

export const ProductSheet = memo(function ProductSheet({
  open,
  onOpenChange,
  item,
  quantity,
  onAdd,
  onRemove,
}: ProductSheetProps) {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const apply = () => setIsDesktop(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  if (!item) return null

  const tag = item.tag ? tagConfig[item.tag] : null

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={styles.panel}
    >
      <div className={styles.hero}>
        <div className={styles.handle} />
        <Image
          src={item.image || "/placeholder.jpg"}
          alt={item.name}
          fill
          className={styles.heroImage}
          sizes="100vw"
          priority
        />
        <div className={styles.heroFade} />

        <button
          onClick={() => onOpenChange(false)}
          className={styles.close}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {tag && (
          <span className={cn(styles.tag, tag.className)}>{tag.label}</span>
        )}
      </div>

      <div className={styles.content}>
        <SheetHeader>
          {item.brand && <p className={styles.brand}>{item.brand}</p>}
          <SheetTitle className={styles.title}>{item.name}</SheetTitle>
        </SheetHeader>

        <p className={styles.desc}>{item.description}</p>

        <div className={styles.priceBox}>
          <p className={styles.priceLabel}>Price</p>
          <p className={styles.priceValue}>
            KES {(Number(item.price) || 0).toLocaleString()}
          </p>
        </div>

        <div className={styles.qtyRow}>
          <div>
            <p className={styles.qtyLabel}>Quantity</p>
            <p className={styles.qtyValue}>{quantity} in order</p>
          </div>

          <div className={styles.qtyControls}>
            <button
              onClick={onRemove}
              disabled={quantity <= 0}
              className={styles.qtyBtn}
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className={styles.qtyNum}>{quantity}</span>
            <button onClick={onAdd} className={styles.qtyBtnAdd}>
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        {item.inStock ? (
          <button onClick={onAdd} className={styles.addCta}>
            <Plus className="h-5 w-5" strokeWidth={2.5} />
            {quantity > 0
              ? `Add Another (${quantity} in order)`
              : "Add to Order"}
          </button>
        ) : (
          <div className={styles.oosBox}>
            <p className={styles.oosText}>Currently Out of Stock</p>
          </div>
        )}
      </div>
    </motion.div>
  )

  return isDesktop ? (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={styles.dialogShell}
        aria-describedby={undefined}
      >
        {content}
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showClose={false}
        className={styles.sheetShell}
      >
        {content}
      </SheetContent>
    </Sheet>
  )
})
