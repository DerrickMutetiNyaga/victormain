"use client"

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import { Order } from "@/types/menu"
import { OrderNotification } from "@/components/orders/order-notification"

// ─── Acknowledgement helpers ──────────────────────────────────────────────────
// We persist which order IDs the bar staff has already been notified about so
// that page refreshes don't flood them with old notifications.
const ACK_KEY = "catha_notified_orders"
const NOTIFY_WINDOW_MS = 10 * 60 * 1000 // show notifications for orders sent in last 10 min

function loadAcked(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const stored = localStorage.getItem(ACK_KEY)
    if (stored) return new Set(JSON.parse(stored) as string[])
  } catch {}
  return new Set()
}

function saveAcked(set: Set<string>) {
  if (typeof window === "undefined") return
  try {
    // Keep only the 200 most recent acks to avoid unbounded growth
    const arr = [...set].slice(-200)
    localStorage.setItem(ACK_KEY, JSON.stringify(arr))
  } catch {}
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface OrderNotificationsContextType {
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
}

const OrderNotificationsContext = createContext<OrderNotificationsContextType | undefined>(undefined)

export function useOrderNotifications() {
  return useContext(OrderNotificationsContext)
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function OrderNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [newOrderPopups, setNewOrderPopups] = useState<Order[]>([])
  const [soundEnabled, setSoundEnabled] = useState(true)

  const isAuthenticated = status === "authenticated" && !!session?.user
  const isMenuPage = pathname?.startsWith("/menu")
  // Only poll for Catha menu-order notifications when the session is a Catha
  // session AND we are not on a Jaba page (Jaba sessions can't access the
  // Catha API; polling would produce silent 401s on every Jaba route).
  const isJabaPage = pathname?.startsWith("/jaba")
  const shouldShowNotifications = isAuthenticated && !isMenuPage && !isJabaPage

  // ackedRef persists across re-renders/polls without triggering re-renders
  const ackedRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)

  // Play notification sound
  const playSound = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = "sine"
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.4)
    } catch {}
  }, [soundEnabled])

  // Accept an order: server who clicks becomes the assigned server
  const acceptOrder = useCallback(async (orderId: string) => {
    const serverName = (session?.user as any)?.name ?? "Server"
    try {
      await fetch("/api/catha/menu-orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "active", receivedBy: serverName }),
      })
      await fetch("/api/catha/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, waiter: serverName }),
      })
    } catch {}
  }, [session?.user])

  const handleDismissPopup = useCallback((orderId: string) => {
    setNewOrderPopups((prev) => prev.filter((o) => o.orderId !== orderId))
  }, [])

  const handleAcceptOrder = useCallback(async (orderId: string) => {
    await acceptOrder(orderId)
    handleDismissPopup(orderId)
  }, [acceptOrder, handleDismissPopup])

  const handleViewOrder = useCallback((orderId: string) => {
    if (typeof window !== "undefined") {
      window.location.href = `/catha/orders#menu-order-${orderId}`
    }
    handleDismissPopup(orderId)
  }, [handleDismissPopup])

  // ─── Direct polling — completely independent of orderStore ────────────────
  useEffect(() => {
    if (!shouldShowNotifications) return

    // Load persisted acks on first run
    if (!initializedRef.current) {
      ackedRef.current = loadAcked()
      initializedRef.current = true
    }

    const poll = async () => {
      try {
        const res = await fetch("/api/catha/menu-orders", { cache: "no-store" })
        if (!res.ok) return
        const orders: any[] = await res.json()

        const now = Date.now()
        const newOrders: Order[] = []

        for (const o of orders) {
          // Only care about orders actually sent/paid to the bar
          if (o.status !== "sent" && o.status !== "paid" && o.status !== "active") continue

          // Only orders sent within the notification window
          const sentAt = typeof o.lastSentAt === "number"
            ? o.lastSentAt
            : o.lastSentAt
            ? new Date(o.lastSentAt).getTime()
            : null

          if (!sentAt || now - sentAt > NOTIFY_WINDOW_MS) continue

          // Skip already acknowledged
          if (ackedRef.current.has(o.orderId)) continue

          // Mark as acked immediately (shown = notified)
          ackedRef.current.add(o.orderId)

          // Only fire popup for "sent" (not "active"/"paid" — those are already handled)
          if (o.status === "sent" || o.status === "paid") {
            newOrders.push(o as Order)
          }
        }

        if (newOrders.length > 0) {
          saveAcked(ackedRef.current)
          setNewOrderPopups((prev) => {
            const existingIds = new Set(prev.map((x) => x.orderId))
            const toAdd = newOrders.filter((o) => !existingIds.has(o.orderId))
            return toAdd.length > 0 ? [...prev, ...toAdd] : prev
          })
          playSound()
        }
      } catch {}
    }

    // Poll immediately, then every 3 seconds
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [shouldShowNotifications, playSound])

  return (
    <OrderNotificationsContext.Provider value={{ soundEnabled, setSoundEnabled }}>
      {children}
      {shouldShowNotifications && newOrderPopups.length > 0 && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-[99999] space-y-3 pointer-events-none w-auto sm:w-auto max-w-[calc(100vw-2rem)] sm:max-w-lg">
          {newOrderPopups.map((order, index) => (
            <div
              key={order.orderId}
              className="pointer-events-auto animate-in slide-in-from-right-5 fade-in-0 zoom-in-95 duration-500 shadow-2xl"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <OrderNotification
                order={order}
                onDismiss={() => handleDismissPopup(order.orderId)}
                onView={() => handleViewOrder(order.orderId)}
                onAccept={() => handleAcceptOrder(order.orderId)}
              />
            </div>
          ))}
        </div>
      )}
    </OrderNotificationsContext.Provider>
  )
}
