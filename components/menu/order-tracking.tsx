"use client"

import React, { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  Clock,
  XCircle,
  Package,
  ArrowLeft,
  Plus,
  CreditCard,
  Banknote,
  Smartphone,
} from "lucide-react"
import { Order } from "@/types/menu"
import { orderStore } from "@/lib/orderStore"
import { cn } from "@/lib/utils"

interface OrderTrackingProps {
  orderId: string
  onClose?: () => void
  onBack?: () => void
  onAddItems?: (order: Order) => void
  onPayNow?: (order: Order) => void
}

const statusConfig: Record<
  string,
  { label: string; icon: React.ReactNode; pill: string; dot: string }
> = {
  draft: {
    label: "Draft",
    icon: <Clock className="h-3.5 w-3.5" />,
    pill: "bg-white/10 text-white/60 border-white/10",
    dot: "bg-white/40",
  },
  active: {
    label: "Active",
    icon: <Package className="h-3.5 w-3.5" />,
    pill: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    dot: "bg-blue-400",
  },
  sent: {
    label: "Sent to Bar",
    icon: <Package className="h-3.5 w-3.5" />,
    pill: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    dot: "bg-amber-400 animate-pulse",
  },
  paid: {
    label: "Paid",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    pill: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: <XCircle className="h-3.5 w-3.5" />,
    pill: "bg-red-500/15 text-red-400 border-red-500/20",
    dot: "bg-red-400",
  },
  PENDING: {
    label: "Pending",
    icon: <Clock className="h-3.5 w-3.5" />,
    pill: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    dot: "bg-yellow-400",
  },
  IN_PROGRESS: {
    label: "In Progress",
    icon: <Package className="h-3.5 w-3.5" />,
    pill: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    dot: "bg-blue-400",
  },
  RECEIVED: {
    label: "Received",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    pill: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: <XCircle className="h-3.5 w-3.5" />,
    pill: "bg-red-500/15 text-red-400 border-red-500/20",
    dot: "bg-red-400",
  },
}

export function OrderTracking({
  orderId,
  onClose,
  onBack,
  onAddItems,
  onPayNow,
}: OrderTrackingProps) {
  const [order, setOrder] = useState<Order | null>(null)

  useEffect(() => {
    const update = () => setOrder(orderStore.getOrder(orderId) || null)
    update()
    return orderStore.subscribe(update)
  }, [orderId])

  if (!order) {
    return (
      <div className="rounded-3xl bg-[#13131E] border border-white/[0.07] p-8 text-center">
        <p className="text-white/40 text-sm">Order not found</p>
      </div>
    )
  }

  const status = statusConfig[order.status] ?? statusConfig.draft
  const isUnpaid = order.paymentStatus === "UNPAID"
  const isCashOrder = order.paymentMethod === "cash"
  // Always compute VAT on top of item prices (prices are base prices, VAT is added on top)
  const orderSubtotal = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const orderVat = Math.round(orderSubtotal * 0.16 * 100) / 100
  const orderTotal = orderSubtotal + orderVat

  return (
    <div className="rounded-3xl bg-[#13131E] border border-white/[0.07] overflow-hidden">
      {/* Status banner */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
        {(onBack || onClose) && (
          <button
            onClick={onBack || onClose}
            className="flex items-center gap-1.5 text-white/45 hover:text-white/80 text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-white/35 text-[11px] font-semibold uppercase tracking-widest mb-1">
              Order ID
            </p>
            <p className="text-white font-mono text-sm font-bold">
              #{order.orderId.slice(-10)}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold border",
              status.pill
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", status.dot)} />
            {status.label}
          </span>
        </div>
      </div>

      {/* Info grid */}
      <div className="px-5 py-4 grid grid-cols-3 gap-3 border-b border-white/[0.06]">
        <div>
          <p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-1">Table</p>
          <p className="text-white font-bold text-sm">#{order.tableId}</p>
        </div>
        <div>
          <p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-1">Total (incl. VAT)</p>
          <p className="text-amber-400 font-bold text-sm">KES {orderTotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-1">Payment</p>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-bold text-sm",
                order.paymentStatus === "PAID" ? "text-emerald-400" : "text-amber-400"
              )}
            >
              {order.paymentStatus === "PAID" ? "PAID" : "NOT PAID"}
            </span>
            {order.paymentStatus !== "PAID" && order.paymentMethod === "cash" && (
              <span className="text-white/40 text-xs">· Cash</span>
            )}
          </div>
        </div>
      </div>

      {/* Payment method banner — explicit NOT PAID + Pay via M-Pesa option */}
      {order.paymentMethod === "cash" && order.paymentStatus !== "PAID" && (
        <div className="mx-5 mt-4 space-y-3">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Banknote className="h-5 w-5 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-amber-400 text-sm font-bold">Pay at the Teller</p>
                <p className="text-amber-400/60 text-xs mt-0.5">Please have KES {orderTotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ready</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              NOT PAID
            </span>
          </div>
          {onPayNow && (
            <button
              onClick={() => onPayNow(order)}
              className="w-full h-11 rounded-xl font-semibold text-sm bg-emerald-500/15 border border-emerald-500/25 hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <Smartphone className="h-4 w-4" strokeWidth={2.5} />
              Pay via M-Pesa · KES {orderTotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </button>
          )}
        </div>
      )}
      {order.paymentMethod === "mpesa" && order.paymentStatus === "PAID" && (
        <div className="mx-5 mt-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-emerald-400 text-sm font-bold">Paid via M-Pesa ✓</p>
              {(order as any).mpesaReceiptNumber && (
                <p className="text-emerald-400/60 text-xs font-mono mt-0.5 tracking-wider">
                  Receipt: {(order as any).mpesaReceiptNumber}
                </p>
              )}
            </div>
          </div>
          {(order as any).mpesaReceiptNumber && (
            <span className="text-emerald-400 font-mono text-xs font-bold bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30 shrink-0">
              {(order as any).mpesaReceiptNumber}
            </span>
          )}
        </div>
      )}

      {/* Items list */}
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <p className="text-white/35 text-[10px] font-semibold uppercase tracking-widest mb-3">Items</p>
        <div className="space-y-2">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center">
              <span className="text-white/70 text-sm">
                <span className="font-semibold text-white/90">{item.quantity}×</span>{" "}
                {item.name}
              </span>
              <span className="text-white/60 text-sm font-semibold">
                KES {(item.unitPrice * item.quantity).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        {/* VAT breakdown — always visible */}
        <div className="mt-4 rounded-xl bg-white/[0.04] border border-white/[0.07] overflow-hidden">
          <div className="flex justify-between items-center px-3 py-2 border-b border-white/[0.05]">
            <span className="text-white/50 text-sm">Subtotal</span>
            <span className="text-white/70 text-sm font-semibold">KES {orderSubtotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center px-3 py-2 border-b border-white/[0.05] bg-amber-500/[0.05]">
            <span className="text-amber-400 text-sm font-semibold">TAX / VAT (16%)</span>
            <span className="text-amber-400 text-sm font-bold">KES {orderVat.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center px-3 py-2.5">
            <span className="text-white text-sm font-bold">Total (incl. VAT)</span>
            <span className="text-amber-400 text-base font-extrabold">KES {orderTotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Success banner */}
      {order.status === "RECEIVED" && (
        <div className="mx-5 my-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <p className="text-emerald-400 text-sm font-semibold">Your order has been received!</p>
        </div>
      )}

      {/* Actions */}
      {(isUnpaid || onAddItems) && (
        <div className="px-5 pb-5 pt-3 flex flex-col gap-2">
          {/* Pay Now only for non-cash unpaid orders */}
          {isUnpaid && !isCashOrder && onPayNow && (
            <button
              onClick={() => onPayNow(order)}
              className="w-full h-12 rounded-xl font-bold text-[14px] bg-gradient-to-r from-emerald-500 to-green-400 text-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <CreditCard className="h-4 w-4" strokeWidth={2.5} />
              Pay Now · KES {orderTotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </button>
          )}
          {onAddItems && (
            <button
              onClick={() => onAddItems(order)}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white/60 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.07] transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add More Items
            </button>
          )}
        </div>
      )}
    </div>
  )
}
