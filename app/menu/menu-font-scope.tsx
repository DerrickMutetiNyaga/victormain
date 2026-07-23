"use client"

import { useEffect, type ReactNode } from "react"

/** Applies menu font CSS variables to <html> so portals (drawer/dialog) inherit them. */
export function MenuFontScope({
  className,
  children,
}: {
  className: string
  children: ReactNode
}) {
  useEffect(() => {
    const root = document.documentElement
    const tokens = className.split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return
    root.classList.add(...tokens)
    return () => {
      root.classList.remove(...tokens)
    }
  }, [className])

  return <>{children}</>
}
