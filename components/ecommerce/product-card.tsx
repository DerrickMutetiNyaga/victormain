"use client"

import Link from "next/link"
import Image from "next/image"
import { Star, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EcommerceProduct, getProductDisplayName } from "@/lib/ecommerce-data"
import { cn } from "@/lib/utils"
import { memo } from "react"

interface ProductCardProps {
  product: EcommerceProduct
  onAddToCart?: (product: EcommerceProduct) => void
  onBuyNow?: (product: EcommerceProduct) => void
  compact?: boolean
}

export const ProductCard = memo(function ProductCard({ product, onAddToCart, onBuyNow, compact = false }: ProductCardProps) {
  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0

  return (
    <div className={cn(
      "group relative flex flex-col overflow-hidden hover-lift bg-white border border-[#E5E7EB] shadow-sm",
      compact ? "rounded-lg sm:rounded-xl" : "rounded-xl sm:rounded-2xl"
    )}>
      <Link href={`/product/${product.id}`} className="flex-1 flex flex-col">
        {/* Image Container */}
        <div className={cn(
          "relative w-full overflow-hidden bg-gradient-to-br from-[#F3F4F6] to-white",
          compact ? "aspect-[3/4]" : "aspect-[3/4]"
        )}>
          {discount > 0 && (
            <Badge className={cn(
              "absolute z-20 bg-gradient-to-br from-[#B91C1C] to-[#8B1A26] text-white shadow-lg text-[10px] px-1.5 py-0.5",
              compact ? "top-1 left-1" : "top-1.5 left-1.5 sm:top-3 sm:left-3 sm:text-xs sm:px-2 sm:py-1"
            )}>
              -{discount}%
            </Badge>
          )}
          {product.featured && (
            <Badge className={cn(
              "absolute z-20 bg-gradient-to-br from-[#10B981] to-[#0E9F6E] text-white shadow-lg text-[10px] px-1.5 py-0.5",
              compact ? "top-1 right-1" : "top-1.5 right-1.5 sm:top-3 sm:right-3 sm:text-xs sm:px-2 sm:py-1"
            )}>
              ⭐ Featured
            </Badge>
          )}
          {product.trending && (
            <Badge className={cn(
              "absolute z-20 bg-gradient-to-br from-[#B91C1C] to-[#8B1A26] text-white shadow-lg text-[10px] px-1.5 py-0.5",
              compact ? "top-1 right-1" : "top-1.5 right-1.5 sm:top-3 sm:right-3 sm:text-xs sm:px-2 sm:py-1"
            )}>
              🔥 Trending
            </Badge>
          )}
          
          <Image
            src={product.image}
            alt={getProductDisplayName(product)}
            fill
            className="object-cover transition-all duration-300 group-hover:scale-105"
            sizes={compact ? "(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 20vw" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"}
          />
        </div>

        {/* Content */}
        <div className={cn(
          "flex flex-1 flex-col border-t border-[#E5E7EB]",
          compact ? "p-1.5" : "p-2 sm:p-4"
        )}>
          <div className={compact ? "mb-0.5" : "mb-1 sm:mb-2"}>
            <p className={cn(
              "font-bold text-[#10B981] uppercase tracking-wide",
              compact ? "text-[8px] mb-0.5" : "text-[10px] sm:text-xs mb-0.5 sm:mb-1"
            )}>
              {product.category}
            </p>
            <h3 className={cn(
              "font-bold text-[#1F2937] line-clamp-2 group-hover:text-[#10B981] transition-colors font-heading",
              compact ? "text-[11px] leading-tight mb-0.5" : "text-sm sm:text-lg mb-1 sm:mb-2"
            )}>
              {getProductDisplayName(product)}
            </h3>
          </div>

          {/* Rating */}
          <div className={cn(
            "flex items-center gap-0.5 mb-1",
            compact ? "mb-0.5" : "sm:mb-1.5 mb-2 sm:mb-3"
          )}>
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    compact ? "h-2.5 w-2.5" : "h-2.5 w-2.5 sm:h-4 sm:w-4",
                    i < Math.floor(product.rating)
                      ? "fill-[#10B981] text-[#10B981]"
                      : "fill-gray-200 text-gray-200",
                  )}
                />
              ))}
            </div>
            <span className={cn(
              "text-[#6B7280] font-medium ml-0.5",
              compact ? "text-[8px]" : "text-[9px] sm:text-xs sm:ml-1"
            )}>
              ({product.rating})
            </span>
          </div>

          {/* Price */}
          <div className="mt-auto flex items-center justify-between">
            <div>
              <p className={cn(
                "font-bold text-[#1F2937] font-display",
                compact ? "text-[11px] sm:text-xs" : "text-sm sm:text-xl"
              )}>
                KES {product.price.toLocaleString()}
              </p>
              {product.originalPrice && (
                <p className={cn(
                  "text-gray-400 line-through",
                  compact ? "text-[9px]" : "text-[10px] sm:text-sm"
                )}>
                  KES {product.originalPrice.toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Add to Cart / Buy Now Buttons */}
      {(onAddToCart || onBuyNow) && (
        <div className={cn("space-y-2", compact ? "p-1.5 pt-0" : "p-2 sm:p-4 pt-0")}>
          {onAddToCart && (
            <Button
              onClick={(e) => {
                e.preventDefault()
                onAddToCart(product)
              }}
              className={cn(
                "w-full font-medium bg-[#10B981] hover:bg-[#0d9668] text-white shadow-sm hover:shadow transition-all active:scale-[0.98]",
                compact ? "rounded-lg h-8 text-xs" : "rounded-lg sm:rounded-xl h-8 sm:h-11 text-xs sm:text-base",
                !product.inStock && "opacity-50 cursor-not-allowed bg-gray-400",
              )}
              disabled={!product.inStock}
            >
              <ShoppingCart className={cn("mr-1.5", compact ? "h-3 w-3" : "h-3.5 w-3 sm:h-4 sm:w-4 sm:mr-2")} />
              {product.inStock ? "Add to Cart" : "Out of Stock"}
            </Button>
          )}
          {onBuyNow && (
            <Button
              onClick={(e) => {
                e.preventDefault()
                onBuyNow(product)
              }}
              variant="outline"
              className={cn(
                "w-full font-medium border-[#10B981] text-[#10B981] hover:bg-[#10B981]/10",
                compact ? "rounded-lg h-8 text-xs" : "rounded-lg sm:rounded-xl h-8 sm:h-11 text-xs sm:text-base",
                !product.inStock && "opacity-50 cursor-not-allowed",
              )}
              disabled={!product.inStock}
            >
              Buy Now
            </Button>
          )}
        </div>
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.price === nextProps.product.price &&
    prevProps.product.inStock === nextProps.product.inStock &&
    prevProps.product.image === nextProps.product.image &&
    prevProps.compact === nextProps.compact
  )
})

