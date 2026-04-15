"use client"

import React, { memo } from "react"
import Image from "next/image"
import { Plus } from "lucide-react"
import { MenuItem } from "@/types/menu"

interface PopularRowProps {
  items: MenuItem[]
  onItemClick: (item: MenuItem) => void
  onAddItem: (item: MenuItem) => void
}

export const PopularRow = memo(function PopularRow({
  items,
  onItemClick,
  onAddItem,
}: PopularRowProps) {
  // Prefer Jaba items; fall back to first 10 products so the section is always visible
  const jabaItems = items.filter((i) => i.isJaba === true)
  const displayItems = (jabaItems.length > 0 ? jabaItems : items).slice(0, 8)
  const isJabaMode = jabaItems.length > 0

  if (displayItems.length === 0) return null

  return (
    <section className="pt-3 pb-4">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-5">
        <div className="mb-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300">
              {isJabaMode ? "House Selections" : "Featured Drinks"}
            </p>
          </div>
        </div>
      </div>

      <div className="relative">
        <div
          className="flex gap-3 pl-4 pr-4 sm:pl-5 sm:pr-5 overflow-x-auto scrollbar-hide"
          style={{
            flexWrap: "nowrap",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
            scrollSnapType: "x mandatory",
          }}
        >
          {displayItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onItemClick(item)}
              className="group w-[160px] sm:w-[172px] shrink-0 rounded-2xl overflow-hidden border border-white/[0.08] bg-[#111827]/78 text-left shadow-[0_8px_20px_rgba(0,0,0,0.26)] snap-start"
            >
              <div className="relative aspect-[5/4] bg-[#1f2937]">
                <Image
                  src={item.image || "/placeholder.jpg"}
                  alt={item.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  sizes="172px"
                />
              </div>
              <div className="p-3">
                <p className="text-white text-[13px] font-semibold line-clamp-1">{item.name}</p>
                <p className="text-white/55 text-[11px] mt-0.5 line-clamp-1">{item.description}</p>
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="text-amber-400 text-[13px] font-bold">
                    KES {item.price.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (item.inStock) onAddItem(item)
                    }}
                    className="h-7 min-w-[64px] px-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 text-black text-[11px] font-semibold flex items-center justify-center gap-1 disabled:opacity-35"
                    disabled={!item.inStock}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
})
