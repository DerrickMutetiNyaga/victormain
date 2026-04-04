"use client"

import React, { useRef } from "react"
import { MenuItem } from "@/types/menu"
import { MenuProductCard } from "./MenuProductCard"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FeaturedCarouselProps {
  items: MenuItem[]
  onItemClick: (item: MenuItem) => void
  onAdd: (item: MenuItem) => void
  onUpdateQuantity: (item: MenuItem, delta: number) => void
  getQuantity: (id: string) => number
}

export function FeaturedCarousel({
  items,
  onItemClick,
  onAdd,
  onUpdateQuantity,
  getQuantity,
}: FeaturedCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return
    const step = 180
    scrollRef.current.scrollBy({
      left: dir === "left" ? -step : step,
      behavior: "smooth",
    })
  }

  if (items.length === 0) return null

  return (
    <section className="pt-6 pb-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-900">Featured</h2>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-slate-500"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-slate-500"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-1 snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="w-[140px] sm:w-[160px] shrink-0 snap-start"
          >
            <MenuProductCard
              item={item}
              variant="compact"
              onClick={() => onItemClick(item)}
              onAdd={() => onAdd(item)}
              quantity={getQuantity(item.id)}
              onUpdateQuantity={(d) => onUpdateQuantity(item, d)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
