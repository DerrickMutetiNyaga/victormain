"use client"

import React from "react"
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { usePathname } from "next/navigation"

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  // Determine basePath based on current route
  // Catha routes use /api/auth/catha, Jaba routes use /api/auth/jaba
  const basePath = pathname?.startsWith('/catha') 
    ? '/api/auth/catha' 
    : pathname?.startsWith('/jaba')
    ? '/api/auth/jaba'
    : '/api/auth/jaba' // Default to jaba for root and other routes
  
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

