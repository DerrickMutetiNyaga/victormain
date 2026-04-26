import { NextResponse } from 'next/server'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'
import { getDatabase } from '@/lib/mongodb'
import type { ShiftNotificationLog } from '@/lib/models/shift-notification-log'

function parseLimit(raw: string | null): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return 20
  return Math.max(1, Math.min(100, Math.floor(value)))
}

function parseFilter(raw: string | null): 'all' | 'sent' | 'failed' {
  if (raw === 'sent' || raw === 'failed') return raw
  return 'all'
}

function mapNotificationType(type: ShiftNotificationLog['type']): string {
  if (type === 'CLOCK_OUT') return 'close'
  if (type === 'CLOCK_IN') return 'open'
  return type.toLowerCase()
}

export async function GET(request: Request) {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!['ADMIN', 'SUPER_ADMIN'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const limit = parseLimit(url.searchParams.get('limit'))
    const filter = parseFilter(url.searchParams.get('filter'))

    const db = await getDatabase('infusion_jaba')
    const collection = db.collection<ShiftNotificationLog>('shift_notifications_log')

    const recentFilter: Record<string, unknown> = {}
    if (filter === 'sent') recentFilter.success = true
    if (filter === 'failed') recentFilter.success = false

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [recentLogs, sent24h, failed24h] = await Promise.all([
      collection.find(recentFilter).sort({ createdAt: -1 }).limit(limit).toArray(),
      collection.countDocuments({ createdAt: { $gte: since24h }, success: true }),
      collection.countDocuments({ createdAt: { $gte: since24h }, success: false }),
    ])

    const total24h = sent24h + failed24h
    const successRate = total24h === 0 ? 1 : sent24h / total24h

    return NextResponse.json({
      recent: recentLogs.map((log) => ({
        shiftId: log.shiftId ?? null,
        type: mapNotificationType(log.type),
        status: log.success ? 'sent' : 'failed',
        recipients: Array.isArray(log.recipients) ? log.recipients.length : 0,
        error: log.error ?? null,
        timestamp: log.createdAt instanceof Date ? log.createdAt.toISOString() : new Date(log.createdAt).toISOString(),
      })),
      failuresLast24h: failed24h,
      successRate: Number(successRate.toFixed(4)),
    })
  } catch (error: any) {
    console.error('[catha-shifts-notifications-health] failed', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch shift notification health',
        message: error?.message || 'unknown_error',
      },
      { status: 500 }
    )
  }
}
