"use client"

import React, { memo, useRef, useEffect } from "react"
import { MenuCategory } from "@/types/menu"
import {
  Leaf,
  Beer,
  Wine,
  Martini,
  CupSoda,
  Zap,
  GlassWater,
  LayoutGrid,
} from "lucide-react"
import { cn } from "@/lib/utils"
import styles from "./category-tabs.module.css"

interface CategoryTabsProps {
  categories: MenuCategory[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
  onJabaClick?: () => void
  hasJaba?: boolean
  counts?: Record<string, number>
  totalCount?: number
}

const shortLabelMap: Record<string, string> = {
  "soft-drinks": "Soft",
  "energy-drinks": "Energy",
  cocktails: "Mixes",
  whiskey: "Whisky",
}

function CategoryGlyph({ id }: { id: string }) {
  const props = { className: styles.glyph, strokeWidth: 2 } as const
  const key = id.toLowerCase()
  if (key === "all") return <LayoutGrid {...props} />
  if (key.includes("cider")) return <Wine {...props} />
  if (key.includes("beer")) return <Beer {...props} />
  if (key.includes("tequila") || key.includes("mezcal")) return <Martini {...props} />
  if (key.includes("whisky") || key.includes("whiskey") || key.includes("spirit"))
    return <GlassWater {...props} />
  if (key.includes("cocktail") || key.includes("mix")) return <Martini {...props} />
  if (key.includes("soft") || key.includes("juice")) return <Leaf {...props} />
  if (key.includes("energy")) return <Zap {...props} />
  if (key.includes("soda") || key.includes("water")) return <CupSoda {...props} />
  return <Wine {...props} />
}

export const CategoryTabs = memo(function CategoryTabs({
  categories,
  selectedCategory,
  onCategoryChange,
  onJabaClick,
  hasJaba = false,
  counts = {},
  totalCount = 0,
}: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

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
    <div className={styles.wrap}>
      <div className={styles.track}>
        <div className={styles.fadeLeft} />
        <div className={styles.fadeRight} />

        <div ref={scrollRef} className={styles.scroll}>
          {hasJaba && (
            <>
              <button
                type="button"
                onClick={onJabaClick}
                className={styles.jaba}
              >
                <Leaf className={styles.glyph} />
                Jaba
              </button>
              <span className={styles.divider} aria-hidden />
            </>
          )}

          {allCategories.map((cat) => {
            const isActive = selectedCategory === cat.id
            const label = shortLabelMap[cat.id] ?? cat.name
            const count = cat.id === "all" ? totalCount : (counts[cat.id] ?? 0)

            return (
              <button
                key={cat.id}
                ref={isActive ? activeRef : undefined}
                type="button"
                onClick={() => onCategoryChange(cat.id)}
                className={cn(
                  styles.pill,
                  isActive ? styles.pillActive : styles.pillIdle
                )}
              >
                {!isActive && <CategoryGlyph id={cat.id} />}
                <span>
                  {isActive && count > 0 ? `${label} · ${count}` : label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
})
