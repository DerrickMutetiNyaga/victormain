import { NextResponse } from 'next/server'
import { createStaffShift, getActiveStaffShiftByUserId } from '@/lib/models/staff-shift'
import { createShiftEvent } from '@/lib/models/shift-event'
import { getShiftSettings } from '@/lib/models/shift-setting'
import { getDeviceFingerprint, getScheduleForNow, requireShiftSessionUser } from '@/lib/catha-shift-service'
import { sendShiftOpenedNotification } from '@/lib/catha-shift-lifecycle'
import { analyzeShiftTiming, formatSignedTimingForSms } from '@/lib/catha-shift-timing-analysis'

export async function POST(request: Request) {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const existing = await getActiveStaffShiftByUserId(auth.userId)
  if (existing) return NextResponse.json({ ok: true, shift: existing })

  const body = await request.json().catch(() => ({}))
  const settings = await getShiftSettings()
  const { now, scheduledStartAt, scheduledEndAt, businessDate, timezone, latenessBand } = getScheduleForNow(
    settings.openingTime,
    settings.closingTime
  )

  const openingFloat = Number(body.openingFloat ?? 0)
  if (!Number.isFinite(openingFloat) || openingFloat < 0 || openingFloat > 1_000_000) {
    return NextResponse.json({ error: 'Invalid opening float amount' }, { status: 400 })
  }
  const requestId = String(request.headers.get('x-idempotency-key') ?? '').trim()

  let shift
  try {
    shift = await createStaffShift({
      staffUserId: auth.userId,
      staffName: auth.name,
      role: auth.role,
      status: 'ACTIVE',
      businessDate,
      timezone,
      deviceFingerprint: getDeviceFingerprint(new Headers(request.headers)),
      startedAt: now,
      scheduledStartAt,
      scheduledEndAt,
      openingFloat,
      expectedDrawerAmount: openingFloat,
      countedDrawerAmount: null,
      drawerVariance: null,
      cashSales: 0,
      mpesaSales: 0,
      totalRevenue: 0,
      ordersServed: 0,
      refunds: 0,
      discounts: 0,
      totalBreakMinutes: 0,
      notes: String(body.notes ?? ''),
      metadata: { latenessBand, clockInRequestId: requestId || undefined },
    })
  } catch (error: any) {
    if (error?.code === 11000) {
      const active = await getActiveStaffShiftByUserId(auth.userId)
      if (active) return NextResponse.json({ ok: true, shift: active })
    }
    throw error
  }

  await createShiftEvent({
    shiftId: shift._id!.toString(),
    staffUserId: auth.userId,
    actorUserId: auth.userId,
    actorName: auth.name,
    eventType: 'CLOCK_IN',
    metadata: { latenessBand, openingFloat, requestId },
  })
  await sendShiftOpenedNotification({
    shiftId: shift._id!.toString(),
    dedupeKey: requestId || `shift:open:${shift._id!.toString()}`,
    message: (() => {
      const timing = analyzeShiftTiming({
        scheduledStartTime: scheduledStartAt,
        actualStartTime: now,
      })
      const timingLine =
        timing.openStatus === 'ON_TIME'
          ? 'Timing: On Time'
          : `${timing.openStatus === 'EARLY' ? 'Timing: Early' : 'Timing: Late'} (${formatSignedTimingForSms(
              timing.openDiffMs
            )})`
      return `[SHIFT OPEN]\nUser: ${auth.name}\n${timingLine}`
    })(),
  })

  return NextResponse.json({ ok: true, shift })
}
