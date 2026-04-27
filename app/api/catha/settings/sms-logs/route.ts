import { NextResponse } from 'next/server'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'
import { getShiftSmsQueueMetrics, listShiftSmsQueue, markShiftSmsResolved, retryShiftSms, type ShiftSmsQueueStatus } from '@/lib/models/shift-sms-queue'

async function requireAdmin() {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return { ok: false as const, response: NextResponse.json({ error: auth.error }, { status: auth.status }) }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(auth.role)) {
    return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true as const }
}

export async function GET(request: Request) {
  const access = await requireAdmin()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') || 200)))
  const status = String(url.searchParams.get('status') || 'all') as ShiftSmsQueueStatus | 'all'
  const search = String(url.searchParams.get('search') || '').trim()
  const [rows, metrics] = await Promise.all([
    listShiftSmsQueue({ limit, status, search }),
    getShiftSmsQueueMetrics(),
  ])
  return NextResponse.json({
    ok: true,
    metrics,
    rows: rows.map((row) => ({
      id: row._id?.toString(),
      userId: row.userId,
      shiftId: row.shiftId ?? null,
      phone: row.phone,
      message: row.message,
      eventType: row.eventType,
      attempts: row.attempts,
      status: row.status,
      providerMessageId: row.providerMessageId ?? null,
      sentAt: row.sentAt ?? null,
      deliveredAt: row.deliveredAt ?? null,
      resolvedAt: row.resolvedAt ?? null,
      nextRetryAt: row.nextRetryAt,
      lastError: row.lastError ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
  })
}

export async function POST(request: Request) {
  const access = await requireAdmin()
  if (!access.ok) return access.response
  const body = await request.json().catch(() => ({}))
  const action = String(body.action || '').trim()
  const id = String(body.id || '').trim()
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })

  if (action === 'retry') {
    await retryShiftSms(id)
    return NextResponse.json({ ok: true })
  }
  if (action === 'resolve') {
    await markShiftSmsResolved(id)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ ok: false, error: 'Unsupported action' }, { status: 400 })
}

