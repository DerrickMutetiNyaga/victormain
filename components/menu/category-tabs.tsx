"use client"

import React, { memo, useRef, useEffect } from "react"
import { MenuCategory } from "@/types/menu"
import { Leaf } from "lucide-react"
import { cn } from "@/lib/utils"
import styles from "./category-tabs.module.css"

interface CategoryTabsProps {
  categories: MenuCategory[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
  onJabaClick?: () => void
  hasJaba?: boolean
}

const shortLabelMap: Record<string, string> = {
  "soft-drinks": "Soft",
  "energy-drinks": "Energy",
  cocktails: "Mixes",
  whiskey: "Whisky",
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
                <Leaf className="h-3.5 w-3.5 opacity-80" />
                Jaba
              </button>
              <span className={styles.divider} aria-hidden />
            </>
          )}

          {allCategories.map((cat) => {
            const isActive = selectedCategory === cat.id

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
                <span>{shortLabelMap[cat.id] ?? cat.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
})
