"use client"

import React, { useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, ArrowUpDown } from "lucide-react"
import { MenuCategory } from "@/types/menu"
import { cn } from "@/lib/utils"

const categoryEmojis: Record<string, string> = {
  all: "✨",
  whiskey: "🥃",
  vodka: "🍸",
  gin: "🍸",
  rum: "🥃",
  brandy: "🍷",
  beer: "🍺",
  wine: "🍷",
  "soft-drinks": "🥤",
  "energy-drinks": "⚡",
}

type SortOption = "default" | "price" | "popular"

interface MenuSearchFiltersProps {
  searchQuery: string
  onSearchChange: (v: string) => void
  categories: MenuCategory[]
  selectedCategory: string
  onCategoryChange: (id: string) => void
  sort: SortOption
  onSortChange: (s: SortOption) => void
}

export function MenuSearchFilters({
  searchQuery,
  onSearchChange,
  categories,
  selectedCategory,
  onCategoryChange,
  sort,
  onSortChange,
}: MenuSearchFiltersProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      selectedRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
    }
  }, [selectedCategory])

  return (
    <div className="sticky top-[88px] sm:top-[100px] z-40 bg-[#f7f7f8]/95 backdrop-blur-sm -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-3 pb-4 border-b border-slate-200/60">
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search drinks…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-11 h-11 rounded-xl border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500/20"
        />
      </div>

      {/* Category pills + Sort */}
      <div className="flex items-center gap-3">
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div className="flex gap-2 pb-1 min-w-max">
            <Button
              ref={selectedCategory === "all" ? selectedRef : null}
              variant="ghost"
              size="sm"
              onClick={() => onCategoryChange("all")}
              className={cn(
                "rounded-full h-9 px-4 text-sm font-medium shrink-0 snap-start",
                selectedCategory === "all"
                  ? "bg-slate-900 text-white hover:bg-slate-800 hover:text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              {categoryEmojis.all} All
            </Button>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id
              return (
                <Button
                  key={cat.id}
                  ref={isSelected ? selectedRef : null}
                  variant="ghost"
                  size="sm"
                  onClick={() => onCategoryChange(cat.id)}
                  className={cn(
                    "rounded-full h-9 px-4 text-sm font-medium shrink-0 snap-start",
                    isSelected
                      ? "bg-slate-900 text-white hover:bg-slate-800 hover:text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  {categoryEmojis[cat.id] || "🍸"} {cat.name}
                </Button>
              )
            })}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 h-9 px-3 text-slate-500 hover:text-slate-700 rounded-lg"
          onClick={() =>
            onSortChange(
              sort === "price" ? "popular" : sort === "popular" ? "default" : "price"
            )
          }
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
