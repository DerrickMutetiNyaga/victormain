"use client"

import React, { memo, useEffect, useRef, useState, useCallback } from "react"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Plus, Minus, X, Flame } from "lucide-react"
import Image from "next/image"
import { MenuItem } from "@/types/menu"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import {
  eyebrowFor,
  tastingNotesFor,
  pairingFor,
  servingLabel,
} from "./product-meta"
import styles from "./product-sheet.module.css"

interface ProductSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: MenuItem | null
  quantity: number
  servings?: MenuItem[]
  onSelectServing?: (item: MenuItem) => void
  /** Confirm qty for the active SKU (add or update) */
  onConfirm: (item: MenuItem, quantity: number) => void
  onRemoveFromOrder?: (itemId: string) => void
}

export const ProductSheet = memo(function ProductSheet({
  open,
  onOpenChange,
  item,
  quantity,
  servings = [],
  onSelectServing,
  onConfirm,
  onRemoveFromOrder,
}: ProductSheetProps) {
  const [isDesktop, setIsDesktop] = useState(false)
  const [localQty, setLocalQty] = useState(1)
  const [flash, setFlash] = useState(false)
  const [parallax, setParallax] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const apply = () => setIsDesktop(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    if (open) {
      setLocalQty(Math.max(1, quantity || 1))
      setFlash(false)
      setParallax(0)
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    }
  }, [open, item?.id, quantity])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setParallax(el.scrollTop * 0.5)
  }, [])

  if (!item) return null

  const options = servings.length > 1 ? servings : []
  const unitPrice = Number(item.price) || 0
  const lineTotal = unitPrice * localQty
  const inOrder = quantity > 0
  const eyebrow = eyebrowFor(item)
  const notes = tastingNotesFor(item)
  const pairing = pairingFor(item)

  const handleConfirm = () => {
    if (!item.inStock) return
    setFlash(true)
    onConfirm(item, localQty)
    setTimeout(() => {
      onOpenChange(false)
      setFlash(false)
    }, 320)
  }

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={styles.panel}
    >
      <div ref={scrollRef} className={styles.scroll} onScroll={onScroll}>
        <div className={styles.hero}>
          <div className={styles.handle} />
          <motion.div
            layoutId={`product-image-${item.id}`}
            className={styles.heroImageWrap}
            style={{ transform: `translateY(${parallax}px)` }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <Image
              src={item.image || "/placeholder.jpg"}
              alt={item.name}
              fill
              className={styles.heroImage}
              sizes="100vw"
              priority
            />
            <div className={styles.heroWarm} />
          </motion.div>
          <div className={styles.heroScrim} />

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={styles.close}
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>

          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        </div>

        <div className={styles.info}>
          {isDesktop ? (
            <DialogTitle className="sr-only">{item.name}</DialogTitle>
          ) : (
            <SheetTitle className="sr-only">{item.name}</SheetTitle>
          )}

          <div className={styles.titleRow}>
            <h2 className={styles.title}>{item.name}</h2>
            <span key={unitPrice} className={styles.price}>
              KES {unitPrice.toLocaleString()}
            </span>
          </div>

          <p className={styles.desc}>{notes}</p>

          {item.isJaba && (
            <p className={styles.houseNote}>From the bar — house recommendation</p>
          )}

          {options.length > 0 && (
            <div className={styles.servings} role="radiogroup" aria-label="Serving">
              {options.map((opt) => {
                const selected = opt.id === item.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!opt.inStock && !selected}
                    className={cn(styles.serving, selected && styles.servingSelected)}
                    onClick={() => onSelectServing?.(opt)}
                  >
                    {selected && (
                      <motion.div
                        layoutId="serving-pill"
                        className={styles.servingPill}
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span className={styles.servingLabel} style={{ position: "relative", zIndex: 1 }}>
                      {servingLabel(opt)}
                    </span>
                    <span className={styles.servingPrice} style={{ position: "relative", zIndex: 1 }}>
                      KES {(Number(opt.price) || 0).toLocaleString()}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <p className={styles.pairing}>
            <Flame className={cn("h-3.5 w-3.5", styles.pairingIcon)} />
            {pairing}
          </p>
        </div>
      </div>

      <div className={styles.actionBar}>
        {!item.inStock ? (
          <div className={styles.oosBox}>Currently out of stock</div>
        ) : (
          <>
            <div className={styles.actionRow}>
              <div className={styles.stepper}>
                <button
                  type="button"
                  className={styles.stepBtn}
                  aria-label="Decrease quantity"
                  disabled={localQty <= 1 && !inOrder}
                  onClick={() => setLocalQty((q) => Math.max(1, q - 1))}
                >
                  <Minus className="h-4 w-4" strokeWidth={2.5} />
                </button>
                <span key={localQty} className={styles.stepCount}>
                  {localQty}
                </span>
                <button
                  type="button"
                  className={styles.stepBtn}
                  aria-label="Increase quantity"
                  onClick={() => setLocalQty((q) => q + 1)}
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>

              <button
                type="button"
                onClick={handleConfirm}
                className={cn(styles.cta, flash && styles.ctaFlash)}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={`${inOrder ? "u" : "a"}-${lineTotal}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className={styles.ctaTotal}
                  >
                    {inOrder ? "Update order" : "Add"}
                    {" · "}
                    KES {lineTotal.toLocaleString()}
                  </motion.span>
                </AnimatePresence>
              </button>
            </div>

            {inOrder && onRemoveFromOrder && (
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => {
                  onRemoveFromOrder(item.id)
                  onOpenChange(false)
                }}
              >
                Remove
              </button>
            )}
          </>
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
        overlayClassName="bg-[rgba(10,8,6,0.6)]"
      >
        {content}
      </SheetContent>
    </Sheet>
  )
})
