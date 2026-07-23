"use client"

import React, { memo } from "react"
import Image from "next/image"
import { Plus } from "lucide-react"
import { MenuItem } from "@/types/menu"
import styles from "./product-card.module.css"

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
      className={styles.card}
      onClick={() => onClick?.(item)}
    >
      <div className={styles.glow} />

      <div className={styles.imageWrap}>
        <Image
          src={item.image || "/placeholder.jpg"}
          alt={item.name}
          fill
          className={styles.image}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={item.isPopular}
        />
        <div className={styles.imageFade} />

        {!item.inStock && (
          <div className={styles.oos}>
            <span className={styles.oosLabel}>Out of Stock</span>
          </div>
        )}
      </div>

      <div className={styles.body}>
        <h3 className={styles.name}>{item.name}</h3>
        <p className={styles.desc}>{item.description || ""}</p>
        <div className={styles.footer}>
          <span className={styles.price}>
            KES {item.price.toLocaleString()}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (item.inStock) onAdd(item)
            }}
            disabled={!item.inStock}
            aria-label={`Add ${item.name} to cart`}
            className={styles.addBtn}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add
          </button>
        </div>
      </div>
    </div>
  )
})
