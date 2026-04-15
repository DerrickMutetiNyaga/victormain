/**
 * Simple in-process rate limiter for AI routes (best-effort; replace with Redis in production).
 */
const buckets = new Map<string, number[]>()

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now()
  const arr = buckets.get(key) ?? []
  const pruned = arr.filter((t) => t > now - windowMs)
  if (pruned.length >= maxRequests) {
    const oldest = pruned[0] ?? now
    return { ok: false, retryAfterMs: windowMs - (now - oldest) }
  }
  pruned.push(now)
  buckets.set(key, pruned)
  return { ok: true }
}
