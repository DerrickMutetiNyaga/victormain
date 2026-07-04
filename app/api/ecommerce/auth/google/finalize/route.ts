import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth } from "@/lib/auth-ecommerce-oauth"
import { findOrCreateShopCustomerFromGoogle } from "@/lib/models/shop-customer"
import { createShopSession } from "@/lib/models/shop-session"
import { getShopSessionCookieName, getShopSessionCookieOptions, getShopSessionMaxAge } from "@/lib/shop-auth"
import { sanitizeShopRedirect } from "@/lib/shop-auth-redirect"
import { getShopAuthStartTime, recordShopAuthHealthEvent } from "@/lib/shop-auth-health"

const STATE_COOKIE = "shop_google_oauth_state"
const LOCK_COOKIE = "shop_google_oauth_lock"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const safeNext = sanitizeShopRedirect(url.searchParams.get("next"))
  const state = url.searchParams.get("state") ?? ""
  const ip = request.headers.get("x-forwarded-for") || null
  const userAgent = request.headers.get("user-agent")

  const cookieStore = await cookies()
  const expectedState = cookieStore.get(STATE_COOKIE)?.value ?? ""
  cookieStore.delete(STATE_COOKIE)
  cookieStore.delete(LOCK_COOKIE)

  if (!state || !expectedState || state !== expectedState) {
    await recordShopAuthHealthEvent({
      type: "state_mismatch",
      reason: "oauth_state_mismatch",
      correlationId: state || undefined,
      next: safeNext,
      ip,
      userAgent,
    })
    return NextResponse.redirect(new URL(`/auth?error=state&next=${encodeURIComponent(safeNext)}`, url.origin))
  }

  const oauthSession = await auth()
  const email = oauthSession?.user?.email?.trim().toLowerCase() ?? ""
  const googleSub = (oauthSession?.user as any)?.googleSub ?? ""
  const name = oauthSession?.user?.name?.trim() ?? ""

  if (!email || !googleSub) {
    await recordShopAuthHealthEvent({
      type: "google_account_missing",
      reason: "missing_google_email_or_sub",
      correlationId: state,
      next: safeNext,
      ip,
      userAgent,
    })
    return NextResponse.redirect(new URL(`/auth?error=google_account&next=${encodeURIComponent(safeNext)}`, url.origin))
  }

  const { customer } = await findOrCreateShopCustomerFromGoogle({
    googleSub,
    email,
    name,
  })
  const userId = (customer._id as { toString(): string }).toString()
  const session = await createShopSession(customer.phone, userId)

  cookieStore.set(getShopSessionCookieName(), session.sessionId, {
    ...getShopSessionCookieOptions(),
    maxAge: getShopSessionMaxAge(),
  })

  const startedAt = await getShopAuthStartTime(state)
  const durationMs = startedAt ? Math.max(0, Date.now() - startedAt) : undefined
  await recordShopAuthHealthEvent({
    type: "success",
    correlationId: state,
    next: safeNext,
    ip,
    userAgent,
    durationMs,
  })

  return NextResponse.redirect(
    new URL(`/auth/success?next=${encodeURIComponent(safeNext)}`, url.origin)
  )
}
