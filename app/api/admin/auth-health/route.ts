import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-catha"
import { normalizePermissions, hasCathaPermission } from "@/lib/catha-permissions-model"
import { getDatabase } from "@/lib/mongodb"
import { SHOP_AUTH_HEALTH_COLLECTION } from "@/lib/shop-auth-health"

function parseDays(raw: string | null): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 7
  return Math.min(30, Math.max(1, Math.floor(n)))
}

function parseThreshold(raw: string | null, fallback: number, min = 0, max = 100): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const role = String(((session.user as any).role ?? "")).toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  const allowed = role === "SUPER_ADMIN" || hasCathaPermission(perms, "settings", "view")
  if (!allowed) {
    return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const days = parseDays(url.searchParams.get("days"))
    const successRateMin = parseThreshold(url.searchParams.get("successRateMin"), 85)
    const timeoutRateMax = parseThreshold(url.searchParams.get("timeoutRateMax"), 5)
    const busyLockRateMax = parseThreshold(url.searchParams.get("busyLockRateMax"), 8)
    const stateMismatchRateMax = parseThreshold(url.searchParams.get("stateMismatchRateMax"), 2)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const db = await getDatabase("infusion_jaba")
    const coll = db.collection(SHOP_AUTH_HEALTH_COLLECTION)

    const baseMatch = { createdAt: { $gte: since } }
    const [totals, byReason, byDay, byDevice, topReturns, avgDuration] = await Promise.all([
      coll
        .aggregate([
          { $match: baseMatch },
          { $group: { _id: "$type", count: { $sum: 1 } } },
        ])
        .toArray(),
      coll
        .aggregate([
          { $match: { ...baseMatch, reason: { $ne: null } } },
          { $group: { _id: "$reason", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .toArray(),
      coll
        .aggregate([
          {
            $match: baseMatch,
          },
          {
            $group: {
              _id: {
                day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                type: "$type",
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { "_id.day": 1 } },
        ])
        .toArray(),
      coll
        .aggregate([
          { $match: { ...baseMatch, type: "start" } },
          { $group: { _id: "$device", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .toArray(),
      coll
        .aggregate([
          { $match: { ...baseMatch, type: "success", next: { $ne: null } } },
          { $group: { _id: "$next", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ])
        .toArray(),
      coll
        .aggregate([
          { $match: { ...baseMatch, type: "success", durationMs: { $ne: null } } },
          { $group: { _id: null, avg: { $avg: "$durationMs" }, p95: { $max: "$durationMs" } } },
        ])
        .toArray(),
    ])

    const totalsMap = Object.fromEntries(totals.map((r) => [r._id as string, r.count as number]))
    const starts = totalsMap.start ?? 0
    const success = totalsMap.success ?? 0
    const successRate = starts > 0 ? Number(((success / starts) * 100).toFixed(2)) : 0
    const sessionWaitTimeouts = totalsMap.session_wait_timeout ?? 0
    const busyLocks = totalsMap.busy_lock ?? 0
    const stateMismatch = totalsMap.state_mismatch ?? 0
    const timeoutRate = starts > 0 ? Number(((sessionWaitTimeouts / starts) * 100).toFixed(2)) : 0
    const busyLockRate = starts > 0 ? Number(((busyLocks / starts) * 100).toFixed(2)) : 0
    const stateMismatchRate = starts > 0 ? Number(((stateMismatch / starts) * 100).toFixed(2)) : 0

    const alerts: Array<{
      code: string
      severity: "info" | "warning" | "critical"
      message: string
      current: number
      threshold: number
    }> = []
    if (starts >= 20 && successRate < successRateMin) {
      alerts.push({
        code: "success_rate_low",
        severity: "critical",
        message: `Success rate dropped below ${successRateMin}%`,
        current: successRate,
        threshold: successRateMin,
      })
    }
    if (starts >= 20 && timeoutRate > timeoutRateMax) {
      alerts.push({
        code: "timeout_rate_high",
        severity: "warning",
        message: `Session wait timeout rate exceeded ${timeoutRateMax}%`,
        current: timeoutRate,
        threshold: timeoutRateMax,
      })
    }
    if (starts >= 20 && busyLockRate > busyLockRateMax) {
      alerts.push({
        code: "busy_lock_rate_high",
        severity: "warning",
        message: `Duplicate-start lock rate exceeded ${busyLockRateMax}%`,
        current: busyLockRate,
        threshold: busyLockRateMax,
      })
    }
    if (starts >= 20 && stateMismatchRate > stateMismatchRateMax) {
      alerts.push({
        code: "state_mismatch_rate_high",
        severity: "critical",
        message: `State mismatch rate exceeded ${stateMismatchRateMax}%`,
        current: stateMismatchRate,
        threshold: stateMismatchRateMax,
      })
    }

    return NextResponse.json({
      success: true,
      range: { days, since: since.toISOString() },
      thresholds: {
        successRateMin,
        timeoutRateMax,
        busyLockRateMax,
        stateMismatchRateMax,
      },
      summary: {
        starts,
        success,
        successRate,
        busyLocks,
        stateMismatch,
        googleAccountMissing: totalsMap.google_account_missing ?? 0,
        rateLimited: totalsMap.rate_limited ?? 0,
        sessionWaitTimeouts,
        timeoutRate,
        busyLockRate,
        stateMismatchRate,
        avgDurationMs: avgDuration[0]?.avg ? Math.round(avgDuration[0].avg) : null,
        maxDurationMs: avgDuration[0]?.p95 ? Math.round(avgDuration[0].p95) : null,
      },
      alerts,
      failuresByReason: byReason.map((r) => ({ reason: r._id, count: r.count })),
      daily: byDay.map((r) => ({ day: r._id.day, type: r._id.type, count: r.count })),
      deviceSplit: byDevice.map((r) => ({ device: r._id ?? "unknown", count: r.count })),
      topReturnPaths: topReturns.map((r) => ({ path: r._id, count: r.count })),
    })
  } catch (error: any) {
    console.error("[admin/auth-health] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch auth health metrics", message: error.message },
      { status: 500 }
    )
  }
}
