import { NextResponse } from 'next/server'
import { aggregateShiftOrderStats, deriveShiftStatusOnClose, requireShiftSessionUser } from '@/lib/catha-shift-service'
import { createShiftEvent, findShiftEventByRequestId } from '@/lib/models/shift-event'
import { getActiveStaffShiftByUserId, getLatestStaffShiftByUserId, transitionActiveShift } from '@/lib/models/staff-shift'
import { sendShiftNotification } from '@/lib/catha-shift-sms'
import { analyzeShiftTiming, formatSignedTimingForSms } from '@/lib/catha-shift-timing-analysis'

export async function POST(request: Request) {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const requestId = String(request.headers.get('x-idempotency-key') ?? '').trim()

  if (requestId) {
    const priorEvent = await findShiftEventByRequestId(auth.userId, 'CLOSE', requestId)
    if (priorEvent?.shiftId) {
      const priorShift = await getLatestStaffShiftByUserId(auth.userId)
      if (priorShift && priorShift._id?.toString() === priorEvent.shiftId) {
        return NextResponse.json({ ok: true, shift: priorShift, replay: true })
      }
    }
  }

  const shift = await getActiveStaffShiftByUserId(auth.userId)
  if (!shift?._id) {
    const latest = await getLatestStaffShiftByUserId(auth.userId)
    if (latest?.endedAt) return NextResponse.json({ ok: true, shift: latest, replay: true })
    return NextResponse.json({ error: 'No active shift' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const now = new Date()
  const stats = await aggregateShiftOrderStats(auth.name, shift.startedAt, now, [auth.email], auth.userId)
  const countedDrawerAmount = Number(body.countedDrawerAmount ?? shift.countedDrawerAmount ?? 0)
  if (!Number.isFinite(countedDrawerAmount) || countedDrawerAmount < 0 || countedDrawerAmount > 10_000_000) {
    return NextResponse.json({ error: 'Invalid counted drawer amount' }, { status: 400 })
  }
  const expectedDrawerAmount = shift.openingFloat + stats.cashSales
  const drawerVariance = countedDrawerAmount - expectedDrawerAmount
  const status = deriveShiftStatusOnClose({
    scheduledEndAt: shift.scheduledEndAt,
    endedAt: now,
    pendingClosure: shift.status === 'PENDING_CLOSURE',
  })

  const closed = await transitionActiveShift(shift._id.toString(), {
    endedAt: now,
    clockOutAt: now,
    status,
    countedDrawerAmount,
    expectedDrawerAmount,
    drawerVariance,
    cashSales: stats.cashSales,
    mpesaSales: stats.mpesaSales,
    totalRevenue: stats.totalRevenue,
    ordersServed: stats.ordersServed,
    refunds: stats.refunds,
    discounts: stats.discounts,
    notes: String(body.notes ?? shift.notes ?? ''),
    pendingClosureAt: null,
    metadata: {
      ...(shift.metadata ?? {}),
      financialLocked: true,
      financialLockedAt: now.toISOString(),
      closedByType: 'USER',
      closeReason: 'normal_clockout',
      clockOutAt: now.toISOString(),
    },
  })
  if (!closed) {
    const latest = await getLatestStaffShiftByUserId(auth.userId)
    if (latest?.endedAt) return NextResponse.json({ ok: true, shift: latest, replay: true })
    return NextResponse.json({ error: 'Shift already closed' }, { status: 409 })
  }

  await createShiftEvent({
    shiftId: shift._id.toString(),
    staffUserId: auth.userId,
    actorUserId: auth.userId,
    actorName: auth.name,
    eventType: 'CLOSE',
    metadata: { status, drawerVariance, expectedDrawerAmount, countedDrawerAmount, requestId },
  })
  await sendShiftNotification(
    'CLOCK_OUT',
    (() => {
      const timing = analyzeShiftTiming({
        scheduledEndTime: shift.scheduledEndAt,
        actualEndTime: now,
      })
      const timingLine =
        timing.closeStatus === 'ON_TIME'
          ? 'Timing: On Time'
          : timing.closeStatus === 'EARLY'
          ? `Timing: Early (${formatSignedTimingForSms(timing.closeDiffMs)})`
          : `Timing: Overtime (${formatSignedTimingForSms(timing.closeDiffMs)})`
      return `[SHIFT CLOSE]\nUser: ${auth.name}\n${timingLine}`
    })(),
    shift._id.toString(),
    { dedupeKey: requestId || `shift-close:${shift._id.toString()}` }
  )
  if (drawerVariance < 0) {
    await sendShiftNotification(
      'CASH_VARIANCE',
      `${auth.name} drawer shortage KES ${Math.abs(Math.round(drawerVariance)).toLocaleString()}.`,
      shift._id.toString()
    )
  }

  return NextResponse.json({ ok: true, shift: closed })
}
