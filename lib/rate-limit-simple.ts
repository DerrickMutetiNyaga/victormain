/**
 * In-memory sliding-window rate limiter for API routes (single Node instance).
 * For multi-instance production, replace with Redis/Upstash.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

const MAX_BUCKETS = 20_000

function prune(now: number) {
  if (buckets.size <= MAX_BUCKETS) return
  for (const [k, b] of buckets) {
    if (now > b.resetAt) buckets.delete(k)
  }
}

export function checkRateLimit(key: string, max: number, windowMs: number): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now()
  prune(now)
  const existing = buckets.get(key)
  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }
  if (existing.count >= max) {
    return { ok: false, retryAfterMs: Math.max(0, existing.resetAt - now) }
  }
  existing.count += 1
  return { ok: true }
}

export function getClientIp(request: Request): string {
  const h = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
  const first = h.split(',')[0]?.trim()
  if (first) return first
  return 'unknown'
}
