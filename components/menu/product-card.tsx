"use client"

import React, { memo } from "react"
import Image from "next/image"
import { Plus, Minus } from "lucide-react"
import { MenuItem } from "@/types/menu"
import styles from "./product-card.module.css"

interface ProductCardProps {
  item: MenuItem
  quantity?: number
  onAdd: (item: MenuItem) => void
  onUpdateQuantity?: (id: string, quantity: number) => void
  onClick?: (item: MenuItem) => void
}

export const ProductCard = memo(function ProductCard({
  item,
  quantity = 0,
  onAdd,
  onUpdateQuantity,
  onClick,
}: ProductCardProps) {
  const inCart = quantity > 0

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
        <p className={styles.desc}>{item.description || "\u00A0"}</p>
        <div className={styles.footer}>
          <span className={styles.price}>
            KES {(Number(item.price) || 0).toLocaleString()}
          </span>
          {inCart && onUpdateQuantity ? (
            <div
              className={styles.stepper}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={styles.stepBtn}
                aria-label="Decrease quantity"
                onClick={() => onUpdateQuantity(item.id, quantity - 1)}
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
              <span className={styles.stepCount}>{quantity}</span>
              <button
                type="button"
                className={styles.stepBtn}
                aria-label="Increase quantity"
                onClick={() => onUpdateQuantity(item.id, quantity + 1)}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  )
})
