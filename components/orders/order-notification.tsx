"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, Bell, Receipt, Users, DollarSign, Smartphone, Banknote, Phone, CheckCircle2, Truck } from "lucide-react"
import { Order } from "@/types/menu"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

interface OrderNotificationProps {
  order: Order
  onDismiss: () => void
  onView: () => void
  onAccept: () => void
}

export function OrderNotification({ order, onDismiss, onView, onAccept }: OrderNotificationProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    // Auto-dismiss after 20 seconds (increased for better visibility)
    const timer = setTimeout(() => {
      setIsAnimating(true)
      setTimeout(() => {
        setIsVisible(false)
        setTimeout(onDismiss, 300) // Wait for animation
      }, 300)
    }, 20000)

    return () => clearTimeout(timer)
  }, [onDismiss])

  if (!isVisible) return null

  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const timeAgo = formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })

  return (
    <Card
      className={cn(
        "w-full max-w-md shadow-2xl border-4 border-orange-500/80 bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-50 dark:from-orange-950/30 dark:via-yellow-950/20 dark:to-orange-950/30",
        "animate-in slide-in-from-right-5 fade-in-0 zoom-in-95 duration-500",
        "ring-4 ring-orange-500/20 animate-pulse",
        isAnimating && "animate-out slide-out-to-right-5 fade-out-0 zoom-out-95 duration-300"
      )}
    >
      <CardHeader className="pb-4 space-y-0 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border-b-2 border-orange-200 dark:border-orange-800">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center animate-pulse shadow-lg">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-extrabold text-xl text-gray-900 dark:text-gray-100 leading-tight tracking-tight">
                NEW ORDER RECEIVED!
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">
                {timeAgo}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 text-gray-500 hover:text-gray-900 hover:bg-orange-200/50 rounded-full"
            onClick={() => {
              setIsAnimating(true)
              setTimeout(() => {
                setIsVisible(false)
                setTimeout(onDismiss, 300)
              }, 300)
            }}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 pt-4">
        {/* Order Number - PROMINENT */}
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-100 to-yellow-100 dark:from-orange-950/40 dark:to-yellow-950/40 rounded-lg border-2 border-orange-300 dark:border-orange-700">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Order #</span>
          </div>
          <span className="font-mono text-xl font-bold text-orange-700 dark:text-orange-300 tracking-wider">
            {order.orderId.slice(-8).toUpperCase()}
          </span>
        </div>

        {/* Table Number - PROMINENT */}
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-950/40 dark:to-cyan-950/40 rounded-lg border-2 border-blue-300 dark:border-blue-700">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Table</span>
          </div>
          <span className="text-2xl font-extrabold text-blue-700 dark:text-blue-300">
            {order.tableId}
          </span>
        </div>

        {/* Payment method banner */}
        {order.paymentMethod === "cash" ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border-2 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700">
            <Banknote className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Cash – Collect at Teller</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Customer will pay in cash</p>
            </div>
            <Badge className="bg-amber-500 text-white text-xs font-bold">UNPAID</Badge>
          </div>
        ) : order.paymentMethod === "glovo" ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 border-2 border-orange-300 dark:bg-orange-950/30 dark:border-orange-700">
            <Truck className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-orange-700 dark:text-orange-300">Paid via Glovo</p>
              {(order as any).glovoOrderNumber && (
                <p className="text-xs text-orange-600 dark:text-orange-400">Glovo Order #: {(order as any).glovoOrderNumber}</p>
              )}
            </div>
            <Badge className="bg-orange-500 text-white text-xs font-bold">PAID</Badge>
          </div>
        ) : order.paymentMethod === "mpesa" || order.paymentStatus === "PAID" ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border-2 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-700">
            <Smartphone className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Paid via M-Pesa</p>
              {order.customerNumber && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">{order.customerNumber}</p>
              )}
            </div>
            <Badge className="bg-emerald-500 text-white text-xs font-bold">PAID</Badge>
          </div>
        ) : null}

        {/* Phone number */}
        {order.customerNumber && (
          <div className="flex items-center gap-2 px-1">
            <Phone className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{order.customerNumber}</span>
          </div>
        )}

        {/* Order Items - CLEAR */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Items ({itemCount})</span>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1.5 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-md border border-gray-200 dark:border-gray-700">
            {order.items.slice(0, 5).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 dark:text-gray-300 font-medium truncate flex-1">
                  {item.quantity}x {item.name}
                </span>
                <span className="text-gray-600 dark:text-gray-400 ml-2 font-mono">
                  KES {(item.unitPrice * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}
            {order.items.length > 5 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 italic pt-1 border-t border-gray-200 dark:border-gray-700">
                +{order.items.length - 5} more item(s)
              </div>
            )}
          </div>
        </div>

        {/* Total Amount - VERY PROMINENT */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-950/40 dark:to-emerald-950/40 rounded-lg border-2 border-green-400 dark:border-green-700">
          <div className="flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
            <span className="text-base font-bold text-gray-700 dark:text-gray-300">Total Amount</span>
          </div>
          <span className="text-3xl font-extrabold text-green-700 dark:text-green-300 tracking-tight">
            KES {order.total.toLocaleString()}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onAccept}
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-base shadow-xl h-12 rounded-lg transition-all hover:scale-105 flex items-center justify-center gap-2"
            size="lg"
          >
            <CheckCircle2 className="h-5 w-5" />
            Accept Order
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onView}
            className="text-gray-600 hover:text-gray-900 border-gray-300 h-12 rounded-lg font-semibold"
          >
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

