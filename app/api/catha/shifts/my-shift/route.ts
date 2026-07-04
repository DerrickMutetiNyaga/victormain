import { NextResponse } from 'next/server'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'
import { getActiveStaffShiftByUserId, getLatestStaffShiftByUserId } from '@/lib/models/staff-shift'
import { getDatabase } from '@/lib/mongodb'
import { autoCloseOverdueShiftForUser } from '@/lib/catha-shift-auto-close'

function formatDurationFromMs(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function toShiftState(status: string): 'ACTIVE' | 'CLOSED' | 'AUTO_CLOSED' {
  if (status === 'AUTO_CLOSED') return 'AUTO_CLOSED'
  if (status === 'ACTIVE' || status === 'PENDING_CLOSURE') return 'ACTIVE'
  return 'CLOSED'
}

function toTimingState(actualIso: Date | null | undefined, scheduledIso: Date | null | undefined) {
  if (!actualIso || !scheduledIso) return { label: 'ON_TIME', detail: 'On time' }
  const diffMs = new Date(actualIso).getTime() - new Date(scheduledIso).getTime()
  if (diffMs === 0) return { label: 'ON_TIME', detail: 'On time' }
  const detail = formatDurationFromMs(Math.abs(diffMs))
  if (diffMs > 0) return { label: 'LATE', detail: `${detail} late` }
  return { label: 'EARLY', detail: `${detail} early` }
}

export async function GET() {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  await autoCloseOverdueShiftForUser(auth.userId)
  const active = await getActiveStaffShiftByUserId(auth.userId)
  const shift = active ?? (await getLatestStaffShiftByUserId(auth.userId))
  if (!shift) return NextResponse.json({ ok: true, shift: null, orders: [] })

  const start = new Date(shift.startedAt)
  const end = shift.endedAt ? new Date(shift.endedAt) : new Date()
  const db = await getDatabase('infusion_jaba')

  const rows = await db
    .collection('orders')
    .find({
      $or: [
        { cashierUserId: auth.userId },
        { cashier: { $regex: `^${String(auth.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
      ],
      timestamp: { $gte: start, $lte: end },
    })
    .sort({ timestamp: -1 })
    .limit(100)
    .toArray()

  const orders = rows.map((row: any) => ({
    id: String(row.id || row.orderId || row._id || ''),
    time: row.timestamp || row.createdAt || row.updatedAt || null,
    status: String(row.status || 'pending'),
    items: Array.isArray(row.items)
      ? row.items.map((item: any) => ({
          name: String(item?.name || item?.productName || 'Item'),
          qty: Number(item?.quantity || item?.qty || 1),
        }))
      : [],
  }))

  return NextResponse.json({
    ok: true,
    shift: {
      id: shift._id?.toString(),
      startedAt: shift.startedAt,
      endedAt: shift.endedAt ?? null,
      scheduledStartAt: shift.scheduledStartAt,
      scheduledEndAt: shift.scheduledEndAt,
      state: toShiftState(shift.status),
      status: shift.status,
      timing: {
        isDelayed: Boolean(shift.closureContext?.wasDelayed),
        overdueBy: formatDurationFromMs(Number(shift.closureContext?.overdueByMs || 0)),
        delayedBy: formatDurationFromMs(Number(shift.closureContext?.delayedByMs || 0)),
        opened: toTimingState(shift.startedAt, shift.scheduledStartAt),
        closed: toTimingState(shift.endedAt ?? null, shift.scheduledEndAt),
      },
    },
    orders,
  })
}

