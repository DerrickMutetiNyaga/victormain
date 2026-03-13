"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle2, XCircle, Plus, ArrowLeft, CreditCard } from "lucide-react"
import { Order } from "@/types/menu"
import { orderStore } from "@/lib/orderStore"
import { cn } from "@/lib/utils"
import styles from "./order-history.module.css"

interface OrderHistoryProps {
  tableId: string
  onBack: () => void
  onSelectOrder: (order: Order) => void
  onAddToOrder?: (order: Order) => void
  onPayNow?: (order: Order) => void
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  draft: { label: "Draft", icon: <Clock className="h-4 w-4" />, color: "bg-slate-500/10 text-slate-600" },
  active: { label: "Active", icon: <Clock className="h-4 w-4" />, color: "bg-blue-500/10 text-blue-600" },
  sent: { label: "Sent", icon: <Clock className="h-4 w-4" />, color: "bg-amber-500/10 text-amber-600" },
  paid: { label: "Paid", icon: <CheckCircle2 className="h-4 w-4" />, color: "bg-emerald-500/10 text-emerald-600" },
  cancelled: { label: "Cancelled", icon: <XCircle className="h-4 w-4" />, color: "bg-red-500/10 text-red-600" },
  PENDING: { label: "Pending", icon: <Clock className="h-4 w-4" />, color: "bg-yellow-500/10 text-yellow-600" },
  IN_PROGRESS: { label: "In Progress", icon: <Clock className="h-4 w-4" />, color: "bg-blue-500/10 text-blue-600" },
  RECEIVED: { label: "Received", icon: <CheckCircle2 className="h-4 w-4" />, color: "bg-green-500/10 text-green-600" },
  CANCELLED: { label: "Cancelled", icon: <XCircle className="h-4 w-4" />, color: "bg-red-500/10 text-red-600" },
}

export function OrderHistory({ tableId, onBack, onSelectOrder, onAddToOrder, onPayNow }: OrderHistoryProps) {
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    const updateOrders = () => {
      const tableOrders = orderStore.getOrdersByTable(tableId)
      // Sort by most recent first
      const sorted = tableOrders.sort((a, b) => b.createdAt - a.createdAt)
      setOrders(sorted)
    }

    updateOrders()
    const unsubscribe = orderStore.subscribe(updateOrders)
    return unsubscribe
  }, [tableId])

  const unpaidOrders = orders.filter(o => o.paymentStatus === "UNPAID")
  const paidOrders = orders.filter(o => o.paymentStatus === "PAID")

  return (
    <div className={styles.orderHistory}>
      {/* Header */}
      <div className={styles.header}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className={styles.backButton}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className={styles.title}>Your Orders</h1>
          <p className={styles.subtitle}>Table {tableId}</p>
        </div>
      </div>

      {/* Orders List */}
      <div className={styles.ordersList}>
        {/* Unpaid Orders */}
        {unpaidOrders.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Unpaid Orders</h2>
            {unpaidOrders.map((order) => {
              const status = statusConfig[order.status] ?? statusConfig.draft
              return (
                <Card key={order.orderId} className={styles.orderCard}>
                  <CardHeader className={styles.cardHeader}>
                    <div className={styles.cardHeaderTop}>
                      <div>
                        <CardTitle className={styles.orderNumber}>
                          Order #{order.orderId.slice(-8)}
                        </CardTitle>
                        <p className={styles.orderDate}>
                          {new Date(order.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge className={cn(status.color, styles.statusBadge)}>
                        {status.icon}
                        {status.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className={styles.cardContent}>
                    <div className={styles.itemsList}>
                      {order.items.map((item, idx) => (
                        <div key={idx} className={styles.orderItem}>
                          <span className={styles.itemName}>
                            {item.quantity}x {item.name}
                          </span>
                          <span className={styles.itemPrice}>
                            KES {(item.unitPrice * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className={styles.orderFooter}>
                      <div className={styles.total}>
                        <span className={styles.totalLabel}>Total:</span>
                        <span className={styles.totalAmount}>
                          KES {order.total.toLocaleString()}
                        </span>
                      </div>
                      <div className={styles.actions}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSelectOrder(order)}
                          className={styles.viewButton}
                        >
                          View Details
                        </Button>
                        {onAddToOrder && (
                          <Button
                            size="sm"
                            onClick={() => onAddToOrder(order)}
                            className={styles.addButton}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Items
                          </Button>
                        )}
                        {onPayNow && (
                          <Button
                            size="sm"
                            onClick={() => onPayNow(order)}
                            className={styles.payButton}
                          >
                            <CreditCard className="h-7 w-7 mr-2" />
                            <span className="font-bold">Pay Now</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Paid Orders */}
        {paidOrders.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Paid Orders</h2>
            {paidOrders.map((order) => {
              const status = statusConfig[order.status] ?? statusConfig.paid
              return (
                <Card key={order.orderId} className={styles.orderCard}>
                  <CardHeader className={styles.cardHeader}>
                    <div className={styles.cardHeaderTop}>
                      <div>
                        <CardTitle className={styles.orderNumber}>
                          Order #{order.orderId.slice(-8)}
                        </CardTitle>
                        <p className={styles.orderDate}>
                          {new Date(order.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge className={cn(status.color, styles.statusBadge)}>
                        {status.icon}
                        {status.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className={styles.cardContent}>
                    <div className={styles.itemsList}>
                      {order.items.map((item, idx) => (
                        <div key={idx} className={styles.orderItem}>
                          <span className={styles.itemName}>
                            {item.quantity}x {item.name}
                          </span>
                          <span className={styles.itemPrice}>
                            KES {(item.unitPrice * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className={styles.orderFooter}>
                      <div className={styles.total}>
                        <span className={styles.totalLabel}>Total:</span>
                        <span className={styles.totalAmount}>
                          KES {order.total.toLocaleString()}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectOrder(order)}
                        className={styles.viewButton}
                      >
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {orders.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>No orders yet</p>
            <p className={styles.emptySubtext}>Start ordering to see your history</p>
          </div>
        )}
      </div>
    </div>
  )
}

