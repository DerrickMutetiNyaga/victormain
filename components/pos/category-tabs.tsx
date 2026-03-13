"use client"

import { cn } from "@/lib/utils"
import { categories } from "@/lib/dummy-data"

interface CategoryTabsProps {
  selectedCategory: string
  onSelect: (id: string) => void
}

export function CategoryTabs({ selectedCategory, onSelect }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <button
        onClick={() => onSelect("all")}
        className={cn(
          "flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
          selectedCategory === "all"
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        )}
      >
        All Items
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onSelect(category.id)}
          className={cn(
            "flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
            selectedCategory === category.id
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          )}
        >
          <span>{category.icon}</span>
          {category.name}
          <span className="ml-1 rounded-full bg-background/20 px-1.5 py-0.5 text-xs">{category.productCount}</span>
        </button>
      ))}
    </div>
  )
}
