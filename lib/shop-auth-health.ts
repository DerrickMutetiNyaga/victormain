import { getDatabase } from "@/lib/mongodb"

export const SHOP_AUTH_HEALTH_COLLECTION = "shop_auth_health_events"

export type ShopAuthHealthEventType =
  | "start"
  | "success"
  | "busy_lock"
  | "state_mismatch"
  | "google_account_missing"
  | "rate_limited"
  | "session_wait_start"
  | "session_wait_success"
  | "session_wait_timeout"
  | "google_slow_start"

type DeviceType = "mobile" | "desktop" | "tablet" | "bot" | "unknown"

function parseBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (ua.includes("edg/")) return "edge"
  if (ua.includes("opr/") || ua.includes("opera")) return "opera"
  if (ua.includes("chrome/") && !ua.includes("edg/")) return "chrome"
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "safari"
  if (ua.includes("firefox/")) return "firefox"
  return "unknown"
}

function parseDevice(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase()
  if (ua.includes("bot") || ua.includes("crawl") || ua.includes("spider")) return "bot"
  if (ua.includes("ipad") || ua.includes("tablet")) return "tablet"
  if (ua.includes("iphone") || ua.includes("android") || ua.includes("mobile")) return "mobile"
  if (ua.length > 0) return "desktop"
  return "unknown"
}

function maskIp(ip: string | null | undefined): string {
  if (!ip) return "unknown"
  if (ip.includes(".")) {
    const parts = ip.split(".")
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`
  }
  if (ip.includes(":")) {
    const parts = ip.split(":")
    return `${parts.slice(0, 4).join(":")}::`
  }
  return "unknown"
}

export async function recordShopAuthHealthEvent(input: {
  type: ShopAuthHealthEventType
  reason?: string
  correlationId?: string
  next?: string
  ip?: string | null
  userAgent?: string | null
  durationMs?: number
}) {
  try {
    const db = await getDatabase("infusion_jaba")
    const coll = db.collection(SHOP_AUTH_HEALTH_COLLECTION)
    const userAgent = input.userAgent ?? ""
    await coll.insertOne({
      type: input.type,
      reason: input.reason ?? null,
      correlationId: input.correlationId ?? null,
      next: input.next ?? null,
      ipMasked: maskIp(input.ip),
      userAgent,
      browser: parseBrowser(userAgent),
      device: parseDevice(userAgent),
      durationMs: Number.isFinite(input.durationMs) ? input.durationMs : null,
      createdAt: new Date(),
    })
  } catch (error) {
    console.error("[shop-auth-health] event_write_failed", error)
  }
}

export async function getShopAuthStartTime(correlationId: string): Promise<number | null> {
  if (!correlationId) return null
  try {
    const db = await getDatabase("infusion_jaba")
    const coll = db.collection(SHOP_AUTH_HEALTH_COLLECTION)
    const start = await coll.findOne(
      { type: "start", correlationId },
      { sort: { createdAt: -1 }, projection: { createdAt: 1 } }
    )
    if (!start?.createdAt) return null
    return new Date(start.createdAt as Date).getTime()
  } catch {
    return null
  }
}
