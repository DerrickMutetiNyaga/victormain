"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, ShieldCheck } from "lucide-react"
import { sanitizeShopRedirect } from "@/lib/shop-auth-redirect"
import { trackShopAuthEvent } from "@/lib/shop-auth-analytics"

const MAX_WAIT_MS = 12_000
const POLL_MS = 350

async function sendHealthEvent(type: string, payload: Record<string, unknown>) {
  try {
    await fetch("/api/ecommerce/auth/health-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...payload }),
      keepalive: true,
    })
  } catch {
    // noop
  }
}

export default function AuthSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [timedOut, setTimedOut] = useState(false)

  const safeNext = useMemo(
    () => sanitizeShopRedirect(searchParams.get("next")),
    [searchParams]
  )

  useEffect(() => {
    let stopped = false
    const startedAt = Date.now()
    trackShopAuthEvent("shop_auth_session_wait_start", { next: safeNext })
    sendHealthEvent("session_wait_start", { next: safeNext })

    const poll = async () => {
      if (stopped) return
      try {
        const res = await fetch("/api/ecommerce/session", { credentials: "include", cache: "no-store" })
        const data = await res.json().catch(() => ({}))
        if (data?.signedIn) {
          const waitMs = Date.now() - startedAt
          trackShopAuthEvent("shop_auth_session_wait_success", {
            next: safeNext,
            wait_ms: waitMs,
          })
          sendHealthEvent("session_wait_success", { next: safeNext, durationMs: waitMs })
          router.replace(safeNext)
          return
        }
      } catch {
        // noop
      }

      if (Date.now() - startedAt >= MAX_WAIT_MS) {
        setTimedOut(true)
        trackShopAuthEvent("shop_auth_session_wait_timeout", { next: safeNext })
        sendHealthEvent("session_wait_timeout", { next: safeNext, durationMs: Date.now() - startedAt })
        return
      }
      window.setTimeout(poll, POLL_MS)
    }

    poll()
    return () => {
      stopped = true
    }
  }, [router, safeNext])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_24%_12%,rgba(191,140,69,0.16)_0%,transparent_45%),linear-gradient(155deg,#1a1310_0%,#241a15_45%,#14100d_100%)] px-4">
      <section className="w-full max-w-md rounded-3xl border border-[#d5c0a1]/55 bg-gradient-to-b from-[#fffdf8] via-[#f6eee3] to-[#eee3d2] p-6 text-center shadow-[0_30px_70px_rgba(28,18,12,0.45)] sm:p-8">
        {!timedOut ? (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#7b5d34]" />
            <h1 className="mt-4 text-2xl font-black text-[#2a1f19]">Finalizing Sign-In</h1>
            <p className="mt-2 text-sm text-[#655445]">
              Securing your session and sending you back...
            </p>
          </>
        ) : (
          <>
            <ShieldCheck className="mx-auto h-8 w-8 text-[#7b5d34]" />
            <h1 className="mt-4 text-2xl font-black text-[#2a1f19]">Almost There</h1>
            <p className="mt-2 text-sm text-[#655445]">
              Sign-in took longer than expected. You can continue now.
            </p>
            <Link
              href={safeNext}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#2f241f] px-5 text-sm font-semibold text-[#f6ead4] hover:bg-[#3b2d26]"
            >
              Continue
            </Link>
          </>
        )}
      </section>
    </main>
  )
}
