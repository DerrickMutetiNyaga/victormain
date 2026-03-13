import { Order, OrderStatus, PaymentStatus, PaymentMethod } from "@/types/menu"

type OrderUpdateCallback = (orders: Order[]) => void

const LEGACY_STATUS_MAP: Record<string, OrderStatus> = {
  PENDING: "draft",
  IN_PROGRESS: "sent",
  RECEIVED: "sent",
  CANCELLED: "cancelled",
}

function normalizeOrder(o: any): Order {
  const status = typeof o.status === "string" && LEGACY_STATUS_MAP[o.status]
    ? LEGACY_STATUS_MAP[o.status]
    : (o.status || "draft")
  const paymentStatus: PaymentStatus =
    o.paymentStatus === "PAID" ? "PAID" : "UNPAID"
  const effectiveStatus: OrderStatus =
    paymentStatus === "PAID" ? "paid" : status

  return {
    ...o,
    status: effectiveStatus,
    paymentStatus,
    paymentMethod: (o.paymentMethod as PaymentMethod) ?? undefined,
    customerNumber: o.customerNumber ?? o.customerPart ?? null,
    guestSessionId: o.guestSessionId ?? null,
    lastSentAt: o.lastSentAt ?? undefined,
    updatedAt: o.updatedAt ?? o.createdAt ?? Date.now(),
  }
}

class OrderStore {
  private orders: Order[] = []
  private subscribers: Set<OrderUpdateCallback> = new Set()
  private storageKey = "bar_menu_orders"
  private alertedStorageKey = "bar_alerted_orders"
  private syncedPaidStorageKey = "bar_synced_paid_orders"
  private alertedOrderIds: Set<string> = new Set()
  private syncedPaidOrderIds: Set<string> = new Set()

  private loadAlertedFromStorage() {
    if (typeof window === "undefined") return
    try {
      const stored = localStorage.getItem(this.alertedStorageKey)
      if (stored) this.alertedOrderIds = new Set(JSON.parse(stored) as string[])
    } catch {}
    try {
      const stored2 = localStorage.getItem(this.syncedPaidStorageKey)
      if (stored2) this.syncedPaidOrderIds = new Set(JSON.parse(stored2) as string[])
    } catch {}
  }

  private saveAlertedToStorage() {
    if (typeof window === "undefined") return
    try {
      const arr = [...this.alertedOrderIds].slice(-500)
      localStorage.setItem(this.alertedStorageKey, JSON.stringify(arr))
    } catch {}
    try {
      const arr2 = [...this.syncedPaidOrderIds].slice(-500)
      localStorage.setItem(this.syncedPaidStorageKey, JSON.stringify(arr2))
    } catch {}
  }

  constructor() {
    this.loadFromStorage()
    this.loadAlertedFromStorage()
    if (typeof window !== "undefined") {
      this.loadFromMongoDB()
      window.addEventListener("storage", this.handleStorageChange.bind(this))
      setInterval(() => this.loadFromMongoDB(), 2000)
    }
  }

  private async loadFromMongoDB() {
    if (typeof window === "undefined") return
    try {
      const response = await fetch("/api/catha/menu-orders")
      if (!response.ok) return
      const orders = await response.json()
      const formattedOrders = orders.map((o: any) =>
        normalizeOrder({
          ...o,
          createdAt:
            typeof o.createdAt === "number"
              ? o.createdAt
              : new Date(o.createdAt).getTime(),
        })
      )
      if (JSON.stringify(this.orders) !== JSON.stringify(formattedOrders)) {
        this.orders = formattedOrders
        this.saveToStorage()
        this.notifySubscribers()
      }

      for (const order of formattedOrders) {
        // Re-alert bar for sent/active orders that never made it through
        if (
          (order.status === "sent" || order.status === "active") &&
          !this.alertedOrderIds.has(order.orderId)
        ) {
          this.alertBar(order)
        }

        // Sync payment status for paid orders whose admin record hasn't been updated yet
        if (order.status === "paid" && !this.syncedPaidOrderIds.has(order.orderId)) {
          this.syncedPaidOrderIds.add(order.orderId)
          this.saveAlertedToStorage()
          this.syncPaymentToAdmin(order)
        }
      }
    } catch {
      // Silently fail
    }
  }

  private handleStorageChange(e: StorageEvent) {
    if (e.key === this.storageKey && e.newValue) {
      try {
        const newOrders = JSON.parse(e.newValue).map((o: any) =>
          normalizeOrder({ ...o, createdAt: o.createdAt || Date.now() })
        )
        if (JSON.stringify(this.orders) !== JSON.stringify(newOrders)) {
          this.orders = newOrders
          this.notifySubscribers()
        }
      } catch {}
    }
  }

  private loadFromStorage() {
    if (typeof window === "undefined") return
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        this.orders = JSON.parse(stored).map((o: any) =>
          normalizeOrder({ ...o, createdAt: o.createdAt || Date.now() })
        )
      }
    } catch {}
  }

  private saveToStorage() {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.orders))
    } catch {}
  }

  private notifySubscribers() {
    const orders = [...this.orders]
    this.subscribers.forEach((cb) => {
      try {
        cb(orders)
      } catch {}
    })
  }

  subscribe(callback: OrderUpdateCallback): () => void {
    this.subscribers.add(callback)
    callback([...this.orders])
    return () => this.subscribers.delete(callback)
  }

  getOrders(): Order[] {
    return [...this.orders]
  }

  getOrder(orderId: string): Order | undefined {
    return this.orders.find((o) => o.orderId === orderId)
  }

  /** Get the single unpaid/draft order for (tableNumber, customerNumber) or (tableNumber, guestSessionId).
   *  When a customerNumber is supplied we search ALL tables so returning customers always find their unpaid order. */
  getActiveUnpaidOrder(
    tableNumber: string,
    customerNumber: string | null,
    guestSessionId: string | null
  ): Order | undefined {
    return this.orders.find((o) => {
      if (o.paymentStatus === "PAID") return false
      if (o.status === "cancelled") return false

      if (customerNumber != null && customerNumber !== "") {
        // Customer-wide: match on phone number regardless of table
        return o.customerNumber === customerNumber
      }
      // Guest: still requires table match
      if (o.tableId !== tableNumber && String(o.tableNumber) !== tableNumber)
        return false
      return o.guestSessionId === guestSessionId
    })
  }

  async createOrder(
    order: Omit<Order, "orderId" | "createdAt">
  ): Promise<Order> {
    const newOrder: Order = {
      ...order,
      orderId: this.generateOrderId(),
      createdAt: Date.now(),
    }

    try {
      const response = await fetch("/api/catha/menu-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOrder),
      })
      if (!response.ok) throw new Error("Failed to save")
    } catch (e) {
      console.error("Error saving order:", e)
    }

    // Alert bar when order is sent, active, or paid — not for drafts
    if (newOrder.status === "sent" || newOrder.status === "active" || newOrder.status === "paid") {
      await this.alertBar(newOrder)
    }

    this.orders.push(newOrder)
    this.saveToStorage()
    this.notifySubscribers()
    return newOrder
  }

  async updateOrder(orderId: string, patch: Partial<Order>): Promise<Order | null> {
    const index = this.orders.findIndex((o) => o.orderId === orderId)
    if (index === -1) return null

    const updated = { ...this.orders[index], ...patch, updatedAt: Date.now() }
    this.orders[index] = updated

    try {
      const response = await fetch("/api/catha/menu-orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, ...patch }),
      })
      if (!response.ok) throw new Error("Failed to update")
    } catch (e) {
      console.error("Error updating order:", e)
    }

    // Alert bar when order is newly sent/active (not yet alerted)
    if (patch.status === "sent" || patch.status === "active") {
      await this.alertBar(updated)
    }

    // When payment is completed, sync the admin order's payment status too
    // (the admin order may already exist from the initial cash alert)
    if (patch.status === "paid" || patch.paymentStatus === "PAID") {
      await this.syncPaymentToAdmin(updated)
    }

    this.saveToStorage()
    this.notifySubscribers()
    return updated
  }

  /** Push a payment status update to the admin orders collection */
  private async syncPaymentToAdmin(order: Order): Promise<void> {
    try {
      const receipt = (order as any).mpesaReceiptNumber ?? undefined
      // First try to UPDATE the existing admin order (cash → M-Pesa switch or cash confirmed paid)
      const res = await fetch(`/api/catha/orders`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: order.orderId,
          status: "completed",
          paymentStatus: "PAID",
          paymentMethod: order.paymentMethod ?? "cash",
          ...(receipt ? { mpesaReceiptNumber: receipt } : {}),
        }),
      })

      if (!res.ok) {
        // Admin order might not exist yet — create it via alertBar (bypass alerted guard)
        this.alertedOrderIds.delete(order.orderId)
        await this.alertBar(order)
      }
    } catch (e) {
      console.error("Error syncing payment to admin:", e)
    }
  }

  private async alertBar(order: Order): Promise<void> {
    // Guard: each order is only ever sent to the bar once (persisted across reloads)
    if (this.alertedOrderIds.has(order.orderId)) return
    // NOTE: only mark as alerted AFTER successful POST so failures are retried
    try {
      const payMethod = order.paymentMethod ?? (order.paymentStatus === "PAID" ? "mpesa" : "cash")
      const barOrder = {
        id: order.orderId,
        table: parseInt(order.tableId) || order.tableId,
        customerPhone: order.customerNumber ?? null,
        items: order.items.map((item: any) => ({
          productId: item.id || item.productId || item.name,
          name: item.name,
          quantity: item.quantity,
          price: item.unitPrice || item.price,
        })),
        subtotal: order.total * (1 - 0.16),
        vat: order.total * 0.16,
        total: order.total,
        paymentMethod: payMethod,
        paymentStatus: order.paymentStatus,
        paymentNote:
          payMethod === "mpesa"
            ? `Paid via M-Pesa (${order.customerNumber ?? ""})`
            : "To be paid in cash",
        cashier: "Customer",
        waiter: "Customer",
        orderSource: "menu",
        timestamp: new Date(order.createdAt),
        status: order.paymentStatus === "PAID" ? "completed" : "pending",
        ...((order as any).mpesaReceiptNumber ? { mpesaReceiptNumber: (order as any).mpesaReceiptNumber } : {}),
      }
      const res = await fetch("/api/catha/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(barOrder),
      })
      // Only mark alerted when the request succeeded (2xx) so we retry on failure
      if (res.ok) {
        this.alertedOrderIds.add(order.orderId)
        this.saveAlertedToStorage()

        // Notify admin: customer wants to pay cash — server can go collect
        if (payMethod === "cash") {
          fetch("/api/catha/cash-payment-requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: order.orderId,
              tableNumber: order.tableId || order.tableNumber,
              amount: order.total,
            }),
          }).catch(() => {})
        }
      }
    } catch (e) {
      console.error("Error alerting bar — will retry:", e)
    }
  }

  private generateOrderId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `${timestamp}-${random}`.toUpperCase()
  }

  getActiveOrders(): Order[] {
    return this.orders.filter(
      (o) =>
        o.paymentStatus !== "PAID" &&
        o.status !== "cancelled"
    )
  }

  getOrdersByTable(tableId: string): Order[] {
    return this.orders.filter(
      (o) => o.tableId === tableId || String(o.tableNumber) === tableId
    )
  }

  getOrdersByCustomer(tableId: string, customerNumber: string | null, guestSessionId: string | null): Order[] {
    return this.orders
      .filter((o) => {
        if (customerNumber != null && customerNumber !== "") {
          // Customer-wide: all orders for this phone number, any table
          return o.customerNumber === customerNumber
        }
        // Guest: table-scoped
        return (
          (o.tableId === tableId || String(o.tableNumber) === tableId) &&
          o.guestSessionId === guestSessionId
        )
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }
}

let orderStoreInstance: OrderStore | null = null

export const orderStore = (() => {
  if (typeof window === "undefined") {
    return {
      subscribe: () => () => {},
      getOrders: () => [],
      getOrder: () => undefined,
      createOrder: async () => ({} as Order),
      updateOrder: async () => null,
      getActiveOrders: () => [],
      getOrdersByTable: () => [],
      getActiveUnpaidOrder: () => undefined,
      getOrdersByCustomer: () => [],
    } as OrderStore
  }
  if (!orderStoreInstance) orderStoreInstance = new OrderStore()
  return orderStoreInstance
})()
