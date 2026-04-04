"use client"

import React, { memo } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer"
import { Plus, Minus, Trash2, ShoppingBag, Send, CheckCircle2, Smartphone, Banknote } from "lucide-react"
import { CartItem } from "@/types/menu"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface CartDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CartItem[]
  tableNumber?: string
  customerNumber?: string | null
  onUpdateQuantity: (id: string, quantity: number) => void
  onRemove: (id: string) => void
  onSendNow: () => void
  onPayMpesa?: () => void
  total: number
  subtotal?: number
  vat?: number
  existingOrderId?: string | null
  isAddingToExisting?: boolean
  activeOrderStatus?: string
  activeOrderPaymentMethod?: string | null
  activeOrderTotal?: number
}

export const CartDrawer = memo(function CartDrawer({
  open,
  onOpenChange,
  items,
  tableNumber,
  customerNumber,
  onUpdateQuantity,
  onRemove,
  onSendNow,
  onPayMpesa,
  total,
  existingOrderId,
  isAddingToExisting,
  activeOrderStatus,
  activeOrderPaymentMethod,
  activeOrderTotal,
}: CartDrawerProps) {
  // Order already sent to bar — don't let customer re-send
  const isAlreadySent = activeOrderStatus === "sent" || activeOrderStatus === "active" || activeOrderStatus === "paid"
  const isPaidAlready = activeOrderStatus === "paid"
  const isCashPending = isAlreadySent && !isPaidAlready && activeOrderPaymentMethod === "cash"
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  // Prices are VAT-inclusive in this app; do not add tax on top.
  const cartSubtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  const cartTotal = cartSubtotal

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="max-h-[92vh] rounded-t-3xl border-t border-white/[0.08] bg-[#13131E]"
        style={{ touchAction: "manipulation" }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <DrawerHeader className="border-b border-white/[0.06] py-3 px-5">
          <DrawerTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/15 flex items-center justify-center">
              <ShoppingBag className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <span className="text-base font-bold text-white">
                {isAlreadySent ? "Your Order" : isAddingToExisting ? "Add to Order" : "Your Order"}
              </span>
              <p className="text-[12px] text-white/45 font-normal mt-0.5">
                {itemCount} {itemCount === 1 ? "item" : "items"}
                {tableNumber && ` · Table ${tableNumber}`}
                {customerNumber && ` · #${customerNumber}`}
              </p>
            </div>
            {/* Status chip when order is at bar */}
            {isAlreadySent && (
              <span className={cn(
                "ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold",
                isPaidAlready
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-amber-500/15 text-amber-400"
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", isPaidAlready ? "bg-emerald-400" : "bg-amber-400 animate-pulse")} />
                {isPaidAlready ? "Paid" : "Unpaid · At Bar"}
              </span>
            )}
          </DrawerTitle>
        </DrawerHeader>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 min-h-0 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-3xl bg-white/[0.05] flex items-center justify-center mb-4">
                <ShoppingBag className="h-8 w-8 text-white/20" />
              </div>
              <p className="text-white font-semibold">Cart is empty</p>
              <p className="text-white/40 text-sm mt-1">Add something delicious</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 p-3 rounded-2xl bg-white/[0.05] border border-white/[0.06]"
              >
                {item.image && (
                  <div className="relative h-16 w-16 rounded-xl overflow-hidden bg-white/[0.08] flex-shrink-0">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white text-sm truncate">
                    {item.name}
                  </h4>
                  <p className="text-amber-400 text-[13px] font-semibold mt-0.5">
                    KES {item.unitPrice.toLocaleString()}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    {/* Quantity control */}
                    <div className="inline-flex items-center rounded-full bg-white/[0.08] p-0.5">
                      <button
                        className="h-7 w-7 rounded-full hover:bg-white/10 active:scale-90 flex items-center justify-center transition-all text-white/70"
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-7 text-center text-sm font-bold text-white">
                        {item.quantity}
                      </span>
                      <button
                        className="h-7 w-7 rounded-full hover:bg-white/10 active:scale-90 flex items-center justify-center transition-all text-white/70"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Subtotal + delete */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white/80">
                        KES {(item.unitPrice * item.quantity).toLocaleString()}
                      </span>
                      <button
                        className="h-7 w-7 rounded-full hover:bg-red-500/20 active:scale-90 flex items-center justify-center transition-all text-white/30 hover:text-red-400"
                        onClick={() => onRemove(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer CTA */}
        {items.length > 0 && (
          <DrawerFooter className="border-t border-white/[0.06] p-4 sm:p-5 gap-3">
            {/* Totals */}
            <div className="space-y-1.5 px-1 pb-1">
              {isAlreadySent && (
                <p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-1">New Items</p>
              )}
              <div className="flex justify-between items-center">
                <span className="text-white/40 text-sm">Subtotal</span>
                <span className="text-white/70 text-sm font-semibold">KES {cartSubtotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/[0.08]">
                <span className="text-white font-bold text-base">Total</span>
                <span className="text-xl font-extrabold text-white">KES {cartTotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {isAlreadySent ? (
              <>
                {isPaidAlready ? (
                  <div className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 bg-emerald-500/15 border border-emerald-500/25">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" strokeWidth={2.5} />
                    <span className="font-bold text-emerald-400 text-[15px]">Order Paid</span>
                  </div>
                ) : (
                  <>
                    {/* Existing order at bar — show ITS amount clearly */}
                    {activeOrderTotal != null && (
                      <div className="flex justify-between items-center px-1 py-1 border-t border-white/[0.06]">
                        <span className="text-white/45 text-xs font-semibold uppercase tracking-wider">Outstanding</span>
                        <span className="text-amber-400 font-extrabold text-lg">KES {activeOrderTotal.toLocaleString()}</span>
                      </div>
                    )}

                    {isCashPending ? (
                      /* Cash order — give both options */
                      <>
                        <div className="w-full px-4 py-3 rounded-2xl bg-amber-500/[0.08] border border-amber-500/20 flex items-center gap-3">
                          <Banknote className="h-5 w-5 text-amber-400 flex-shrink-0" />
                          <div>
                            <p className="text-amber-400 text-sm font-bold">Pay at the Teller</p>
                            <p className="text-amber-400/60 text-xs mt-0.5">
                              Please have KES {(activeOrderTotal ?? 0).toLocaleString()} ready in cash
                            </p>
                          </div>
                        </div>
                        {onPayMpesa && (
                          <button
                            onClick={() => { onPayMpesa(); onOpenChange(false) }}
                            className="w-full h-12 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400"
                          >
                            <Smartphone className="h-4 w-4" strokeWidth={2.5} />
                            Pay via M-Pesa instead · KES {(activeOrderTotal ?? 0).toLocaleString()}
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="w-full px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center gap-3">
                        <Banknote className="h-5 w-5 text-amber-400 flex-shrink-0" />
                        <div>
                          <p className="text-white text-sm font-bold">Order at Bar — Awaiting Payment</p>
                          <p className="text-white/40 text-xs mt-0.5">Payment will be collected</p>
                        </div>
                      </div>
                    )}

                    {/* New cart items — send as a separate order */}
                    {items.length > 0 && (
                      <button
                        onClick={onSendNow}
                        className="w-full h-12 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.10] text-white/80"
                      >
                        <Send className="h-4 w-4" strokeWidth={2.5} />
                        Send New Items · KES {cartTotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </button>
                    )}
                  </>
                )}
              </>
            ) : (
              /* Normal: order not yet sent */
              <button
                onClick={onSendNow}
                className={cn(
                  "w-full h-14 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
                  "bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-lg shadow-amber-500/25"
                )}
              >
                <Send className="h-4 w-4" strokeWidth={2.5} />
                Send Order
              </button>
            )}

            <button
              onClick={() => onOpenChange(false)}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white/50 bg-white/[0.06] hover:bg-white/[0.10] transition-colors"
            >
              {isAlreadySent ? "Close" : "Keep Browsing"}
            </button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  )
})
