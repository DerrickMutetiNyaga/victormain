"use client"

import { track } from "@vercel/analytics"

type EventProps = Record<string, string | number | boolean | null | undefined>

function cleanProps(props: EventProps = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  Object.entries(props).forEach(([k, v]) => {
    if (v !== null && v !== undefined) out[k] = v
  })
  return out
}

export function trackShopAuthEvent(event: string, props: EventProps = {}) {
  const payload = cleanProps(props)

  // Vercel Analytics
  try {
    track(event, payload)
  } catch {
    // noop
  }

  // Google Analytics (gtag)
  try {
    if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
      ;(window as any).gtag("event", event, payload)
    }
  } catch {
    // noop
  }

  // Plausible
  try {
    if (typeof window !== "undefined" && typeof (window as any).plausible === "function") {
      ;(window as any).plausible(event, { props: payload })
    }
  } catch {
    // noop
  }

  // PostHog
  try {
    if (typeof window !== "undefined" && (window as any).posthog?.capture) {
      ;(window as any).posthog.capture(event, payload)
    }
  } catch {
    // noop
  }
}
