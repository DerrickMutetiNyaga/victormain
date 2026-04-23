"use client"

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ShieldCheck, Zap, KeyRound, Loader2 } from "lucide-react"
import { SiteLogo } from "@/components/branding/site-logo"
import { useShopSession } from "@/components/providers/shop-session-provider"
import { sanitizeShopRedirect, getDefaultShopRedirect } from "@/lib/shop-auth-redirect"
import { trackShopAuthEvent } from "@/lib/shop-auth-analytics"

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

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.8-2.7-5.8-6s2.6-6 5.8-6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.8 3.8 14.6 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.7-3.7 8.7-8.8 0-.6-.1-1.1-.2-1.6H12z" />
      <path fill="#34A853" d="M3 7.5l3.2 2.3C7 8 9.3 6 12 6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.8 3.8 14.6 3 12 3 8 3 4.6 5.3 3 8.6z" />
      <path fill="#FBBC05" d="M12 21c2.5 0 4.7-.8 6.2-2.3l-2.9-2.4c-.8.6-1.9 1.1-3.3 1.1-3.8 0-5.1-2.5-5.4-3.8L3.3 16C4.9 19.5 8.2 21 12 21z" />
      <path fill="#4285F4" d="M20.7 12.2c0-.6-.1-1.1-.2-1.6H12v3.5h4.9c-.2 1.1-.8 2-1.6 2.7l2.9 2.4c1.7-1.5 2.5-3.8 2.5-7z" />
    </svg>
  )
}

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session, loading } = useShopSession()
  const [submitting, setSubmitting] = useState(false)
  const [requestStartedAt, setRequestStartedAt] = useState<number | null>(null)

  const safeNext = useMemo(() => {
    return sanitizeShopRedirect(searchParams.get("next")) || getDefaultShopRedirect()
  }, [searchParams])

  const error = searchParams.get("error")

  useEffect(() => {
    trackShopAuthEvent("shop_auth_page_view", { next: safeNext })
  }, [safeNext])

  useEffect(() => {
    if (error) {
      trackShopAuthEvent("shop_auth_google_failure", {
        error_code: error,
        next: safeNext,
      })
    }
  }, [error, safeNext])

  useEffect(() => {
    if (!loading && session.signedIn) {
      router.replace(safeNext)
    }
  }, [loading, session.signedIn, router, safeNext])

  const handleGoogleSignIn = () => {
    if (submitting) return
    trackShopAuthEvent("shop_auth_google_click", { next: safeNext })
    setSubmitting(true)
    setRequestStartedAt(Date.now())
    window.location.href = `/api/ecommerce/auth/google/start?next=${encodeURIComponent(safeNext)}`
  }

  useEffect(() => {
    return () => {
      if (!submitting && !session.signedIn) {
        trackShopAuthEvent("shop_auth_abandon", { next: safeNext })
      }
    }
  }, [submitting, session.signedIn, safeNext])

  useEffect(() => {
    if (!submitting || !requestStartedAt) return
    const timeout = window.setTimeout(() => {
      if (submitting) {
        const elapsedMs = Date.now() - requestStartedAt
        trackShopAuthEvent("shop_auth_google_slow_start", {
          next: safeNext,
          elapsed_ms: elapsedMs,
        })
        sendHealthEvent("google_slow_start", { next: safeNext, durationMs: elapsedMs })
      }
    }, 15_000)
    return () => window.clearTimeout(timeout)
  }, [submitting, requestStartedAt, safeNext])

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_14%,rgba(191,140,69,0.18)_0%,transparent_44%),radial-gradient(circle_at_84%_6%,rgba(89,64,41,0.18)_0%,transparent_38%),linear-gradient(155deg,#1a1310_0%,#241a15_45%,#14100d_100%)] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center">
        <section className="w-full max-w-xl rounded-[2rem] border border-[#d5c0a1]/55 bg-gradient-to-b from-[#fffdf8] via-[#f6eee3] to-[#eee3d2] p-6 shadow-[0_30px_70px_rgba(28,18,12,0.45)] sm:p-10 animate-in fade-in duration-500">
          <div className="mb-8 flex justify-center">
            <SiteLogo className="h-14 w-[195px]" />
          </div>

          <div className="text-center">
            <h1 className="text-4xl font-black tracking-tight text-[#2a1f19] sm:text-5xl">Welcome Back</h1>
            <p className="mx-auto mt-3 max-w-[34ch] text-[15px] leading-relaxed text-[#665447] sm:text-base">
              Continue in one tap with your Google account.
            </p>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error === "busy"
                ? "Sign-in is already in progress. Please wait a moment and try again."
                : "We could not complete sign-in. Please try again."}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting || loading}
            className="group mt-7 flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-[#d8d0c4] bg-white font-semibold text-[#2f241f] shadow-[0_10px_24px_rgba(40,24,14,0.14)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(40,24,14,0.2)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span className={submitting ? "" : "transition-transform duration-200 group-hover:scale-110"}>
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleMark />}
            </span>
            <span>{submitting ? "Connecting to Google..." : "Continue with Google"}</span>
          </button>
          {submitting && (
            <p className="mt-2 text-center text-sm text-[#6a5a4b]">Signing you in securely...</p>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[#7b6b5d] sm:text-xs">
            <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-[#8b652c]" />Fast</span>
            <span className="h-3 w-px bg-[#ccb693]" />
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#8b652c]" />Secure</span>
            <span className="h-3 w-px bg-[#ccb693]" />
            <span className="inline-flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5 text-[#8b652c]" />No Password Needed</span>
          </div>
          <p className="mt-3 text-center text-xs font-medium text-[#7b6b5d]">
            Trusted by Kenyan coffee lovers ☕
          </p>

          <div className="mt-8 text-center">
            <Link href="/shop" className="text-sm font-semibold text-[#6a4f2a] transition-colors hover:text-[#4d391f]">
              Continue Shopping →
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
