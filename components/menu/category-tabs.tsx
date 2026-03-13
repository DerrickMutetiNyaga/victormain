"use client"

import React, { memo, useRef, useEffect } from "react"
import { MenuCategory } from "@/types/menu"
import { Leaf } from "lucide-react"

interface CategoryTabsProps {
  categories: MenuCategory[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
  onJabaClick?: () => void
  hasJaba?: boolean
}

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
  cocktails: "🍹",
}

export const CategoryTabs = memo(function CategoryTabs({
  categories,
  selectedCategory,
  onCategoryChange,
  onJabaClick,
  hasJaba = false,
}: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  // Auto-scroll active pill into centre
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current
      const button = activeRef.current
      const scrollTo =
        button.offsetLeft - container.offsetWidth / 2 + button.offsetWidth / 2
      container.scrollTo({ left: scrollTo, behavior: "smooth" })
    }
  }, [selectedCategory])

  const allCategories = [{ id: "all", name: "All" }, ...categories]

  return (
    <div className="pb-3">
      {/* Single row: Featured + Jaba chip, then category pills (same scroll strip) */}
      <div className="relative">
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10"
          style={{ background: "linear-gradient(90deg, #0d1520 0%, transparent 100%)" }}
        />
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10"
          style={{ background: "linear-gradient(270deg, #0d1520 0%, transparent 100%)" }}
        />

        <div
          ref={scrollRef}
          className="flex items-center gap-2.5 px-4 sm:px-5 overflow-x-auto scrollbar-hide"
          style={{
            flexWrap: "nowrap",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* Featured label + Jaba chip — distinct from category selection */}
          {hasJaba && (
            <>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25 shrink-0 py-2.5">
                Featured
              </span>
              <button
                type="button"
                onClick={onJabaClick}
                className="inline-flex items-center gap-2 py-2.5 px-3.5 rounded-xl text-sm font-semibold shrink-0 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] snap-start"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  color: "rgba(251,191,36,0.95)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <Leaf className="h-3.5 w-3.5 opacity-80" />
                Jaba
              </button>
              {/* Spacer so categories don’t sit right on Jaba */}
              <span className="w-px h-5 bg-white/10 shrink-0" aria-hidden />
            </>
          )}

          {/* Category pills — only selected one is solid gold */}
          {allCategories.map((cat) => {
            const isActive = selectedCategory === cat.id
            const emoji = categoryEmojis[cat.id] || "🍸"

            return (
              <button
                key={cat.id}
                ref={isActive ? activeRef : undefined}
                type="button"
                onClick={() => onCategoryChange(cat.id)}
                className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-all duration-200 active:scale-[0.97] snap-start"
                style={{
                  ...(isActive
                    ? {
                        background: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
                        color: "#0c0a09",
                        border: "none",
                        boxShadow: "0 3px 14px rgba(245,158,11,0.35), 0 1px 0 rgba(255,255,255,0.2) inset",
                      }
                    : {
                        background: "rgba(255,255,255,0.05)",
                        color: "rgba(255,255,255,0.7)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                      }),
                }}
              >
                <span className="text-base leading-none">{emoji}</span>
                <span>{cat.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
})
