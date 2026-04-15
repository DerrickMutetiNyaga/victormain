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
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const apply = () => setIsDesktop(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col h-full bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12),transparent_55%),#111827]"
    >
      <div className="relative h-56 w-full overflow-hidden bg-[#0f172a] flex-shrink-0">
        <div className="absolute top-0 left-0 right-0 flex justify-center pt-3 pb-1 z-30 pointer-events-none md:hidden">
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
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#111827] to-transparent" />

        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 h-10 w-10 rounded-full bg-black/45 border border-white/15 backdrop-blur-sm text-white flex items-center justify-center z-20 active:scale-90 transition-transform"
        >
          <X className="h-5 w-5" />
        </button>

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

        <p className="text-white/55 text-sm leading-relaxed mt-3">
          {item.description}
        </p>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-white/35 text-[11px] font-semibold uppercase tracking-[0.16em]">Price</p>
          <p className="text-amber-400 text-2xl font-extrabold mt-1 tracking-tight">
            KES {item.price.toLocaleString()}
          </p>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.07]">
          <div>
            <p className="text-white/45 text-xs font-semibold uppercase tracking-[0.16em]">Quantity</p>
            <p className="text-white text-lg font-bold mt-1">
              {quantity} in order
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onRemove}
              disabled={quantity <= 0}
              className="h-11 w-11 rounded-xl border border-white/[0.16] bg-white/[0.02] text-white flex items-center justify-center active:scale-90 transition-all hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="text-white text-xl font-extrabold min-w-[2rem] text-center">
              {quantity}
            </span>
            <button
              onClick={onAdd}
              className="h-11 w-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black flex items-center justify-center active:scale-90 transition-all"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 flex-shrink-0 border-t border-white/[0.08] bg-[#0f172a]/65 backdrop-blur-xl">
        {item.inStock ? (
          <button
            onClick={onAdd}
            className="w-full h-14 rounded-2xl font-bold text-[15px] bg-gradient-to-r from-amber-500 to-amber-400 text-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl shadow-amber-500/25"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
            {quantity > 0 ? `Add Another (${quantity} in order)` : "Add to Order"}
          </button>
        ) : (
          <div className="w-full h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <p className="text-red-400 font-semibold text-sm">Currently Out of Stock</p>
          </div>
        )}
      </div>
    </motion.div>
  )

  return (
    isDesktop ? (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="p-0 overflow-hidden border border-white/[0.1] bg-[#13131E] max-w-xl rounded-3xl"
        >
          {content}
        </DialogContent>
      </Dialog>
    ) : (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showClose={false}
          className="p-0 overflow-hidden rounded-t-3xl border-t border-white/[0.08] bg-[#13131E] max-h-[88vh]"
        >
          {content}
        </SheetContent>
      </Sheet>
    )
  )
})
