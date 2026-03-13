"use client"

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  Suspense,
  useRef,
} from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ShoppingCart, Search, History, QrCode, X, TableIcon, ClipboardList } from "lucide-react"
import { ProductCard } from "@/components/menu/product-card"
import { CartDrawer } from "@/components/menu/cart-drawer"
import { CategoryTabs } from "@/components/menu/category-tabs"
import { PopularRow } from "@/components/menu/PopularRow"
import { ProductSheet } from "@/components/menu/ProductSheet"
import { StickyCartBar } from "@/components/menu/StickyCartBar"
import { PaymentModal } from "@/components/menu/payment-modal"
import { OrderTracking } from "@/components/menu/order-tracking"
import { OrderHistoryDrawer } from "@/components/menu/order-history-drawer"
import { ActiveOrdersDrawer } from "@/components/menu/active-orders-drawer"
import { CustomerNumberModal } from "@/components/menu/customer-number-modal"
import { orderStore } from "@/lib/orderStore"
import { MenuItem, CartItem, Order, MenuCategory } from "@/types/menu"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"

const GUEST_SESSION_KEY = "menu_guest_session"
const MENU_TABLE_KEY = "menu_table"

function getOrCreateGuestSessionId(): string {
  if (typeof window === "undefined") return ""
  let id = sessionStorage.getItem(GUEST_SESSION_KEY)
  if (!id) {
    id = `g-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    sessionStorage.setItem(GUEST_SESSION_KEY, id)
  }
  return id
}

function MenuContent() {
  const searchParams = useSearchParams()
  const tableFromQuery = searchParams.get("t") || searchParams.get("table")
  const tableRef = useRef<string | null>(null)

  const [tableNumber, setTableNumber] = useState<string>("")
  const [manualTableInput, setManualTableInput] = useState("")
  const [manualTableError, setManualTableError] = useState("")
  const [customerNumber, setCustomerNumber] = useState<string | null>(null)
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null)
  const [customerNumberResolved, setCustomerNumberResolved] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [productSheetOpen, setProductSheetOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null)
  const [showOrderTracking, setShowOrderTracking] = useState(false)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([])
  const [menuLoading, setMenuLoading] = useState(true)
  const jabaSectionRef = useRef<HTMLDivElement>(null)

  const debouncedSearch = useDebounce(searchQuery, 150)

  const hasJaba = menuItems.some((i) => i.isJaba)

  useEffect(() => {
    document.title = "Menu | Catha Lounge"
  }, [])

  const handleJabaClick = () => {
    setSelectedCategory("all")
    setSearchQuery("")
    setTimeout(() => {
      jabaSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }

  // Fetch real products from inventory
  useEffect(() => {
    fetch("/api/catha/inventory")
      .then((r) => r.json())
      .then((data) => {
        if (!data.products) return
        const items: MenuItem[] = data.products.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.size ? `${p.size}${p.unit ? " " + p.unit : ""}` : (p.unit || ""),
          price: p.price,
          image: p.image && p.image !== "/placeholder.svg" ? p.image : "/placeholder.jpg",
          category: p.category?.toLowerCase().replace(/\s+/g, "-") || "other",
          inStock: (p.stock || 0) > 0,
          isPopular: false,
          isJaba: p.isJaba === true,
        })).filter((i: MenuItem) => i.inStock)

        const seenCats = new Set<string>()
        const cats: MenuCategory[] = []
        data.products.forEach((p: any) => {
          const catId = p.category?.toLowerCase().replace(/\s+/g, "-") || "other"
          const catName = p.category ? p.category.charAt(0).toUpperCase() + p.category.slice(1) : "Other"
          if (!seenCats.has(catId)) {
            seenCats.add(catId)
            cats.push({ id: catId, name: catName })
          }
        })

        setMenuItems(items)
        setMenuCategories(cats)
      })
      .catch(console.error)
      .finally(() => setMenuLoading(false))
  }, [])

  // Parse table from URL
  useEffect(() => {
    if (tableFromQuery) {
      const t = String(tableFromQuery).trim()
      setTableNumber(t)
      tableRef.current = t
      if (typeof window !== "undefined") {
        sessionStorage.setItem(MENU_TABLE_KEY, t)
      }
    } else if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(MENU_TABLE_KEY)
      if (stored) {
        setTableNumber(stored)
        tableRef.current = stored
      }
    }
  }, [tableFromQuery])

  // Restore phone from session
  useEffect(() => {
    if (typeof window === "undefined") return
    const cust = sessionStorage.getItem("menu_customer_number")
    if (cust) {
      setCustomerNumber(cust)
      setGuestSessionId(null)
      setCustomerNumberResolved(true)
    }
  }, [])

  // Auto-show phone modal as soon as we have a table but no resolved customer yet
  useEffect(() => {
    if (tableNumber && !customerNumberResolved) {
      setShowCustomerModal(true)
    }
  }, [tableNumber, customerNumberResolved])

  // Load active unpaid order when table + customer/guest are known
  useEffect(() => {
    if (!tableNumber || !customerNumberResolved) return

    const loadActive = () => {
      const cust = customerNumber ?? null
      const guest = customerNumber == null ? guestSessionId : null
      const order = orderStore.getActiveUnpaidOrder(tableNumber, cust, guest)
      setActiveOrder(order ?? null)

      if (!order) {
        // No active unpaid order — the customer's order was paid/cancelled by admin
        // or they haven't started one yet. Clear any leftover cart items that
        // belonged to a now-completed order (a fresh cart would have no draft).
        const hasDraft = orderStore.getOrders().some(
          (o) =>
            o.status === "draft" &&
            (cust ? o.customerNumber === cust : o.guestSessionId === guest)
        )
        if (!hasDraft) setCart([])
        return
      }

      if (order.status === "draft") {
        // Draft: pre-fill cart so customer can continue editing
        setCart(order.items)
      } else {
        // Sent / active: order is at the bar — clear cart unless user is building NEW items
        setCart((prev) => {
          const orderItemIds = new Set(order.items.map((i) => i.id))
          const hasNewItems = prev.some((i) => !orderItemIds.has(i.id))
          return hasNewItems ? prev : []
        })
      }
    }

    loadActive()
    const unsub = orderStore.subscribe(loadActive)
    return unsub
  }, [tableNumber, customerNumber, guestSessionId, customerNumberResolved])

  const handleCustomerContinue = useCallback((cust: string) => {
    setCustomerNumber(cust)
    setGuestSessionId(null)
    sessionStorage.setItem("menu_customer_number", cust)
    sessionStorage.removeItem("menu_is_guest")
    setCustomerNumberResolved(true)
    setShowCustomerModal(false)
  }, [])

  const filteredProducts = useMemo(() => {
    let filtered = menuItems
    if (selectedCategory !== "all") {
      filtered = filtered.filter((p) => p.category === selectedCategory)
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      )
    }
    return filtered
  }, [menuItems, selectedCategory, debouncedSearch])

  const subtotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [cart]
  )
  const vat = useMemo(() => Math.round(subtotal * 0.16 * 100) / 100, [subtotal])
  const total = useMemo(() => subtotal + vat, [subtotal, vat])

  const handleAddToCart = useCallback(
    (item: MenuItem) => {
      if (!tableNumber) return

      if (!customerNumberResolved) {
        setShowCustomerModal(true)
        return
      }

      setCart((prev) => {
        const existing = prev.find((i) => i.id === item.id)
        const next = existing
          ? prev.map((i) =>
              i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
            )
          : [
              ...prev,
              {
                id: item.id,
                name: item.name,
                quantity: 1,
                unitPrice: item.price,
                image: item.image,
              },
            ]
        syncCartToOrder(next)
        return next
      })
    },
    [tableNumber, customerNumberResolved]
  )

  const syncCartToOrder = useCallback(
    async (items: CartItem[]) => {
      if (!tableNumber || !customerNumberResolved) return

      const cust = customerNumber ?? null
      const guest = customerNumber == null ? guestSessionId : null
      const existing = orderStore.getActiveUnpaidOrder(tableNumber, cust, guest)

      // Never modify an order that's already been sent to / accepted by the bar.
      // Those stay untouched — the cart is for a NEW order only.
      if (existing && (existing.status === "sent" || existing.status === "active")) {
        return
      }

      const newSubtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
      const newTotal = Math.round((newSubtotal * 1.16) * 100) / 100

      if (existing) {
        await orderStore.updateOrder(existing.orderId, {
          items,
          total: newTotal,
        })
        setActiveOrder({ ...existing, items, total: newTotal })
      } else if (items.length > 0) {
        const order = await orderStore.createOrder({
          tableId: tableNumber,
          tableNumber,
          customerNumber: cust,
          guestSessionId: guest,
          status: "draft",
          paymentStatus: "UNPAID",
          items,
          total: newTotal,
        })
        setActiveOrder(order)
      }
    },
    [tableNumber, customerNumber, guestSessionId, customerNumberResolved]
  )

  const handleUpdateQuantity = useCallback(
    (id: string, quantity: number) => {
      setCart((prev) => {
        if (quantity <= 0) {
          const next = prev.filter((i) => i.id !== id)
          syncCartToOrder(next)
          return next
        }
        const next = prev.map((i) =>
          i.id === id ? { ...i, quantity } : i
        )
        syncCartToOrder(next)
        return next
      })
    },
    [syncCartToOrder]
  )

  const handleRemoveItem = useCallback(
    (id: string) => {
      setCart((prev) => {
        const next = prev.filter((i) => i.id !== id)
        syncCartToOrder(next)
        return next
      })
    },
    [syncCartToOrder]
  )

  // Clicking "Send Order" in cart opens the payment method selection
  const handleSendNow = useCallback(() => {
    if (!tableNumber || cart.length === 0) return
    setCartOpen(false)
    setShowPaymentModal(true)
  }, [tableNumber, cart.length])

  const handlePayNow = useCallback(() => {
    setCartOpen(false)
    setShowPaymentModal(true)
  }, [])

  // When order already at bar and customer wants to switch from cash → M-Pesa
  const handlePayMpesa = useCallback(() => {
    setCartOpen(false)
    setShowPaymentModal(true)
  }, [])

  const handlePaymentSuccess = useCallback(async (method: "mpesa" | "cash", mpesaReceiptNumber?: string) => {
    const cust = customerNumber ?? null

    // If activeOrder is already sent/active, the cart is a NEW order — always create fresh
    const isSentOrder = activeOrder &&
      (activeOrder.status === "sent" || activeOrder.status === "active")

    if (activeOrder && !isSentOrder) {
      // Existing draft order — update it
      const patch =
        method === "mpesa"
          ? { paymentStatus: "PAID" as const, status: "paid" as const, paymentMethod: "mpesa" as const, lastSentAt: Date.now(), mpesaReceiptNumber: mpesaReceiptNumber ?? undefined } as any
          : { status: "sent" as const, paymentMethod: "cash" as const, lastSentAt: Date.now() }
      await orderStore.updateOrder(activeOrder.orderId, patch)
      setPlacedOrderId(activeOrder.orderId)
      // Always clear cart — the order is now sent/paid, it lives in Orders
      setCart([])
      if (method === "mpesa") setActiveOrder(null)
    } else if (isSentOrder && method === "mpesa" && cart.length === 0) {
      // Pay existing sent cash order via M-Pesa (cash → M-Pesa switch from order tracking)
      await orderStore.updateOrder(activeOrder.orderId, {
        paymentStatus: "PAID" as const,
        status: "paid" as const,
        paymentMethod: "mpesa" as const,
        lastSentAt: Date.now(),
        mpesaReceiptNumber: mpesaReceiptNumber ?? undefined,
      } as any)
      setPlacedOrderId(activeOrder.orderId)
      setActiveOrder(null)
    } else if (isSentOrder && cart.length > 0) {
      // Cart has new items on top of an existing sent order → brand new order
      const order = await orderStore.createOrder({
        tableId: tableNumber,
        tableNumber,
        customerNumber: cust,
        guestSessionId: null,
        status: method === "mpesa" ? "paid" : "sent",
        paymentStatus: method === "mpesa" ? "PAID" : "UNPAID",
        paymentMethod: method,
        items: cart,
        total,
        lastSentAt: Date.now(),
        ...(mpesaReceiptNumber ? { mpesaReceiptNumber } : {}),
      } as any)
      setPlacedOrderId(order.orderId)
      setCart([])
    } else if (cart.length > 0) {
      const order = await orderStore.createOrder({
        tableId: tableNumber,
        tableNumber,
        customerNumber: cust,
        guestSessionId: null,
        status: method === "mpesa" ? "paid" : "sent",
        paymentStatus: method === "mpesa" ? "PAID" : "UNPAID",
        paymentMethod: method,
        items: cart,
        total,
        lastSentAt: Date.now(),
        ...(mpesaReceiptNumber ? { mpesaReceiptNumber } : {}),
      } as any)
      setPlacedOrderId(order.orderId)
      // Always clear cart after sending
      setCart([])
      if (method === "mpesa") setActiveOrder(null)
    }

    setShowPaymentModal(false)
    setCartOpen(false)
    setShowOrderTracking(true)
  }, [activeOrder, cart, customerNumber, tableNumber, total])

  const handleItemClick = useCallback((item: MenuItem) => {
    setSelectedItem(item)
    setProductSheetOpen(true)
  }, [])

  const getItemQuantity = useCallback(
    (itemId: string) => cart.find((i) => i.id === itemId)?.quantity ?? 0,
    [cart]
  )

  const handleAddFromSheet = useCallback(() => {
    if (selectedItem) {
      const q = getItemQuantity(selectedItem.id)
      handleAddToCart(selectedItem)
      if (q === 0) setTimeout(() => setProductSheetOpen(false), 150)
    }
  }, [selectedItem, handleAddToCart, getItemQuantity])

  const handleRemoveFromSheet = useCallback(() => {
    if (selectedItem) {
      handleUpdateQuantity(
        selectedItem.id,
        Math.max(0, getItemQuantity(selectedItem.id) - 1)
      )
    }
  }, [selectedItem, handleUpdateQuantity, getItemQuantity])

  const allOrders = useMemo(() => {
    if (!tableNumber || !customerNumberResolved) return []
    return orderStore.getOrdersByCustomer(
      tableNumber,
      customerNumber,
      guestSessionId
    )
  }, [tableNumber, customerNumber, guestSessionId, customerNumberResolved, activeOrder])

  // Unpaid / active orders sent to bar (not yet paid, not draft, not cancelled)
  const activeOrders = useMemo(
    () => allOrders.filter(
      (o) => o.paymentStatus === "UNPAID" && (o.status === "sent" || o.status === "active") 
    ),
    [allOrders]
  )

  // History = only fully paid orders
  const historyOrders = useMemo(
    () => allOrders.filter((o) => o.paymentStatus === "PAID" || o.status === "paid"),
    [allOrders]
  )

  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0)

  // ─── No table: QR scan prompt + manual entry ─────────────────────────────
  if (!tableNumber) {
    const handleManualTable = (e: React.FormEvent) => {
      e.preventDefault()
      const t = manualTableInput.trim()
      if (!t || !/^\d+$/.test(t)) {
        setManualTableError("Enter a valid table number (digits only)")
        return
      }
      setManualTableError("")
      setTableNumber(t)
      tableRef.current = t
      if (typeof window !== "undefined") {
        sessionStorage.setItem(MENU_TABLE_KEY, t)
      }
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0A0A0F]">
        <div className="max-w-sm w-full space-y-8">
          {/* QR hint */}
          <div className="text-center space-y-4">
            <div className="h-20 w-20 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mx-auto">
              <QrCode className="h-10 w-10 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Scan your table QR</h1>
              <p className="text-white/50 mt-2 text-sm leading-relaxed">
                Point your camera at the QR code on your table to start ordering
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-white/25 text-xs font-medium uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          {/* Manual table entry */}
          <form onSubmit={handleManualTable} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-white/50 text-xs font-semibold uppercase tracking-widest block">
                Enter your table number
              </label>
              <div className="relative">
                <TableIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="e.g. 12"
                  value={manualTableInput}
                  onChange={(e) => {
                    setManualTableInput(e.target.value.replace(/\D/g, ""))
                    setManualTableError("")
                  }}
                  className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/[0.07] border border-white/[0.10] text-white placeholder:text-white/25 text-base focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-all"
                />
              </div>
              {manualTableError && (
                <p className="text-red-400 text-xs pl-1">{manualTableError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={!manualTableInput.trim()}
              className="w-full h-12 rounded-xl font-bold text-[15px] bg-gradient-to-r from-amber-500 to-amber-400 text-black disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              Go to Menu
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ─── Order tracking screen ────────────────────────────────────────────────
  if (showOrderTracking && placedOrderId) {
    const currentOrder = orderStore.getOrder(placedOrderId)
    return (
      <div className="min-h-screen bg-[#0A0A0F]">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <button
            onClick={() => {
              setShowOrderTracking(false)
              setPlacedOrderId(null)
            }}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium"
          >
            ← Back to Menu
          </button>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-white">Order sent! 🎉</h1>
            <p className="text-white/50 text-sm">
              Your order has been received and is being prepared
            </p>
          </div>
          {currentOrder && (
            <OrderTracking
              orderId={placedOrderId}
              onBack={() => {
                setShowOrderTracking(false)
                setPlacedOrderId(null)
              }}
              onAddItems={(order) => {
                setActiveOrder(order)
                setCart(order.items)
                setShowOrderTracking(false)
                setCartOpen(true)
              }}
              onPayNow={() => {
                setActiveOrder(currentOrder)
                setShowOrderTracking(false)
                setShowPaymentModal(true)
              }}
            />
          )}
        </div>
      </div>
    )
  }

  // ─── Main menu view ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0F]">

      {/* ══════════════════════════════════════════════════
          PREMIUM HEADER — 3 LAYERS
      ══════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40"
        style={{ background: "linear-gradient(180deg, #0f172a 0%, #0d1520 100%)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", boxShadow: "0 1px 0 rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.4)" }}>

        {/* ── LAYER 1: BRAND + STATUS + ACTION ICONS ── */}
        <div className="max-w-screen-xl mx-auto px-4 sm:px-5">
          <div className="flex items-center justify-between gap-3 pt-4 pb-3">

            {/* Left: logo + status pills */}
            <div className="min-w-0 flex-1">
              <h1 className="text-[18px] sm:text-[20px] font-extrabold text-white tracking-tight leading-none"
                style={{ letterSpacing: "-0.02em" }}>
                Catha Lounge
              </h1>
              <div className="flex items-center gap-2 mt-2">
                {/* Table badge */}
                <span className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[11px] font-semibold"
                  style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
                  Table {tableNumber}
                </span>
                {/* Phone pill — green soft glow */}
                {customerNumber && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[11px] font-semibold"
                    style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.18)", boxShadow: "0 0 8px rgba(16,185,129,0.12)" }}>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
                    {customerNumber}
                  </span>
                )}
              </div>
            </div>

            {/* Right: circular glass buttons */}
            <div className="flex items-center gap-2 shrink-0">

              {/* 1. History — paid orders */}
              <OrderHistoryDrawer
                orders={historyOrders}
                onSelectOrder={(order) => {
                  setPlacedOrderId(order.orderId)
                  setShowOrderTracking(true)
                }}
              >
                <button
                  title="Order History"
                  className="relative h-10 w-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}
                >
                  <History className="h-[18px] w-[18px] text-white/65" />
                </button>
              </OrderHistoryDrawer>

              {/* 2. Active Orders — unpaid/sent */}
              <ActiveOrdersDrawer
                orders={activeOrders}
                onSelectOrder={(order) => {
                  setPlacedOrderId(order.orderId)
                  setShowOrderTracking(true)
                }}
                onPayNow={(order) => {
                  setActiveOrder(order)
                  setShowPaymentModal(true)
                }}
              >
                <button
                  title="My Orders"
                  className="relative h-10 w-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{ background: activeOrders.length > 0 ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.06)", border: activeOrders.length > 0 ? "1px solid rgba(245,158,11,0.2)" : "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}
                >
                  <ClipboardList className={cn("h-[18px] w-[18px]", activeOrders.length > 0 ? "text-amber-400" : "text-white/65")} />
                  {activeOrders.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center animate-pulse">
                      {activeOrders.length}
                    </span>
                  )}
                </button>
              </ActiveOrdersDrawer>

              {/* 3. Cart — items being built */}
              <button
                title="Cart"
                className="relative h-10 w-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
                style={{ background: cartItemCount > 0 ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.06)", border: cartItemCount > 0 ? "1px solid rgba(245,158,11,0.2)" : "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}
                onClick={() => setCartOpen(true)}
              >
                <ShoppingCart className={cn("h-[18px] w-[18px]", cartItemCount > 0 ? "text-amber-400" : "text-white/65")} />
                {cartItemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center">
                    {cartItemCount > 99 ? "99+" : cartItemCount}
                  </span>
                )}
              </button>

            </div>
          </div>
        </div>

        {/* Subtle separator */}
        <div className="mx-4" style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05) 30%, rgba(255,255,255,0.05) 70%, transparent)" }} />

        {/* ── LAYER 2: REDESIGNED SEARCH BAR ── */}
        <div className="max-w-screen-xl mx-auto px-4 sm:px-5 pt-3 pb-3 sm:pt-4 sm:pb-4">
          <div className="relative group">
            <div
              className="absolute -inset-px rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"
              style={{
                background: "linear-gradient(135deg, rgba(245,158,11,0.4), rgba(251,191,36,0.15), transparent 60%)",
                borderRadius: "inherit",
              }}
            />
            <div className="relative flex items-center rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.2)",
              }}>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                <Search className="h-4 w-4 transition-colors duration-200"
                  style={{ color: searchFocused ? "rgba(245,158,11,0.9)" : "rgba(255,255,255,0.35)" }} />
                <span className="hidden sm:block h-4 w-px bg-white/10" />
              </div>
              <input
                type="text"
                placeholder="Search drinks or brands…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full h-12 sm:h-14 pl-12 sm:pl-14 pr-12 bg-transparent text-white placeholder:text-white/25 outline-none text-[15px] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 active:scale-95"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-white/50" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── LAYER 3: CATEGORY SCROLL PILLS ── */}
        <div className="pb-1">
          <CategoryTabs
            categories={menuCategories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            hasJaba={hasJaba}
            onJabaClick={handleJabaClick}
          />
        </div>

      </header>

      {/* ── JABA ROW ── */}
      {!menuLoading && selectedCategory === "all" && !debouncedSearch && (
        <div ref={jabaSectionRef}>
          <PopularRow items={menuItems} onItemClick={handleItemClick} />
        </div>
      )}

      {/* ── PRODUCTS GRID ── */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 pb-36 pt-4">
        {/* Section heading */}
        {!debouncedSearch && (
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-1 rounded-full bg-amber-500" />
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">
              {selectedCategory === "all"
                ? "All Drinks"
                : menuCategories.find((c) => c.id === selectedCategory)?.name ?? selectedCategory}
            </p>
          </div>
        )}

        {menuLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/[0.05] animate-pulse aspect-[3/4]" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-white/[0.05] flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-white/20" />
            </div>
            <p className="text-white font-semibold">No drinks found</p>
            <p className="text-white/40 text-sm mt-1">Try a different search or category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {filteredProducts.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                onAdd={handleAddToCart}
                onClick={handleItemClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── STICKY CART BAR ── */}
      <StickyCartBar
        items={cart}
        total={total}
        onOpenCart={() => setCartOpen(true)}
      />

      {/* ── PRODUCT DETAIL SHEET ── */}
      {selectedItem && (
        <ProductSheet
          open={productSheetOpen}
          onOpenChange={setProductSheetOpen}
          item={selectedItem}
          quantity={getItemQuantity(selectedItem.id)}
          onAdd={handleAddFromSheet}
          onRemove={handleRemoveFromSheet}
        />
      )}

      {/* ── CART DRAWER ── */}
      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        items={cart}
        tableNumber={tableNumber}
        customerNumber={customerNumber}
        onUpdateQuantity={handleUpdateQuantity}
        onRemove={handleRemoveItem}
        onSendNow={handleSendNow}
        onPayMpesa={handlePayMpesa}
        total={total}
        subtotal={subtotal}
        vat={vat}
        existingOrderId={activeOrder?.orderId}
        isAddingToExisting={!!activeOrder}
        activeOrderStatus={activeOrder?.status}
        activeOrderPaymentMethod={activeOrder?.paymentMethod}
        activeOrderTotal={activeOrder?.total}
      />

      {/* ── MODALS ── */}
      <CustomerNumberModal
        open={showCustomerModal}
        onContinue={handleCustomerContinue}
      />

      <PaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        amount={activeOrder?.total ?? total}
        phone={customerNumber ?? ""}
        onSuccess={handlePaymentSuccess}
        skipToMpesa={
          // Order already at the bar — go straight to M-Pesa, no cash option
          !!(activeOrder?.status === "sent" || activeOrder?.status === "active")
        }
        mpesaOnly={
          // Hide cash entirely for orders already at the bar
          !!(activeOrder?.status === "sent" || activeOrder?.status === "active")
        }
      />
    </div>
  )
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
            <p className="text-white/40 text-sm">Loading menu...</p>
          </div>
        </div>
      }
    >
      <MenuContent />
    </Suspense>
  )
}
