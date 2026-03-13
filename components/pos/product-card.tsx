"use client"

import React, { memo } from "react"
import Image from "next/image"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Product } from "@/lib/dummy-data"

interface ProductCardProps {
  product: Product & { size?: string }
  inCart?: { quantity: number }
  onAddToCart: (product: Product & { size?: string }) => void
}

export const POSProductCard = memo(function POSProductCard({
  product,
  inCart,
  onAddToCart,
}: ProductCardProps) {
  const isLowStock = product.stock < product.minStock
  const productSize = product.size || ''
  const uniqueId = productSize ? `${product.id}-${productSize}` : product.id

  return (
    <button
      onClick={() => onAddToCart(product)}
      className={cn(
        "group relative flex flex-col rounded-xl bg-card border border-border overflow-hidden transition-all duration-200",
        "hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] touch-manipulation",
        "min-w-0 w-full h-full focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-2",
        inCart && "ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-background bg-emerald-50/50 border-emerald-500/40",
      )}
    >
      {/* Image - fixed aspect ratio, no stretching */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        <Image
          src={product.image || "/placeholder.svg?height=150&width=200&query=drink bottle"}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
          loading="lazy"
          unoptimized={product.image?.startsWith('/placeholder')}
        />

        {/* Quantity badge if in cart */}
        {inCart && (
          <div className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center z-20">
            {inCart.quantity}
          </div>
        )}

        {/* Low stock - smaller, top-left */}
        {isLowStock && (
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-destructive text-destructive-foreground text-[9px] font-bold z-20">
            Low
          </div>
        )}

        {/* Size badge */}
        {productSize && (
          <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-emerald-600/90 text-white text-[9px] font-bold z-20">
            {productSize}
          </div>
        )}

        {/* Jaba badge - smaller, top-right when not in cart */}
        {product.isJaba && !inCart && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-bold z-20">
            Jaba
          </div>
        )}
      </div>

      {/* Info - compact, prominent price */}
      <div className="p-2 flex-1 flex flex-col bg-card min-h-0 border-t border-border/50">
        <div className="mb-1 flex-shrink-0">
          <h3 className="text-sm font-bold text-foreground line-clamp-2 text-left leading-tight">
            {product.name}
          </h3>
          {productSize && (
            <div className="mt-0.5 flex items-center gap-1">
              <span className="text-[9px] font-semibold text-muted-foreground uppercase">Size:</span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                {productSize}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-end justify-between mt-auto pt-1.5 border-t border-border/30 flex-shrink-0 min-h-[48px]">
          <div className="flex flex-col items-start min-w-0 flex-1">
            <div className="flex items-baseline gap-0.5">
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Ksh</span>
              <span className="text-base font-extrabold text-emerald-700 leading-none tabular-nums">
                {product.price.toLocaleString("en-KE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <span className="text-[9px] text-muted-foreground font-medium mt-0.5">{product.stock} in stock</span>
          </div>
          {/* Add button - min 44px touch target, prominent */}
          <div className="h-11 w-11 min-h-[44px] min-w-[44px] flex-shrink-0 rounded-xl bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center transition-all touch-manipulation ml-2">
            <Plus className="h-5 w-5 text-emerald-700" />
          </div>
        </div>
      </div>
    </button>
  )
}, (prevProps, nextProps) => {
  // Only re-render if product data or cart status actually changed
  const prevInCart = prevProps.inCart
  const nextInCart = nextProps.inCart
  
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.price === nextProps.product.price &&
    prevProps.product.stock === nextProps.product.stock &&
    prevProps.product.image === nextProps.product.image &&
    prevProps.product.size === nextProps.product.size &&
    prevInCart?.quantity === nextInCart?.quantity
  )
})

