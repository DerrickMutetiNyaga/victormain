"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"

export interface ShopCustomer {
  id: string
  phone: string
  name: string
}

export interface ShopSession {
  signedIn: boolean
  customer?: ShopCustomer
}

interface ShopSessionContextValue {
  session: ShopSession
  loading: boolean
  refreshSession: () => Promise<boolean>
  signOut: () => Promise<void>
}

const ShopSessionContext = createContext<ShopSessionContextValue | null>(null)

const fetchOptions: RequestInit = { credentials: "include" }

export function ShopSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ShopSession>({ signedIn: false })
  const [loading, setLoading] = useState(true)

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/ecommerce/session", fetchOptions)
      const data = await res.json()
      const signedIn = !!(data.signedIn && data.customer)
      setSession({
        signedIn,
        customer: data.customer ? { id: data.customer.id, phone: data.customer.phone, name: data.customer.name ?? '' } : undefined,
      })
      return signedIn
    } catch {
      setSession({ signedIn: false })
      return false
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/ecommerce/logout", { ...fetchOptions, method: "POST" })
    } finally {
      setSession({ signedIn: false })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    refreshSession().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [refreshSession])

  const value: ShopSessionContextValue = {
    session,
    loading,
    refreshSession,
    signOut,
  }

  return (
    <ShopSessionContext.Provider value={value}>
      {children}
    </ShopSessionContext.Provider>
  )
}

export function useShopSession() {
  const ctx = useContext(ShopSessionContext)
  if (!ctx) {
    return {
      session: { signedIn: false } as ShopSession,
      loading: false,
      refreshSession: async () => false,
      signOut: async () => {},
    }
  }
  return ctx
}

