"use client"

import React from "react"
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { usePathname } from "next/navigation"

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  // Determine basePath based on current route.
  // Jaba routes use /api/auth/jaba.
  // Catha routes AND all ecommerce/public routes (/, /shop, /cart, /account…)
  // use /api/auth/catha — the OrderNotificationsProvider calls useSession()
  // for Catha staff alerts, so non-jaba pages must point at the catha endpoint.
  const basePath = pathname?.startsWith('/jaba')
    ? '/api/auth/jaba'
    : '/api/auth/catha'
  
  return (
    <NextAuthSessionProvider
      basePath={basePath}
      refetchInterval={pathname?.startsWith("/jaba") ? 30 : 60}
      refetchOnWindowFocus={true}
    >
      {children}
    </NextAuthSessionProvider>
  )
}

