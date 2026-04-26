import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'
import {
  getActiveStaffShiftByUserId,
  getLatestStaffShiftByUserId,
  getShiftById,
  transitionActiveShift,
} from '@/lib/models/staff-shift'
import { createShiftEvent } from '@/lib/models/shift-event'
import { sendShiftNotification } from '@/lib/catha-shift-sms'

export async function POST(request: Request) {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const existing = await getActiveStaffShiftByUserId(auth.userId)
  if (existing) return NextResponse.json({ ok: true, shift: existing, replay: true })

  const body = await request.json().catch(() => ({}))
  const requestedShiftId = String(body.shiftId ?? '').trim()

  let shift =
    ObjectId.isValid(requestedShiftId)
      ? await getShiftById(requestedShiftId)
      : await getLatestStaffShiftByUserId(auth.userId)

  if (!shift?._id || shift.staffUserId !== auth.userId) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }
  if (shift.status !== 'AUTO_CLOSED') {
    return NextResponse.json({ error: 'Only auto-closed shifts can be continued' }, { status: 400 })
  }
  if (!Boolean((shift.metadata as { autoClosedBySystem?: boolean } | undefined)?.autoClosedBySystem)) {
    return NextResponse.json({ error: 'Only system auto-closed shifts can be continued' }, { status: 400 })
  }

  const resumed = await transitionActiveShift(
    shift._id.toString(),
    {
      status: 'ACTIVE',
      endedAt: null,
      pendingClosureAt: null,
      pendingClosureReason: undefined,
      forcedCloseReason: undefined,
      metadata: {
        ...(shift.metadata ?? {}),
        resumedAfterAutoClose: true,
        continuedByUserId: auth.userId,
        resumedAt: new Date().toISOString(),
        financialLocked: false,
      },
    },
    ['AUTO_CLOSED']
  )

  if (!resumed) {
    const active = await getActiveStaffShiftByUserId(auth.userId)
    if (active) return NextResponse.json({ ok: true, shift: active, replay: true })
    return NextResponse.json({ error: 'Unable to continue shift' }, { status: 409 })
  }

  await createShiftEvent({
    shiftId: shift._id.toString(),
    staffUserId: auth.userId,
    actorUserId: auth.userId,
    actorName: auth.name,
    eventType: 'CLOCK_IN_CONTINUE',
    metadata: { continuedShift: true, resumedFrom: 'AUTO_CLOSED' },
  })
  await sendShiftNotification(
    'CLOCK_IN',
    `[SHIFT RESUMED]\nUser: ${auth.name}\nReason: Continued auto-closed shift.`,
    shift._id.toString(),
    { dedupeKey: `shift-resume:${shift._id.toString()}` }
  )

  return NextResponse.json({ ok: true, shift: resumed })
}
