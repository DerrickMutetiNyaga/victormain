import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { createShiftEvent } from '@/lib/models/shift-event'
import { getShiftById, updateStaffShift } from '@/lib/models/staff-shift'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'

export async function POST(request: Request) {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!['ADMIN', 'SUPER_ADMIN'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const shiftId = String(body.shiftId ?? '')
  const reason = String(body.reason ?? '').trim()
  if (!ObjectId.isValid(shiftId) || !reason) {
    return NextResponse.json({ error: 'shiftId and reason are required' }, { status: 400 })
  }
  const shift = await getShiftById(shiftId)
  if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  const updated = await updateStaffShift(shiftId, {
    status: 'AUTO_CLOSED',
    endedAt: new Date(),
    clockOutAt: new Date(),
    forcedClosedBy: auth.userId,
    forcedCloseReason: reason,
    metadata: {
      ...(shift.metadata ?? {}),
      autoClosedBySystem: false,
      closedByType: 'MANAGER',
      closeReason: reason,
      financialLocked: true,
      financialLockedAt: new Date().toISOString(),
    },
  })
  await createShiftEvent({
    shiftId,
    staffUserId: shift.staffUserId,
    actorUserId: auth.userId,
    actorName: auth.name,
    eventType: 'FORCE_CLOSE',
    reason,
  })
  return NextResponse.json({ ok: true, shift: updated })
}
