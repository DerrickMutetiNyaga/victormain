import { NextResponse } from "next/server"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit-simple"
import { recordShopAuthHealthEvent, type ShopAuthHealthEventType } from "@/lib/shop-auth-health"
import { sanitizeShopRedirect } from "@/lib/shop-auth-redirect"

const ALLOWED_TYPES: ShopAuthHealthEventType[] = [
  "session_wait_start",
  "session_wait_success",
  "session_wait_timeout",
  "google_slow_start",
]

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const userAgent = request.headers.get("user-agent")
  const rl = checkRateLimit(`shop-auth-health-event:${ip}`, 120, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 })
  }

  try {
    const body = await request.json()
    const type = String(body?.type || "") as ShopAuthHealthEventType
    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ success: false, error: "Invalid event type" }, { status: 400 })
    }

    const next = sanitizeShopRedirect(
      typeof body?.next === "string" ? body.next : null
    )
    const durationMs =
      Number.isFinite(Number(body?.durationMs)) && Number(body.durationMs) >= 0
        ? Number(body.durationMs)
        : undefined
    const reason = typeof body?.reason === "string" ? body.reason : undefined

    await recordShopAuthHealthEvent({
      type,
      next,
      reason,
      durationMs,
      ip,
      userAgent,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 })
  }
}
