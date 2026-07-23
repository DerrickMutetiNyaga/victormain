"use client"

import React, { memo } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer"
import { Plus, Minus, Trash2, ShoppingBag, Send, CheckCircle2, Smartphone, Banknote } from "lucide-react"
import { CartItem } from "@/types/menu"
import Image from "next/image"
import { cn } from "@/lib/utils"
import styles from "./cart-drawer.module.css"

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
  const isAlreadySent = activeOrderStatus === "sent" || activeOrderStatus === "active" || activeOrderStatus === "paid"
  const isPaidAlready = activeOrderStatus === "paid"
  const isCashPending = isAlreadySent && !isPaidAlready && activeOrderPaymentMethod === "cash"
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  const cartSubtotal = items.reduce(
    (sum, i) => sum + (Number(i.unitPrice) || 0) * (Number(i.quantity) || 0),
    0
  )
  const cartTotal = cartSubtotal

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={styles.drawer}
        style={{ touchAction: "manipulation" }}
      >
        <div className={styles.handle}>
          <div className={styles.handleBar} />
        </div>

        <DrawerHeader className={styles.header}>
          <DrawerTitle className="flex items-center gap-3">
            <div className={styles.iconBox}>
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <span className={styles.title}>
                {isAlreadySent ? "Your Order" : isAddingToExisting ? "Add to Order" : "Your Order"}
              </span>
              <p className={styles.subtitle}>
                {itemCount} {itemCount === 1 ? "item" : "items"}
                {tableNumber && ` · Table ${tableNumber}`}
                {customerNumber && ` · #${customerNumber}`}
              </p>
            </div>
            {isAlreadySent && (
              <span className={isPaidAlready ? styles.statusPaid : styles.statusUnpaid}>
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isPaidAlready ? "bg-[#b98a44]" : "bg-[#e08a3c] animate-pulse"
                  )}
                />
                {isPaidAlready ? "Paid" : "Unpaid · At Bar"}
              </span>
            )}
          </DrawerTitle>
        </DrawerHeader>

        <div className={cn(styles.list, "space-y-3")}>
          {items.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <ShoppingBag className="h-8 w-8" />
              </div>
              <p className="text-[#f2e8d8] font-semibold">Cart is empty</p>
              <p className="text-[rgba(242,232,216,0.4)] text-sm mt-1">Add something delicious</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className={styles.item}>
                {item.image && (
                  <div className={styles.thumb}>
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
                  <h4 className={styles.itemName}>{item.name}</h4>
                  <p className={styles.itemPrice}>
                    KES {(Number(item.unitPrice) || 0).toLocaleString()}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div className={styles.qtyPill}>
                      <button
                        className={styles.qtyBtn}
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className={styles.qtyCount}>{item.quantity}</span>
                      <button
                        className={styles.qtyBtn}
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={styles.lineTotal}>
                        KES {((Number(item.unitPrice) || 0) * item.quantity).toLocaleString()}
                      </span>
                      <button
                        className={styles.removeBtn}
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

        {items.length > 0 && (
          <DrawerFooter className={styles.footer}>
            <div className="space-y-1.5 px-1 pb-1">
              {isAlreadySent && (
                <p className="text-[rgba(242,232,216,0.35)] text-[10px] font-semibold uppercase tracking-[0.16em] mb-1">
                  New Items
                </p>
              )}
              <div className="flex justify-between items-center">
                <span className="text-[rgba(242,232,216,0.4)] text-sm">Subtotal</span>
                <span className="text-[rgba(242,232,216,0.7)] text-sm font-semibold tabular-nums">
                  KES {cartSubtotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[rgba(185,138,68,0.14)]">
                <span className="text-[#f2e8d8] font-bold text-base">Total</span>
                <span className="text-xl font-extrabold text-[#f2e8d8] tabular-nums">
                  KES {cartTotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {isAlreadySent ? (
              <>
                {isPaidAlready ? (
                  <div className={styles.paidBox}>
                    <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
                    <span>Order Paid</span>
                  </div>
                ) : (
                  <>
                    {activeOrderTotal != null && (
                      <div className="flex justify-between items-center px-1 py-1 border-t border-[rgba(185,138,68,0.12)]">
                        <span className="text-[rgba(242,232,216,0.45)] text-xs font-semibold uppercase tracking-wider">
                          Outstanding
                        </span>
                        <span className="text-[#c8722a] font-extrabold text-lg tabular-nums">
                          KES {activeOrderTotal.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {isCashPending ? (
                      <>
                        <div className={styles.infoCard}>
                          <Banknote className="h-5 w-5 text-[#e08a3c] flex-shrink-0" />
                          <div>
                            <p className="text-[#e08a3c] text-sm font-bold">Pay at the Teller</p>
                            <p className="text-[rgba(200,114,42,0.65)] text-xs mt-0.5">
                              Please have KES {(activeOrderTotal ?? 0).toLocaleString()} ready in cash
                            </p>
                          </div>
                        </div>
                        {onPayMpesa && (
                          <button
                            onClick={() => { onPayMpesa(); onOpenChange(false) }}
                            className={styles.mpesaCta}
                          >
                            <Smartphone className="h-4 w-4" strokeWidth={2.5} />
                            Pay via M-Pesa instead · KES {(activeOrderTotal ?? 0).toLocaleString()}
                          </button>
                        )}
                      </>
                    ) : (
                      <div className={cn(styles.infoCard, "bg-[rgba(28,20,16,0.7)] border-[rgba(185,138,68,0.14)]")}>
                        <Banknote className="h-5 w-5 text-[#e08a3c] flex-shrink-0" />
                        <div>
                          <p className="text-[#f2e8d8] text-sm font-bold">Order at Bar — Awaiting Payment</p>
                          <p className="text-[rgba(242,232,216,0.4)] text-xs mt-0.5">Payment will be collected</p>
                        </div>
                      </div>
                    )}

                    {items.length > 0 && (
                      <button onClick={onSendNow} className={styles.secondaryCta}>
                        <Send className="h-4 w-4" strokeWidth={2.5} />
                        Send New Items · KES {cartTotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </button>
                    )}
                  </>
                )}
              </>
            ) : (
              <button onClick={onSendNow} className={styles.primaryCta}>
                <Send className="h-4 w-4" strokeWidth={2.5} />
                Send Order
              </button>
            )}

            <button
              onClick={() => onOpenChange(false)}
              className={styles.ghostCta}
            >
              {isAlreadySent ? "Close" : "Keep Browsing"}
            </button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  )
})
