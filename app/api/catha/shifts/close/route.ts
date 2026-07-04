import { NextResponse } from 'next/server'
import { aggregateShiftOrderStats, deriveShiftStatusOnClose, requireShiftSessionUser } from '@/lib/catha-shift-service'
import { findShiftEventByRequestId } from '@/lib/models/shift-event'
import { getActiveStaffShiftByUserId, getLatestStaffShiftByUserId } from '@/lib/models/staff-shift'
import { sendShiftNotification } from '@/lib/catha-shift-sms'
import { analyzeShiftTiming, formatSignedTimingForSms } from '@/lib/catha-shift-timing-analysis'
import { closeShiftAndNotify } from '@/lib/catha-shift-lifecycle'

const DELAYED_CLOSE_GRACE_HOURS = 2

function isDelayedClosure(scheduledEndAt: Date | undefined | null, now: Date): boolean {
  if (!scheduledEndAt) return false
  const threshold = new Date(scheduledEndAt).getTime() + DELAYED_CLOSE_GRACE_HOURS * 60 * 60 * 1000
  return now.getTime() > threshold
}

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
  const expectedCloseTime = new Date(shift.scheduledEndAt)
  const delayedClosure = isDelayedClosure(shift.scheduledEndAt, now)
  const closeAtStrategy = String(body.closeAtStrategy ?? '').trim()
  let closedAt = now
  if (closeAtStrategy === 'expected') {
    closedAt = expectedCloseTime
  } else if (closeAtStrategy === 'manual') {
    const parsedManual = new Date(String(body.manualClosedAt ?? ''))
    if (!Number.isFinite(parsedManual.getTime())) {
      return NextResponse.json({ error: 'Invalid manual closing time' }, { status: 400 })
    }
    closedAt = parsedManual
  } else if (closeAtStrategy === 'now' || closeAtStrategy === '') {
    closedAt = now
  } else {
    return NextResponse.json({ error: 'Invalid close strategy' }, { status: 400 })
  }
  if (closedAt.getTime() < new Date(shift.startedAt).getTime()) {
    return NextResponse.json({ error: 'Closing time cannot be before shift start' }, { status: 400 })
  }
  if (delayedClosure && closeAtStrategy === '') {
    return NextResponse.json({ error: 'Delayed closure choice is required' }, { status: 400 })
  }
  const overdueByMs = Math.max(0, now.getTime() - expectedCloseTime.getTime())
  const delayedByMs = Math.max(0, overdueByMs - DELAYED_CLOSE_GRACE_HOURS * 60 * 60 * 1000)
  const crossedDayBoundary = now.toDateString() !== expectedCloseTime.toDateString()
  const closureContext = {
    strategy: (closeAtStrategy || 'now') as 'expected' | 'now' | 'manual',
    wasDelayed: delayedClosure,
    overdueByMs,
    delayedByMs,
    crossedDayBoundary,
    decidedAt: now.toISOString(),
    isCorrectedClosure: closeAtStrategy === 'expected' && delayedClosure,
  }
  const stats = await aggregateShiftOrderStats(auth.name, shift.startedAt, closedAt, [auth.email], auth.userId)
  const countedDrawerAmount = Number(body.countedDrawerAmount ?? shift.countedDrawerAmount ?? 0)
  if (!Number.isFinite(countedDrawerAmount) || countedDrawerAmount < 0 || countedDrawerAmount > 10_000_000) {
    return NextResponse.json({ error: 'Invalid counted drawer amount' }, { status: 400 })
  }
  const expectedDrawerAmount = shift.openingFloat + stats.cashSales
  const drawerVariance = countedDrawerAmount - expectedDrawerAmount
  const status = deriveShiftStatusOnClose({
    scheduledEndAt: shift.scheduledEndAt,
    endedAt: closedAt,
    pendingClosure: shift.status === 'PENDING_CLOSURE',
  })

  const closeMessage = (() => {
    const timing = analyzeShiftTiming({
      scheduledEndTime: shift.scheduledEndAt,
      actualEndTime: closedAt,
    })
    const timingLine =
      timing.closeStatus === 'ON_TIME'
        ? 'Timing: On Time'
        : timing.closeStatus === 'EARLY'
        ? `Timing: Early (${formatSignedTimingForSms(timing.closeDiffMs)})`
        : `Timing: Overtime (${formatSignedTimingForSms(timing.closeDiffMs)})`
    return `[SHIFT CLOSE]\nUser: ${auth.name}\n${timingLine}`
  })()
  const closeResult = await closeShiftAndNotify({
    shift,
    actorUserId: auth.userId,
    actorName: auth.name,
    closeReason: 'normal_clockout',
    closeEventType: 'CLOSE',
    dedupeKey: requestId || `shift:close:${shift._id.toString()}`,
    closeMessage,
    eventMetadata: { status, drawerVariance, expectedDrawerAmount, countedDrawerAmount, requestId },
    updates: {
      endedAt: closedAt,
      clockOutAt: closedAt,
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
        clockOutAt: closedAt.toISOString(),
        closeAtStrategy: closureContext.strategy,
      },
      closureContext: shift.closureContext ?? closureContext,
    },
  })
  if (closeResult.replay) {
    const latest = await getLatestStaffShiftByUserId(auth.userId)
    if (latest?.endedAt) return NextResponse.json({ ok: true, shift: latest, replay: true })
    return NextResponse.json({ error: 'Shift already closed' }, { status: 409 })
  }
  const closed = closeResult.shift
  if (drawerVariance < 0) {
    await sendShiftNotification(
      'CASH_VARIANCE',
      `${auth.name} drawer shortage KES ${Math.abs(Math.round(drawerVariance)).toLocaleString()}.`,
      shift._id.toString()
    )
  }

  return NextResponse.json({ ok: true, shift: closed })
}
