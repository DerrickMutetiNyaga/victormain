"use client"

import React, { memo } from "react"
import Image from "next/image"
import { Plus } from "lucide-react"
import { MenuItem } from "@/types/menu"
import { cn } from "@/lib/utils"

interface ProductCardProps {
  item: MenuItem
  onAdd: (item: MenuItem) => void
  onClick?: (item: MenuItem) => void
}

const tagConfig: Record<string, { label: string; className: string }> = {
  popular: { label: "Popular", className: "bg-amber-500 text-black" },
  "best-seller": { label: "Best Seller", className: "bg-orange-500 text-white" },
  "premium-pick": { label: "Premium", className: "bg-purple-500 text-white" },
  "house-favorite": { label: "House Fav", className: "bg-rose-500 text-white" },
  "staff-pick": { label: "Staff Pick", className: "bg-sky-500 text-white" },
  "best-value": { label: "Best Value", className: "bg-emerald-500 text-white" },
}

export const ProductCard = memo(function ProductCard({
  item,
  onAdd,
  onClick,
}: ProductCardProps) {
  const tag = item.tag ? tagConfig[item.tag] : null

  return (
    <div
      className="relative rounded-2xl overflow-hidden bg-[#13131E] border border-white/[0.07] cursor-pointer active:scale-[0.96] transition-transform duration-100 select-none"
      onClick={() => onClick?.(item)}
    >
      {/* Image section */}
      <div className="relative aspect-[3/4] bg-[#1C1C2C] overflow-hidden">
        <Image
          src={item.image || "/placeholder.jpg"}
          alt={item.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={item.isPopular}
        />

        {/* Bottom fade into card body */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#13131E] to-transparent" />

        {/* Tag badge */}
        {tag && (
          <span
            className={cn(
              "absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide z-10",
              tag.className
            )}
          >
            {tag.label}
          </span>
        )}

        {/* Out of stock overlay */}
        {!item.inStock && (
          <div className="absolute inset-0 bg-black/65 flex items-center justify-center z-10">
            <span className="text-white/80 text-[11px] font-semibold bg-black/50 px-3 py-1 rounded-full">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Content body */}
      <div className="px-3 pt-2 pb-3">
        {item.brand && (
          <p className="text-white/35 text-[9px] font-semibold uppercase tracking-widest truncate">
            {item.brand}
          </p>
        )}
        <h3 className="text-white text-[13px] font-semibold leading-snug mt-0.5 line-clamp-2 min-h-[2.4rem]">
          {item.name}
        </h3>
        <div className="flex items-center justify-between mt-2 gap-1">
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
            className="h-8 w-8 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed text-black flex items-center justify-center transition-all duration-100 flex-shrink-0 shadow-lg shadow-amber-500/25"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  )
})
