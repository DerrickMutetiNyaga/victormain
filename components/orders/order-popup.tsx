"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, CheckCircle2, Clock } from "lucide-react"
import { Order } from "@/types/menu"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

interface OrderPopupProps {
  order: Order
  onDismiss: () => void
  onView: () => void
}

export function OrderPopup({ order, onDismiss, onView }: OrderPopupProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Auto-dismiss after 10 seconds
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onDismiss, 300) // Wait for animation
    }, 10000)

    return () => clearTimeout(timer)
  }, [onDismiss])

  if (!isVisible) return null

  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <Card
      className={cn(
        "fixed top-4 right-4 z-50 w-full max-w-sm shadow-2xl animate-in slide-in-from-right",
        "border-yellow-500/50 bg-yellow-500/5"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-600 animate-pulse" />
              <span className="font-bold">New Order!</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Table {order.tableId} • {itemCount} {itemCount === 1 ? "item" : "items"}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              setIsVisible(false)
              setTimeout(onDismiss, 300)
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm">#{order.orderId.slice(-6)}</span>
          <span className="text-lg font-bold">KES {order.total.toLocaleString()}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onView} className="flex-1">
            View Order
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIsVisible(false)
              setTimeout(onDismiss, 300)
            }}
          >
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

