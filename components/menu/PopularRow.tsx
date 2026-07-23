"use client"

import React, { memo } from "react"
import Image from "next/image"
import { Plus } from "lucide-react"
import { MenuItem } from "@/types/menu"
import styles from "./popular-row.module.css"

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
  const jabaItems = items.filter((i) => i.isJaba === true)
  const displayItems = (jabaItems.length > 0 ? jabaItems : items).slice(0, 8)
  const isJabaMode = jabaItems.length > 0

  if (displayItems.length === 0) return null

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>
          <span className={styles.dot} />
          <p className={styles.label}>
            {isJabaMode ? "House Selections" : "Featured Drinks"}
          </p>
        </div>
      </div>

      <div className={styles.scroll}>
        {displayItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemClick(item)}
            className={styles.card}
          >
            <div className={styles.imageWrap}>
              <Image
                src={item.image || "/placeholder.jpg"}
                alt={item.name}
                fill
                className={styles.image}
                sizes="172px"
              />
            </div>
            <div className={styles.body}>
              <p className={styles.name}>{item.name}</p>
              <p className={styles.desc}>{item.description}</p>
              <div className={styles.row}>
                <span className={styles.price}>
                  KES {item.price.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (item.inStock) onAddItem(item)
                  }}
                  className={styles.addBtn}
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
    </section>
  )
})
