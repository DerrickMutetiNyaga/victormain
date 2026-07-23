"use client"

import React from "react"
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { History, Receipt, ChevronDown } from "lucide-react"
import { Order } from "@/types/menu"
import { cn } from "@/lib/utils"
import styles from "./order-lifecycle.module.css"
import {
  formatOrderLabel,
  formatOrderTime,
  orderItemCount,
  orderTotal,
  groupOrdersByDay,
  relativeDayLabel,
  maskPhone,
} from "./order-display"

function HistoryReceipt({
  order,
  onReorder,
}: {
  order: Order
  onReorder?: (order: Order) => void
}) {
  const [open, setOpen] = React.useState(false)
  const total = orderTotal(order)
  const count = orderItemCount(order)
  const method =
    order.paymentMethod === "mpesa"
      ? "M-Pesa"
      : order.paymentMethod === "cash"
        ? "Cash"
        : "Paid"
  const paidAt = order.updatedAt ?? order.createdAt

  return (
    <div className={styles.receipt}>
      <button
        type="button"
        className={styles.receiptHeader}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className={styles.receiptIcon}>
          <Receipt className="h-4 w-4" />
        </div>
        <div className={styles.receiptMid}>
          <div className={styles.receiptTitleRow}>
            <span className={styles.orderTitle}>Order {formatOrderLabel(order)}</span>
            <span className={styles.paidBadge}>Paid · {method}</span>
          </div>
          <p className={styles.meta}>
            {relativeDayLabel(order.createdAt)} · {formatOrderTime(order.createdAt)} ·{" "}
            {count} {count === 1 ? "item" : "items"}
          </p>
        </div>
        <div className={styles.receiptRight}>
          <span className={styles.total}>KES {total.toLocaleString()}</span>
          <ChevronDown
            className={cn(styles.chevron, open && styles.chevronOpen)}
            size={16}
          />
        </div>
      </button>

      {open && (
        <div className={styles.receiptBody}>
          <div className={styles.receiptLines}>
            {order.items.map((item, i) => (
              <div key={`${item.id}-${i}`} className={styles.receiptLine}>
                <div>
                  <p className={styles.itemName}>{item.name}</p>
                  <p className={styles.itemMeta}>
                    {item.quantity}× KES {item.unitPrice.toLocaleString()}
                  </p>
                </div>
                <span className={styles.itemLine}>
                  KES {(item.unitPrice * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          <div className={styles.subtotalRow}>
            <span>Subtotal</span>
            <span>
              KES{" "}
              {total.toLocaleString("en-KE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className={styles.totalRow}>
            <span>Total</span>
            <span className={styles.totalRowAmt}>KES {total.toLocaleString()}</span>
          </div>
          <p className={styles.paymentLine}>
            {method}
            {order.paymentMethod === "mpesa" &&
              ` ${maskPhone(order.customerPhone ?? order.customerNumber)}`}
            {" · "}
            {formatOrderTime(paidAt)}
          </p>
          {onReorder && (
            <button
              type="button"
              className={styles.reorderBtn}
              onClick={() => onReorder(order)}
            >
              Reorder
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface OrderHistoryDrawerProps {
  orders: Order[]
  onSelectOrder?: (order: Order) => void
  onAddToOrder?: (order: Order) => void
  onPayNow?: (order: Order) => void
  onReorder?: (order: Order) => void
  children?: React.ReactNode
}

export function OrderHistoryDrawer({
  orders,
  onReorder,
  children,
}: OrderHistoryDrawerProps) {
  const [open, setOpen] = React.useState(false)
  const groups = React.useMemo(() => groupOrdersByDay(orders), [orders])

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {children ?? (
          <button
            type="button"
            className="relative h-10 w-10 rounded-xl bg-[#382C21] border border-[rgba(242,232,216,0.14)] hover:bg-[#403428] flex items-center justify-center transition-colors"
          >
            <History className="h-5 w-5 text-[#D9843B]" />
          </button>
        )}
      </DrawerTrigger>

      <DrawerContent className={cn(styles.sheet, "bg-transparent")}>
        <div className={styles.handle}>
          <div className={styles.handleBar} />
        </div>

        <div className={styles.body}>
          <h2 className={styles.sectionLabel}>Order history</h2>
          {orders.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <Receipt className="h-7 w-7" />
              </div>
              <p className={styles.emptyTitle}>No paid orders yet</p>
              <p className={styles.emptySub}>Completed orders will appear here</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.key}>
                <p className={styles.dayLabel}>{group.label}</p>
                <div className={styles.stack}>
                  {group.orders.map((order) => (
                    <HistoryReceipt
                      key={order.orderId}
                      order={order}
                      onReorder={(o) => {
                        onReorder?.(o)
                        setOpen(false)
                      }}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
