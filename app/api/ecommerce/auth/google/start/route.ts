import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { randomBytes } from "crypto"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit-simple"
import { sanitizeShopRedirect } from "@/lib/shop-auth-redirect"
import { recordShopAuthHealthEvent } from "@/lib/shop-auth-health"
import { signIn } from "@/lib/auth-ecommerce-oauth"

const STATE_COOKIE = "shop_google_oauth_state"
const LOCK_COOKIE = "shop_google_oauth_lock"
const STATE_MAX_AGE_SECONDS = 10 * 60
const LOCK_MAX_AGE_SECONDS = 12

export async function GET(request: Request) {
  const ip = getClientIp(request)
  const userAgent = request.headers.get("user-agent")
  const rl = checkRateLimit(`shop-google-start:${ip}`, 20, 60_000)
  if (!rl.ok) {
    await recordShopAuthHealthEvent({
      type: "rate_limited",
      reason: "start_ip_rate_limit",
      ip,
      userAgent,
    })
    return NextResponse.json(
      { success: false, error: "Too many auth attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const url = new URL(request.url)
  const safeNext = sanitizeShopRedirect(url.searchParams.get("next"))
  const cookieStore = await cookies()
  const authLock = cookieStore.get(LOCK_COOKIE)?.value
  if (authLock) {
    await recordShopAuthHealthEvent({
      type: "busy_lock",
      reason: "duplicate_start_blocked",
      next: safeNext,
      ip,
      userAgent,
    })
    const retryUrl = new URL(`/auth?error=busy&next=${encodeURIComponent(safeNext)}`, url.origin)
    return NextResponse.redirect(retryUrl)
  }

  const state = randomBytes(24).toString("hex")
  await recordShopAuthHealthEvent({
    type: "start",
    correlationId: state,
    next: safeNext,
    ip,
    userAgent,
  })

  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/",
    maxAge: STATE_MAX_AGE_SECONDS,
  })
  cookieStore.set(LOCK_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/",
    maxAge: LOCK_MAX_AGE_SECONDS,
  })

  const callbackUrl = new URL("/api/ecommerce/auth/google/finalize", url.origin)
  callbackUrl.searchParams.set("state", state)
  callbackUrl.searchParams.set("next", safeNext)

  return await signIn("google", {
    redirectTo: callbackUrl.toString(),
  })
}
