"use client"

import React, { memo } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Plus, Minus } from "lucide-react"
import { MenuItem } from "@/types/menu"
import { cn } from "@/lib/utils"

const tagLabels: Record<string, string> = {
  popular: "Popular",
  "best-seller": "Best Seller",
  "premium-pick": "Premium",
  "house-favorite": "House Pick",
  "staff-pick": "Staff Pick",
  "best-value": "Best Value",
}

interface MenuProductCardProps {
  item: MenuItem
  variant?: "default" | "compact"
  onClick?: () => void
  onAdd: () => void
  quantity: number
  onUpdateQuantity?: (delta: number) => void
}

export const MenuProductCard = memo(function MenuProductCard({
  item,
  variant = "default",
  onClick,
  onAdd,
  quantity,
  onUpdateQuantity,
}: MenuProductCardProps) {
  const tag = item.tag ? tagLabels[item.tag] : null

  if (variant === "compact") {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === "Enter" && onClick?.()}
        className="group bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow active:scale-[0.98] cursor-pointer"
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-slate-50">
          <Image
            src={item.image || "/placeholder.jpg"}
            alt={item.name}
            fill
            className="object-cover object-top transition-transform duration-300 group-hover:scale-105"
            sizes="160px"
          />
          {tag && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/90 text-slate-700 shadow-sm">
              {tag}
            </span>
          )}
        </div>
        <div className="p-2.5">
          <h3 className="text-sm font-medium text-slate-900 line-clamp-2 leading-tight">
            {item.name}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 capitalize">
            {item.category.replace("-", " ")}
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm font-semibold text-slate-900">
              KES {item.price.toLocaleString()}
            </span>
            {quantity > 0 ? (
              <div className="flex items-center gap-0.5 rounded-full bg-slate-100 p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdateQuantity?.(-1)
                  }}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-5 text-center text-xs font-semibold">
                  {quantity}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdateQuantity?.(1)
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                onClick={(e) => {
                  e.stopPropagation()
                  onAdd()
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className="group bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98] cursor-pointer"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-slate-50">
        <Image
          src={item.image || "/placeholder.jpg"}
          alt={item.name}
          fill
          className="object-cover object-top transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        {tag && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/90 text-slate-700 shadow-sm">
            {tag}
          </span>
        )}
        {!item.inStock && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <span className="text-sm font-medium text-slate-500">Out of stock</span>
          </div>
        )}
      </div>
      <div className="p-3 sm:p-4">
        {item.brand && (
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
            {item.brand}
          </p>
        )}
        <h3 className="text-sm sm:text-base font-medium text-slate-900 line-clamp-2 leading-tight">
          {item.name}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
          {item.description}
        </p>
        <div className="flex items-center justify-between mt-3 gap-2">
          <span className="text-base font-semibold text-slate-900">
            KES {item.price.toLocaleString()}
          </span>
          {quantity > 0 ? (
            <div className="flex items-center rounded-full bg-slate-100 p-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                disabled={!item.inStock}
                onClick={(e) => {
                  e.stopPropagation()
                  onUpdateQuantity?.(-1)
                }}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-6 text-center text-sm font-semibold">
                {quantity}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                disabled={!item.inStock}
                onClick={(e) => {
                  e.stopPropagation()
                  onUpdateQuantity?.(1)
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-medium text-sm"
              disabled={!item.inStock}
              onClick={(e) => {
                e.stopPropagation()
                onAdd()
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})
