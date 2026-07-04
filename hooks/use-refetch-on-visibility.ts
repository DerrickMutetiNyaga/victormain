"use client"

import { useEffect, useRef } from "react"

/**
 * Re-runs when the user returns to the tab or the page is restored from bfcache.
 * Mount/pathname effects still handle initial load and client navigations.
 */
export function useRefetchOnVisibility(enabled: boolean, onRefetch: () => void) {
  const ref = useRef(onRefetch)
  ref.current = onRefetch

  useEffect(() => {
    if (!enabled) return
    const run = () => {
      ref.current()
    }
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") run()
    }
    const onPageShow = () => run()
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [enabled])
}
