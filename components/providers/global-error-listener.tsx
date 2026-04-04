"use client"

import { useEffect } from "react"

/**
 * Attaches global window-level error listeners so that any uncaught JS
 * runtime error or unhandled Promise rejection is logged to the console.
 * This helps diagnose blank-screen crashes on specific devices where
 * React's own error boundary may not catch async failures.
 *
 * Outputs appear in: DevTools console, remote logging (Vercel logs), etc.
 */
export function GlobalErrorListener() {
  useEffect(() => {
    const tag = "[GlobalErrorListener]"

    console.log(`${tag} ✅ Mounted — listening for uncaught errors and promise rejections`)
    console.log(`${tag} 📱 UA: ${navigator.userAgent}`)
    console.log(`${tag} 📐 Screen: ${window.screen.width}x${window.screen.height} DPR:${window.devicePixelRatio}`)
    console.log(`${tag} 🌐 Language: ${navigator.language}`)
    console.log(`${tag} 💾 Memory: ${(navigator as any).deviceMemory ?? "unknown"} GB`)
    console.log(`${tag} 🔌 Connection: ${(navigator as any).connection?.effectiveType ?? "unknown"}`)

    const handleError = (event: ErrorEvent) => {
      console.error(
        `${tag} ❌ Uncaught JS Error`,
        "\n  message:", event.message,
        "\n  file:", event.filename,
        "\n  line:", event.lineno,
        "\n  col:", event.colno,
        "\n  stack:", event.error?.stack ?? "(no stack)"
      )
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      console.error(
        `${tag} ❌ Unhandled Promise Rejection`,
        "\n  reason:", reason,
        "\n  stack:", reason?.stack ?? "(no stack)"
      )
    }

    const handleUnload = () => {
      console.log(`${tag} 🚪 Page unloading / navigating away`)
    }

    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleUnhandledRejection)
    window.addEventListener("beforeunload", handleUnload)

    return () => {
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
      window.removeEventListener("beforeunload", handleUnload)
    }
  }, [])

  return null
}
