"use client"

import { useEffect } from "react"

/** Applies menu font CSS variables to <html> so portals (drawer/dialog) inherit them. */
export function MenuFontScope({
  className,
  children,
}: {
  className: string
  children: React.ReactNode
}) {
  useEffect(() => {
    const root = document.documentElement
    const tokens = className.split(/\s+/).filter(Boolean)
    root.classList.add(...tokens)
    return () => {
      root.classList.remove(...tokens)
    }
  }, [className])

  return <>{children}</>
}
