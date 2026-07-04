import { NextResponse } from 'next/server'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'
import { createShiftEvent } from '@/lib/models/shift-event'
import { getActiveStaffShiftByUserId, updateStaffShift } from '@/lib/models/staff-shift'
import { sendShiftNotification } from '@/lib/catha-shift-sms'

export async function POST() {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const shift = await getActiveStaffShiftByUserId(auth.userId)
  if (!shift?._id) return NextResponse.json({ ok: true })
  const updated = await updateStaffShift(shift._id.toString(), {
    status: 'PENDING_CLOSURE',
    pendingClosureAt: new Date(),
    pendingClosureReason: 'Session Ended Unexpectedly',
  })
  await createShiftEvent({
    shiftId: shift._id.toString(),
    staffUserId: auth.userId,
    actorUserId: auth.userId,
    actorName: auth.name,
    eventType: 'PENDING_CLOSURE',
    metadata: { reason: 'logout_only' },
  })
  await sendShiftNotification('SUSPICIOUS', `${auth.name} logged out without closing shift.`, shift._id.toString())
  return NextResponse.json({ ok: true, shift: updated })
}
