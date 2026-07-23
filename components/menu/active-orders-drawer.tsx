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
          <button className="relative h-10 w-10 rounded-xl bg-[#382C21] border border-[rgba(242,232,216,0.14)] hover:bg-[#403428] flex items-center justify-center transition-colors">
            <ClipboardList className="h-5 w-5 text-[#D9843B]" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-[#D9843B] text-[#1A1512] text-[9px] font-bold flex items-center justify-center animate-pulse">
                {count}
              </span>
            )}
          </button>
        )}
      </DrawerTrigger>

      <DrawerContent
        className="max-h-[88vh] rounded-t-[1.25rem] border-t border-[rgba(242,232,216,0.14)] bg-transparent"
        style={{ background: "radial-gradient(ellipse at top center, rgba(200,114,42,0.12), transparent 55%), #2E241B" }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[rgba(242,232,216,0.28)]" />
        </div>

        <DrawerHeader className="border-b border-[rgba(242,232,216,0.10)] py-3 px-5">
          <DrawerTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#382C21] border border-[rgba(242,232,216,0.14)] flex items-center justify-center shadow-[0_0_20px_rgba(200,114,42,0.16)]">
              <ClipboardList className="h-5 w-5 text-[#D9843B]" />
            </div>
            <div>
              <span className="text-base font-semibold text-[#F5EBDC] font-[family-name:var(--menu-font-display)]">Active Orders</span>
              <p className="text-[12px] text-[rgba(242,232,216,0.65)] font-normal mt-0.5">
                {count === 0 ? "No pending orders" : `${count} order${count > 1 ? "s" : ""} awaiting payment`}
              </p>
            </div>
          </DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-6 pt-4 space-y-3">
          {count === 0 ? (
            <div className="py-16 text-center relative">
              <div className="relative h-14 w-14 rounded-2xl bg-[#382C21] border border-[rgba(242,232,216,0.14)] flex items-center justify-center mx-auto mb-4 shadow-[0_0_32px_rgba(200,114,42,0.2)]">
                <div className="absolute inset-[-16px] rounded-[1.5rem] bg-[radial-gradient(circle,rgba(200,114,42,0.2),transparent_68%)] pointer-events-none -z-10" />
                <ClipboardList className="h-7 w-7 text-[#D9843B]" />
              </div>
              <p className="text-[#F5EBDC] text-sm font-medium">No active orders</p>
              <p className="text-[rgba(242,232,216,0.65)] text-xs mt-1">Orders you&apos;ve sent will appear here until paid</p>
            </div>
          ) : (
            orders.map((order) => {
              const isCash = order.paymentMethod === "cash"
              const tableLabel = order.tableId ? `Table ${order.tableId}` : ""
              const statusTag = statusLabel[order.status] ?? order.status

              return (
                <div
                  key={order.orderId}
                  className="rounded-2xl bg-[#261E17] border border-[rgba(242,232,216,0.14)] overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(242,232,216,0.10)]">
                    <div>
                      <p className="text-[#F5EBDC] font-bold text-sm">
                        #{order.orderId.slice(-8)}
                        {tableLabel && (
                          <span className="ml-2 text-[11px] font-normal text-[rgba(242,232,216,0.65)]">{tableLabel}</span>
                        )}
                      </p>
                      <p className="text-[rgba(242,232,216,0.65)] text-[11px] mt-0.5">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[rgba(217,132,59,0.14)] text-[#D9843B]">
                      {statusTag}
                    </span>
                  </div>

                  <div className="px-4 py-3 space-y-1.5">
                    {order.items.slice(0, 3).map((item, i) => (
                      <div key={i} className="flex justify-between text-[13px]">
                        <span className="text-[rgba(242,232,216,0.65)]">{item.quantity}× {item.name}</span>
                        <span className="text-[rgba(242,232,216,0.65)]">KES {(item.unitPrice * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <p className="text-[rgba(242,232,216,0.65)] text-[11px]">+{order.items.length - 3} more items</p>
                    )}
                  </div>

                  {(() => {
                    const sub = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
                    const grandTotal = sub
                    return (
                      <div className="px-4 pb-2 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[rgba(242,232,216,0.65)]">Subtotal</span>
                          <span className="text-[rgba(242,232,216,0.65)]">KES {sub.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold pt-0.5 border-t border-[rgba(242,232,216,0.10)]">
                          <span className="text-[#F5EBDC]">Total</span>
                          <span className="text-[#D9843B]">{grandTotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    )
                  })()}

                  <div className="flex items-center justify-between px-4 pb-3 pt-1 border-t border-[rgba(242,232,216,0.10)]">
                    {(() => {
                      const sub = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
                      const grandTotal = sub
                      return (
                        <div>
                          <span className="text-[#D9843B] font-bold text-sm">
                            KES {grandTotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {isCash
                              ? <Banknote className="h-3 w-3 text-[rgba(242,232,216,0.65)]" />
                              : <Smartphone className="h-3 w-3 text-[rgba(242,232,216,0.65)]" />}
                            <span className="text-[rgba(242,232,216,0.65)] text-[10px]">{isCash ? "Cash at teller" : "M-Pesa"}</span>
                          </div>
                        </div>
                      )
                    })()}

                    <div className="flex gap-1.5">
                      {onSelectOrder && (
                        <button
                          className="h-8 px-3 rounded-lg text-xs font-semibold text-[rgba(242,232,216,0.65)] bg-[#382C21] border border-[rgba(242,232,216,0.14)] hover:bg-[#403428] transition-colors flex items-center gap-1"
                          onClick={() => { onSelectOrder(order); setOpen(false) }}
                        >
                          View <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                      {isCash && onPayNow && (
                        <button
                          className="h-8 px-3 rounded-lg text-xs font-semibold text-[#1A1512] bg-gradient-to-r from-[#c8722a] to-[#e09040] hover:opacity-95 transition-opacity"
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
