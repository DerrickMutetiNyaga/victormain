"use client"

import React, { createContext, useContext, useCallback } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { sanitizeShopRedirect } from "@/lib/shop-auth-redirect"
import { trackShopAuthEvent } from "@/lib/shop-auth-analytics"

interface ShopLoginModalContextValue {
  openLoginModal: () => void
}

const ShopLoginModalContext = createContext<ShopLoginModalContextValue | null>(null)

export function ShopLoginModalProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const openLoginModal = useCallback(() => {
    const query = searchParams.toString()
    const candidate = pathname ? `${pathname}${query ? `?${query}` : ""}` : "/shop"
    const next = sanitizeShopRedirect(candidate)
    if (typeof window !== "undefined") {
      sessionStorage.setItem("shop_auth_pending", "1")
      sessionStorage.setItem("shop_auth_next", next)
      sessionStorage.setItem("shop_auth_started_at", String(Date.now()))
      trackShopAuthEvent("shop_auth_google_entry_click", { from_path: candidate, next })
      window.location.assign(`/auth?next=${encodeURIComponent(next)}`)
    }
  }, [pathname, searchParams])

  return (
    <ShopLoginModalContext.Provider value={{ openLoginModal }}>
      {children}
    </ShopLoginModalContext.Provider>
  )
}

export function useShopLoginModal() {
  const ctx = useContext(ShopLoginModalContext)
  return ctx?.openLoginModal ?? (() => undefined)
}

