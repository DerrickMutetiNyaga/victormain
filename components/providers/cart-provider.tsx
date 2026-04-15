"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react"
import debounce from "lodash.debounce"
import { useShopSession } from "@/components/providers/shop-session-provider"
import { useShopLoginModal } from "@/components/providers/shop-login-modal-provider"
import { toast } from "sonner"

const fetchOpts: RequestInit = { credentials: "include", cache: "no-store" }

export interface CartItem {
  id: string
  name: string
  price: number
  image: string
  quantity: number
  size?: string
}

interface CartContextValue {
  cart: CartItem[]
  loading: boolean
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => Promise<boolean>
  updateQuantity: (uniqueId: string, delta: number) => Promise<void>
  removeItem: (lineId: string) => Promise<void>
  setCart: (items: CartItem[]) => Promise<void>
  clearCart: () => Promise<void>
  refresh: () => Promise<void>
}

export const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: sessionLoading, refreshSession } = useShopSession()
  const openLoginModal = useShopLoginModal()
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartLoading, setCartLoading] = useState(true)

  // Always-current session ref — prevents stale-closure issues in callbacks
  const sessionRef = useRef(session)
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  // Ignore fetch results if we saved recently — prevents home page refresh from overwriting a fresh add
  const lastSaveAtRef = useRef<number>(0)
  const SAVE_GRACE_MS = 2000

  const fetchCart = useCallback(async () => {
    try {
      const res = await fetch("/api/ecommerce/cart", fetchOpts)
      if (res.status === 401) {
        setCart([])
        openLoginModal(async () => {
          await refreshSession()
          await fetchCart()
        })
        return
      }
      const data = await res.json()
      // Don't overwrite if we just saved (prevents race with home page refresh)
      if (Date.now() - lastSaveAtRef.current < SAVE_GRACE_MS) return
      if (data.success && Array.isArray(data.items)) {
        setCart(data.items)
      } else {
        setCart([])
      }
    } catch {
      setCart([])
    }
  }, [openLoginModal, refreshSession])

  const saveCart = useCallback(async (items: CartItem[], overwriteFromResponse = true): Promise<boolean> => {
    try {
      const res = await fetch("/api/ecommerce/cart", {
        ...fetchOpts,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      if (res.status === 401) {
        openLoginModal(async () => {
          await refreshSession()
          await fetchCart()
        })
        return false
      }
      if (res.ok) {
        lastSaveAtRef.current = Date.now()
        if (overwriteFromResponse) {
          const data = await res.json()
          if (data.success && Array.isArray(data.items)) {
            setCart(data.items)
          }
        }
        return true
      }
      return false
    } catch (err) {
      console.error("Failed to save cart:", err)
      return false
    }
  }, [openLoginModal, refreshSession, fetchCart])

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      setCartLoading(true)
      if (session.signedIn) {
        await fetchCart()
      } else {
        setCart([])
      }
      if (!cancelled) setCartLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [session.signedIn, fetchCart])

  useEffect(() => {
    if (!session.signedIn) return
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchCart()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [session.signedIn, fetchCart])

  const debouncedFetchCart = useMemo(
    () => debounce(() => fetchCart(), 300),
    [fetchCart]
  )

  useEffect(() => {
    return () => debouncedFetchCart.cancel()
  }, [debouncedFetchCart])

  const addItem = useCallback(
    async (item: Omit<CartItem, "quantity"> & { quantity?: number }): Promise<boolean> => {
      const qty = item.quantity ?? 1
      const toAdd: CartItem = { ...item, quantity: qty }

      // Optimistic update
      const uniqueId = item.size ? `${item.id}-${item.size}` : item.id
      setCart((prev) => {
        const idx = prev.findIndex((i) => (i.size ? `${i.id}-${i.size}` : i.id) === uniqueId)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], quantity: next[idx].quantity + qty }
          return next
        }
        return [...prev, toAdd]
      })

      try {
        const res = await fetch("/api/ecommerce/cart/items", {
          ...fetchOpts,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item: toAdd }),
        })
        if (res.status === 401) {
          openLoginModal(async () => {
            await refreshSession()
            await fetchCart()
          })
          return false
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(err?.error || "Could not add to cart")
          await fetchCart()
          return false
        }
        const data = await res.json()
        lastSaveAtRef.current = Date.now()
        if (data.success && Array.isArray(data.items)) {
          setCart(data.items)
        }
        return true
      } catch (err) {
        console.error("Add to cart failed:", err)
        toast.error("Could not add to cart")
        await fetchCart()
        return false
      }
    },
    [openLoginModal, refreshSession, fetchCart]
  )

  const updateQuantity = useCallback(
    async (uniqueId: string, delta: number) => {
      let nextCart: CartItem[] = []
      setCart((prevCart) => {
        const next = prevCart
          .map((i) => {
            const id = i.size ? `${i.id}-${i.size}` : i.id
            if (id !== uniqueId) return i
            const qty = Math.max(1, i.quantity + delta)
            return { ...i, quantity: qty }
          })
          .filter((i) => i.quantity >= 1)
        nextCart = next
        return next
      })

      if (session.signedIn) {
        let ok = await saveCart(nextCart, false)
        if (!ok) {
          toast.error("Could not sync cart. Retrying…")
          await new Promise((r) => setTimeout(r, 1500))
          ok = await saveCart(nextCart, false)
          if (!ok) {
            toast.error("Cart could not sync. Changes will save when you refresh or return to this tab.")
          }
        }
      }
    },
    [session.signedIn, saveCart]
  )

  const getLineId = useCallback((item: CartItem) => (item.size ? `${item.id}-${item.size}` : item.id), [])

  const removeItem = useCallback(
    async (lineId: string) => {
      // lineId = productId or productId-size (stable identifier per cart line, never use index)
      let prevCart: CartItem[] = []
      let nextCart: CartItem[] = []
      setCart((prev) => {
        prevCart = prev
        nextCart = prev.filter((i) => getLineId(i) !== lineId)
        return nextCart
      })

      // [DEBUG] removeItem flow
      if (process.env.NODE_ENV === "development") {
        console.log("[removeItem] target lineId:", lineId)
        console.log("[removeItem] cart before filter:", prevCart.length, prevCart.map((i) => ({ id: i.id, size: i.size, lineId: getLineId(i) })))
        console.log("[removeItem] cart after filter:", nextCart.length, nextCart.map((i) => ({ id: i.id, size: i.size, lineId: getLineId(i) })))
      }

      if (!session.signedIn) return

      try {
        const url = `/api/ecommerce/cart/items?uniqueId=${encodeURIComponent(lineId)}`
        const res = await fetch(url, { ...fetchOpts, method: "DELETE" })

        if (process.env.NODE_ENV === "development") {
          console.log("[removeItem] server received uniqueId:", lineId, "res.ok:", res.ok)
        }

        if (res.status === 401) {
          openLoginModal(async () => {
            await refreshSession()
            await fetchCart()
          })
          return
        }
        if (!res.ok) {
          toast.error("Could not remove item. Syncing…")
          await fetchCart()
          return
        }

        // Safe path: refetch cart once after success (prevents stale overwrite)
        const data = await res.json()
        if (process.env.NODE_ENV === "development") {
          console.log("[removeItem] server cart length after update:", data.items?.length ?? "N/A")
        }
        await fetchCart()
      } catch (err) {
        console.error("Failed to remove item:", err)
        toast.error("Could not remove item. Syncing…")
        await fetchCart()
      }
    },
    [session.signedIn, getLineId, fetchCart, openLoginModal, refreshSession]
  )

  const setCartAndSave = useCallback(
    async (items: CartItem[]) => {
      setCart(items)
      if (session.signedIn && items.length > 0) await saveCart(items)
    },
    [session.signedIn, saveCart]
  )

  const clearCartAndSave = useCallback(async () => {
    setCart([])
    if (session.signedIn) {
      try {
        await fetch("/api/ecommerce/cart", { ...fetchOpts, method: "DELETE" })
      } catch {
        // ignore
      }
    }
  }, [session.signedIn])

  const refresh = useCallback(async () => {
    const signedIn = await refreshSession()
    if (signedIn) await fetchCart()
  }, [refreshSession, fetchCart])

  const loading = sessionLoading || cartLoading

  const value: CartContextValue = {
    cart,
    loading,
    addItem,
    updateQuantity,
    removeItem,
    setCart: setCartAndSave,
    clearCart: clearCartAndSave,
    refresh,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  return ctx
}

