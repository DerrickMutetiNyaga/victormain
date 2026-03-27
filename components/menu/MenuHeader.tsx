"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { History, ShoppingBag } from "lucide-react"
import { OrderHistoryDrawer } from "./order-history-drawer"
import { Order } from "@/types/menu"

interface MenuHeaderProps {
  tableNumber: string
  customerNumber?: string | null
  cartCount: number
  historyOrders: Order[]
  onOpenCart: () => void
  onSelectOrder: (order: Order) => void
  onAddToOrder: (order: Order) => void
  onPayNow: (order: Order) => void
}

export function MenuHeader({
  tableNumber,
  customerNumber,
  cartCount,
  historyOrders,
  onOpenCart,
  onSelectOrder,
  onAddToOrder,
  onPayNow,
}: MenuHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/80">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-start sm:items-center justify-between gap-4 py-4 sm:py-5">
          {/* Left: Venue + tagline + chips */}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
              Catha Lounge
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Bar & Lounge
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700">
                Table {tableNumber}
              </span>
              {customerNumber && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Customer #{customerNumber}
                </span>
              )}
            </div>
          </div>

          {/* Right: Icon buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <OrderHistoryDrawer
              orders={historyOrders}
              onSelectOrder={onSelectOrder}
              onAddToOrder={onAddToOrder}
              onPayNow={onPayNow}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                title="Order History"
              >
                <History className="h-5 w-5" />
              </Button>
            </OrderHistoryDrawer>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 relative"
              onClick={onOpenCart}
              title="Cart"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-5 min-w-[20px] px-1 rounded-full bg-emerald-600 text-white text-[11px] font-semibold flex items-center justify-center">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
