"use client"

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react"
import { PhoneLoginModal } from "@/components/ecommerce/phone-login-modal"
import { useShopSession } from "@/components/providers/shop-session-provider"

type PendingAction = () => void | Promise<void>

interface ShopLoginModalContextValue {
  openLoginModal: (onSuccess?: PendingAction) => void
}

const ShopLoginModalContext = createContext<ShopLoginModalContextValue | null>(null)

export function ShopLoginModalProvider({ children }: { children: React.ReactNode }) {
  const { session } = useShopSession()
  const [open, setOpen] = useState(false)
  const pendingActionRef = useRef<PendingAction | null>(null)

  const openLoginModal = useCallback((onSuccess?: PendingAction) => {
    pendingActionRef.current = onSuccess ?? null
    setOpen(true)
  }, [])

  // If modal is open but user is ALREADY logged in (e.g. session just loaded), close modal and run pending action
  useEffect(() => {
    if (open && session.signedIn) {
      setOpen(false)
      const action = pendingActionRef.current
      pendingActionRef.current = null
      if (typeof action === "function") {
        Promise.resolve(action()).catch(console.error)
      }
    }
  }, [open, session.signedIn])

  const handleSuccess = useCallback((_phone: string) => {
    setOpen(false)
    const action = pendingActionRef.current
    pendingActionRef.current = null
    if (typeof action === "function") {
      Promise.resolve(action()).catch(console.error)
    }
  }, [])

  const handleOpenChange = useCallback((o: boolean) => {
    if (!o) pendingActionRef.current = null
    setOpen(o)
  }, [])

  return (
    <ShopLoginModalContext.Provider value={{ openLoginModal }}>
      {children}
      <PhoneLoginModal
        open={open}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />
    </ShopLoginModalContext.Provider>
  )
}

export function useShopLoginModal() {
  const ctx = useContext(ShopLoginModalContext)
  return ctx?.openLoginModal ?? (() => {})
}

