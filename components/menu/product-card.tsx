"use client"

import React, { memo } from "react"
import Image from "next/image"
import { Plus } from "lucide-react"
import { MenuItem } from "@/types/menu"

interface ProductCardProps {
  item: MenuItem
  onAdd: (item: MenuItem) => void
  onClick?: (item: MenuItem) => void
}

export const ProductCard = memo(function ProductCard({
  item,
  onAdd,
  onClick,
}: ProductCardProps) {
  return (
    <div
      className="group relative h-full rounded-3xl overflow-hidden bg-[#111827]/78 border border-white/[0.07] cursor-pointer active:scale-[0.985] transition-all duration-200 select-none shadow-[0_10px_26px_rgba(0,0,0,0.3)] hover:border-amber-300/20"
      onClick={() => onClick?.(item)}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_60%)]" />

      {/* Image section */}
      <div className="relative aspect-[5/4] bg-gradient-to-b from-[#1f2937] to-[#111827] overflow-hidden">
        <Image
          src={item.image || "/placeholder.jpg"}
          alt={item.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={item.isPopular}
        />

        {/* Bottom fade into card body */}
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#111827] to-transparent" />

        {/* Out of stock overlay */}
        {!item.inStock && (
          <div className="absolute inset-0 bg-black/65 flex items-center justify-center z-10">
            <span className="text-white/85 text-[11px] font-semibold bg-black/55 px-3 py-1 rounded-full border border-white/10">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Content body */}
      <div className="px-3.5 pt-3 pb-3.5 flex min-h-[112px] flex-col relative z-10">
        <h3 className="text-white text-[13px] sm:text-[14px] font-semibold leading-snug line-clamp-2 min-h-[2.35rem]">
          {item.name}
        </h3>
        <p className="text-[11px] text-white/52 mt-1 line-clamp-1 min-h-[16px]">
          {item.description || ""}
        </p>
        <div className="flex items-end justify-between mt-auto pt-2 gap-2">
          <span className="text-amber-400 font-bold text-sm">
            KES {item.price.toLocaleString()}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (item.inStock) onAdd(item)
            }}
            disabled={!item.inStock}
            aria-label={`Add ${item.name} to cart`}
            className="h-8 min-w-[78px] px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-black flex items-center justify-center gap-1.5 transition-all duration-150 flex-shrink-0 shadow-lg shadow-amber-500/20 font-semibold text-[11px]"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add
          </button>
        </div>
      </div>
    </div>
  )
})
