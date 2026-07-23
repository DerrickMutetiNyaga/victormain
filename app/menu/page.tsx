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
import { Search, History, QrCode, X, TableIcon, ClipboardList } from "lucide-react"
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
import { SiteLogo } from "@/components/branding/site-logo"
import { normalizeKenyaPhone } from "@/lib/phone-utils"
import styles from "./menu.module.css"

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
    fetch("/api/catha/inventory?visibleOnly=true")
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
        }))

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
  // Prices are VAT-inclusive in this app; do not add tax on top.
  const vat = 0
  const total = subtotal

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
      const newTotal = newSubtotal

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

  const handlePaymentSuccess = useCallback(async (
    method: "mpesa" | "cash",
    mpesaReceiptNumber?: string
  ) => {
    const cust = customerNumber ?? null
    const guest = customerNumber == null ? guestSessionId : null
    const normalizedCustomerPhone = normalizeKenyaPhone(customerNumber ?? "") ?? customerNumber ?? null
    const resolvedActiveOrder = activeOrder ?? orderStore.getActiveUnpaidOrder(tableNumber, cust, guest)

    // If activeOrder is already sent/active, the cart is a NEW order — always create fresh
    const isSentOrder = resolvedActiveOrder &&
      (resolvedActiveOrder.status === "sent" || resolvedActiveOrder.status === "active")

    if (resolvedActiveOrder && !isSentOrder) {
      // Existing draft order — update it
      const patch =
        method === "mpesa"
          ? {
              paymentStatus: "PAID" as const,
              status: "paid" as const,
              paymentMethod: "mpesa" as const,
              lastSentAt: Date.now(),
              mpesaReceiptNumber: mpesaReceiptNumber ?? undefined,
              customerPhone: normalizedCustomerPhone ?? undefined,
            } as any
          : { status: "sent" as const, paymentMethod: "cash" as const, lastSentAt: Date.now() }
      await orderStore.updateOrder(resolvedActiveOrder.orderId, patch)
      setPlacedOrderId(resolvedActiveOrder.orderId)
      // Always clear cart — the order is now sent/paid, it lives in Orders
      setCart([])
      if (method === "mpesa") setActiveOrder(null)
    } else if (resolvedActiveOrder && isSentOrder && method === "mpesa" && cart.length === 0) {
      // Pay existing sent cash order via M-Pesa (cash → M-Pesa switch from order tracking)
      await orderStore.updateOrder(resolvedActiveOrder.orderId, {
        paymentStatus: "PAID" as const,
        status: "paid" as const,
        paymentMethod: "mpesa" as const,
        lastSentAt: Date.now(),
        mpesaReceiptNumber: mpesaReceiptNumber ?? undefined,
        customerPhone: normalizedCustomerPhone ?? undefined,
      } as any)
      setPlacedOrderId(resolvedActiveOrder.orderId)
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
        customerPhone: method === "mpesa" ? normalizedCustomerPhone ?? undefined : undefined,
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
        customerPhone: method === "mpesa" ? normalizedCustomerPhone ?? undefined : undefined,
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
  }, [activeOrder, cart, customerNumber, guestSessionId, tableNumber, total])

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
      <div className={styles.gate}>
        <div className={styles.gateCard}>
          <div className="text-center space-y-4">
            <div className={styles.gateIcon}>
              <QrCode className="h-10 w-10" />
            </div>
            <div>
              <p className={cn(styles.eyebrow, "mb-2")}>Table Service</p>
              <h1 className={cn(styles.display, "text-3xl")}>Scan your table QR</h1>
              <p className="text-[rgba(242,232,216,0.5)] mt-3 text-sm leading-relaxed">
                Point your camera at the QR code on your table to start ordering
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 my-8">
            <div className="flex-1">
              <div className={styles.hairline} />
            </div>
            <span className={styles.eyebrow}>or</span>
            <div className="flex-1">
              <div className={styles.hairline} />
            </div>
          </div>

          <form onSubmit={handleManualTable} className="space-y-3">
            <div className="space-y-1.5">
              <label className={cn(styles.eyebrow, "block")}>
                Enter your table number
              </label>
              <div className="relative">
                <TableIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[rgba(242,232,216,0.28)] pointer-events-none" />
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
                  className={styles.gateInput}
                />
              </div>
              {manualTableError && (
                <p className="text-[#c07070] text-xs pl-1">{manualTableError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={!manualTableInput.trim()}
              className={styles.primaryBtn}
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
      <div className={styles.page}>
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 relative z-[1]">
          <button
            onClick={() => {
              setShowOrderTracking(false)
              setPlacedOrderId(null)
            }}
            className={styles.trackingBack}
          >
            ← Back to Menu
          </button>
          <div className="text-center space-y-2">
            <p className={styles.eyebrow}>Order Status</p>
            <h1 className={cn(styles.display, "text-3xl")}>Order sent</h1>
            <p className="text-[rgba(242,232,216,0.5)] text-sm">
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
    <div className={styles.page}>

      <header className={styles.header}>

        <div className="max-w-screen-xl mx-auto px-4 sm:px-5">
          <div className={styles.brandPanel}>
            <div className="flex items-center justify-between gap-3 pt-3 pb-2.5 px-3 sm:px-4">

            <div className="min-w-0 flex-1">
              <SiteLogo
                className="h-10 w-[138px] sm:h-11 sm:w-[158px]"
                imageClassName="drop-shadow-[0_5px_12px_rgba(0,0,0,0.3)]"
                priority
              />
              <div className="flex items-center gap-2 mt-1.5">
                <span className={styles.tablePill}>
                  <span className={cn("h-1.5 w-1.5 rounded-full bg-[#e08a3c]", styles.goldShimmer)} />
                  Table {tableNumber}
                </span>
                {customerNumber && (
                  <span className={styles.phonePill}>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#b98a44]/70" />
                    {customerNumber}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">

              <OrderHistoryDrawer
                orders={historyOrders}
                onSelectOrder={(order) => {
                  setPlacedOrderId(order.orderId)
                  setShowOrderTracking(true)
                }}
              >
                <button
                  title="Order History"
                  className={styles.iconBtn}
                >
                  <History className="h-4 w-4" />
                </button>
              </OrderHistoryDrawer>

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
                  className={cn(styles.iconBtn, activeOrders.length > 0 && styles.iconBtnActive)}
                >
                  <ClipboardList className="h-4 w-4" />
                  {activeOrders.length > 0 && (
                    <span className={styles.badge}>
                      {activeOrders.length}
                    </span>
                  )}
                </button>
              </ActiveOrdersDrawer>

            </div>
            </div>
          </div>
        </div>

        <div className="mx-4 mt-2">
          <div className={styles.hairline} />
        </div>

        <div className="max-w-screen-xl mx-auto px-4 sm:px-5 pt-2.5 pb-2.5 sm:pt-3 sm:pb-3">
          <div className={styles.searchWrap}>
            <div className={styles.searchGlow} />
            <div className={styles.searchField}>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none z-10">
                <Search
                  className="h-4 w-4 transition-colors duration-500"
                  style={{ color: searchFocused ? "#c8722a" : "rgba(242,232,216,0.35)" }}
                />
                <span className="hidden sm:block h-4 w-px bg-[rgba(185,138,68,0.2)]" />
              </div>
              <input
                type="text"
                placeholder="Search drinks or brands…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className={styles.searchInput}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl flex items-center justify-center transition-all hover:bg-[rgba(200,114,42,0.12)] active:scale-95 z-10"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-[rgba(242,232,216,0.5)]" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="pb-1">
          <CategoryTabs
            categories={menuCategories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            hasJaba={hasJaba}
            onJabaClick={handleJabaClick}
          />
        </div>

        <div className="max-w-screen-xl mx-auto px-4 sm:px-5 pb-2.5">
          <div className={styles.metaStrip}>
            <p className="text-[12px] text-[rgba(242,232,216,0.6)] font-medium">
              {menuLoading
                ? "Loading menu..."
                : `${filteredProducts.length} item${filteredProducts.length === 1 ? "" : "s"} in ${selectedCategory === "all"
                  ? "all drinks"
                  : (menuCategories.find((c) => c.id === selectedCategory)?.name ?? selectedCategory)
                }`}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className={styles.clearChip}
              >
                Clear search
              </button>
            )}
          </div>
        </div>

      </header>

      {!menuLoading && selectedCategory === "all" && !debouncedSearch && (
        <div ref={jabaSectionRef} className="pt-1 relative z-[1]">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-5">
            <div className={styles.featuredPanel}>
              <PopularRow
                items={menuItems}
                onItemClick={handleItemClick}
                onAddItem={handleAddToCart}
              />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 pb-36 pt-5 relative z-[1]">
        {!debouncedSearch && (
          <div className={styles.sectionLabel}>
            <p className={styles.eyebrow}>
              {selectedCategory === "all"
                ? "All Drinks"
                : menuCategories.find((c) => c.id === selectedCategory)?.name ?? selectedCategory}
            </p>
          </div>
        )}

        {menuLoading ? (
          <div className={styles.grid}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Search className="h-8 w-8 text-[rgba(242,232,216,0.2)]" />
            </div>
            <p className={cn(styles.display, "text-xl")}>No drinks found</p>
            <p className="text-[rgba(242,232,216,0.4)] text-sm mt-2">Try a different search or category</p>
          </div>
        ) : (
          <div className={styles.grid}>
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

      <StickyCartBar
        items={cart}
        total={total}
        onOpenCart={() => setCartOpen(true)}
      />

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
          !!(activeOrder?.status === "sent" || activeOrder?.status === "active")
        }
        mpesaOnly={
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
        <div className={styles.loader}>
          <div className={styles.spinner} />
          <p className="text-[rgba(242,232,216,0.4)] text-sm">Loading menu...</p>
        </div>
      }
    >
      <MenuContent />
    </Suspense>
  )
}
