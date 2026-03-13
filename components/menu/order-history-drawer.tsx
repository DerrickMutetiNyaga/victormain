"use client"

import React from "react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { History, Receipt } from "lucide-react"
import { Order } from "@/types/menu"
import { cn } from "@/lib/utils"

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-white/10 text-white/50" },
  active: { label: "Preparing", className: "bg-blue-500/15 text-blue-400" },
  sent: { label: "Sent to Bar", className: "bg-amber-500/15 text-amber-400" },
  paid: { label: "Paid", className: "bg-emerald-500/15 text-emerald-400" },
  cancelled: { label: "Cancelled", className: "bg-red-500/15 text-red-400" },
}

interface OrderHistoryDrawerProps {
  orders: Order[]
  onSelectOrder?: (order: Order) => void
  onAddToOrder?: (order: Order) => void
  onPayNow?: (order: Order) => void
  children?: React.ReactNode
}

export function OrderHistoryDrawer({
  orders,
  onSelectOrder,
  onAddToOrder,
  onPayNow,
  children,
}: OrderHistoryDrawerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {children ?? (
          <button className="relative h-10 w-10 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] flex items-center justify-center transition-colors">
            <History className="h-5 w-5 text-white/70" />
          </button>
        )}
      </DrawerTrigger>

      <DrawerContent className="max-h-[88vh] rounded-t-3xl border-t border-white/[0.08] bg-[#13131E]">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <DrawerHeader className="border-b border-white/[0.06] py-3 px-5">
          <DrawerTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/[0.08] flex items-center justify-center">
              <Receipt className="h-5 w-5 text-white/60" />
            </div>
            <div>
              <span className="text-base font-bold text-white">Order History</span>
              <p className="text-[12px] text-white/40 font-normal mt-0.5">
                {orders.length} {orders.length === 1 ? "paid order" : "paid orders"}
              </p>
            </div>
          </DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-6 pt-4 space-y-3">
          {orders.length === 0 ? (
            <div className="py-16 text-center">
              <div className="h-14 w-14 rounded-2xl bg-white/[0.05] flex items-center justify-center mx-auto mb-4">
                <Receipt className="h-7 w-7 text-white/20" />
              </div>
              <p className="text-white/50 text-sm font-medium">No paid orders yet</p>
              <p className="text-white/25 text-xs mt-1">Completed orders will appear here</p>
            </div>
          ) : (
            orders.map((order) => {
              const cfg = statusConfig[order.status] ?? statusConfig.paid

              return (
                <div
                  key={order.orderId}
                  className="rounded-2xl border overflow-hidden bg-white/[0.05] border-white/[0.07]"
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
                    <div>
                      <p className="text-white font-bold text-sm">
                        #{order.orderId.slice(-8)}
                        {order.tableId && (
                          <span className="ml-2 text-[11px] font-normal text-white/30">Table {order.tableId}</span>
                        )}
                      </p>
                      <p className="text-white/35 text-[11px] mt-0.5">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400">
                      Paid
                    </span>
                  </div>

                  {/* Items preview */}
                  <div className="px-4 py-3 space-y-1.5">
                    {order.items.slice(0, 3).map((item, i) => (
                      <div key={i} className="flex justify-between text-[13px]">
                        <span className="text-white/60">
                          {item.quantity}× {item.name}
                        </span>
                        <span className="text-white/50">
                          KES {(item.unitPrice * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <p className="text-white/30 text-[11px]">
                        +{order.items.length - 3} more items
                      </p>
                    )}
                  </div>

                  {/* M-Pesa receipt code */}
                  {(order as any).mpesaReceiptNumber && (
                    <div className="px-4 pb-2 flex items-center gap-2">
                      <span className="text-white/30 text-[10px] uppercase tracking-wider">M-Pesa</span>
                      <span className="text-emerald-400 font-mono text-[11px] font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 tracking-wider">
                        {(order as any).mpesaReceiptNumber}
                      </span>
                    </div>
                  )}

                  {/* VAT breakdown + footer */}
                  {(() => {
                    const sub = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
                    const vatAmt = Math.round(sub * 0.16 * 100) / 100
                    const grandTotal = sub + vatAmt
                    return (
                      <div className="px-4 pb-3 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-white/30">Subtotal</span>
                          <span className="text-white/40">KES {sub.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-amber-400/60">TAX / VAT (16%)</span>
                          <span className="text-amber-400/60">KES {vatAmt.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                          <span className="text-emerald-400 font-bold text-sm">
                            KES {grandTotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          {onSelectOrder && (
                            <button
                              className="h-8 px-3 rounded-lg text-xs font-semibold text-white/50 bg-white/[0.07] hover:bg-white/[0.12] transition-colors"
                              onClick={() => { onSelectOrder(order); setOpen(false) }}
                            >
                              View receipt
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
