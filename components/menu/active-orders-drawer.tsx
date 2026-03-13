"use client"

import React from "react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { ClipboardList, Banknote, Smartphone, ChevronRight } from "lucide-react"
import { Order } from "@/types/menu"
import { cn } from "@/lib/utils"

const statusLabel: Record<string, string> = {
  sent: "At Bar",
  active: "Preparing",
  draft: "Draft",
}

interface ActiveOrdersDrawerProps {
  orders: Order[]
  onSelectOrder?: (order: Order) => void
  onPayNow?: (order: Order) => void
  children?: React.ReactNode
}

export function ActiveOrdersDrawer({
  orders,
  onSelectOrder,
  onPayNow,
  children,
}: ActiveOrdersDrawerProps) {
  const [open, setOpen] = React.useState(false)
  const count = orders.length

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {children ?? (
          <button className="relative h-10 w-10 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] flex items-center justify-center transition-colors">
            <ClipboardList className="h-5 w-5 text-white/70" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center animate-pulse">
                {count}
              </span>
            )}
          </button>
        )}
      </DrawerTrigger>

      <DrawerContent className="max-h-[88vh] rounded-t-3xl border-t border-white/[0.08] bg-[#13131E]">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <DrawerHeader className="border-b border-white/[0.06] py-3 px-5">
          <DrawerTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/15 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <span className="text-base font-bold text-white">Active Orders</span>
              <p className="text-[12px] text-white/40 font-normal mt-0.5">
                {count === 0 ? "No pending orders" : `${count} order${count > 1 ? "s" : ""} awaiting payment`}
              </p>
            </div>
          </DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-6 pt-4 space-y-3">
          {count === 0 ? (
            <div className="py-16 text-center">
              <div className="h-14 w-14 rounded-2xl bg-white/[0.05] flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="h-7 w-7 text-white/20" />
              </div>
              <p className="text-white/50 text-sm font-medium">No active orders</p>
              <p className="text-white/25 text-xs mt-1">Orders you've sent will appear here until paid</p>
            </div>
          ) : (
            orders.map((order) => {
              const isCash = order.paymentMethod === "cash"
              const tableLabel = order.tableId ? `Table ${order.tableId}` : ""
              const statusTag = statusLabel[order.status] ?? order.status

              return (
                <div
                  key={order.orderId}
                  className="rounded-2xl bg-amber-500/[0.05] border border-amber-500/20 overflow-hidden"
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/10">
                    <div>
                      <p className="text-white font-bold text-sm">
                        #{order.orderId.slice(-8)}
                        {tableLabel && (
                          <span className="ml-2 text-[11px] font-normal text-white/35">{tableLabel}</span>
                        )}
                      </p>
                      <p className="text-white/35 text-[11px] mt-0.5">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-400">
                      {statusTag}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="px-4 py-3 space-y-1.5">
                    {order.items.slice(0, 3).map((item, i) => (
                      <div key={i} className="flex justify-between text-[13px]">
                        <span className="text-white/65">{item.quantity}× {item.name}</span>
                        <span className="text-white/45">KES {(item.unitPrice * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <p className="text-white/30 text-[11px]">+{order.items.length - 3} more items</p>
                    )}
                  </div>

                  {/* VAT breakdown */}
                  {(() => {
                    const sub = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
                    const vatAmt = Math.round(sub * 0.16 * 100) / 100
                    const grandTotal = sub + vatAmt
                    return (
                      <div className="px-4 pb-2 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-white/30">Subtotal</span>
                          <span className="text-white/40">KES {sub.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-amber-400/60">TAX / VAT (16%)</span>
                          <span className="text-amber-400/60">KES {vatAmt.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold pt-0.5 border-t border-white/[0.05]">
                          <span className="text-white/50">Total (incl. VAT)</span>
                          <span className="text-amber-400">{grandTotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Footer */}
                  <div className="flex items-center justify-between px-4 pb-3 pt-1 border-t border-white/[0.06]">
                    {/* Payment method + total */}
                    {(() => {
                      const sub = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
                      const grandTotal = sub + Math.round(sub * 0.16 * 100) / 100
                      return (
                        <div>
                          <span className="text-amber-400 font-bold text-sm">
                            KES {grandTotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {isCash
                              ? <Banknote className="h-3 w-3 text-white/30" />
                              : <Smartphone className="h-3 w-3 text-white/30" />}
                            <span className="text-white/30 text-[10px]">{isCash ? "Cash at teller" : "M-Pesa"}</span>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Actions */}
                    <div className="flex gap-1.5">
                      {onSelectOrder && (
                        <button
                          className="h-8 px-3 rounded-lg text-xs font-semibold text-white/50 bg-white/[0.07] hover:bg-white/[0.12] transition-colors flex items-center gap-1"
                          onClick={() => { onSelectOrder(order); setOpen(false) }}
                        >
                          View <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                      {isCash && onPayNow && (
                        <button
                          className="h-8 px-3 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 transition-colors"
                          onClick={() => { onPayNow(order); setOpen(false) }}
                        >
                          Pay M-Pesa
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
