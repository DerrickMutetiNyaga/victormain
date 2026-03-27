"use client"

import { useContext } from "react"
import { useShopSession } from "@/components/providers/shop-session-provider"
import { CartContext } from "@/components/providers/cart-provider"

export interface CartItem {
  id: string
  name: string
  price: number
  image: string
  quantity: number
  size?: string
}

export interface ShopSession {
  signedIn: boolean
  customer?: { id: string; phone: string; name: string }
}

export function useShopCart() {
  const { session, loading: sessionLoading, refreshSession } = useShopSession()
  const cartContext = useContext(CartContext)

  if (!cartContext) {
    return {
      cart: [],
      session,
      loading: sessionLoading,
      addItem: async () => false,
      updateQuantity: async () => {},
      removeItem: async () => {},
      setCart: async () => {},
      clearCart: async () => {},
      refresh: async () => refreshSession().then(() => false),
    }
  }

  return {
    ...cartContext,
    session,
    loading: sessionLoading || cartContext.loading,
    refresh: cartContext.refresh,
  }
}
