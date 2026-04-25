import { NextResponse } from 'next/server'
import { getActiveStaffShiftByUserId, updateStaffShift } from '@/lib/models/staff-shift'
import { closeShiftBreak, getShiftBreakMinutes } from '@/lib/models/shift-break'
import { createShiftEvent } from '@/lib/models/shift-event'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'

export async function POST() {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const shift = await getActiveStaffShiftByUserId(auth.userId)
  if (!shift?._id) return NextResponse.json({ error: 'No active shift' }, { status: 400 })
  const ended = await closeShiftBreak(shift._id.toString(), new Date())
  if (!ended) return NextResponse.json({ error: 'No active break' }, { status: 400 })
  const totalBreakMinutes = await getShiftBreakMinutes(shift._id.toString())
  await updateStaffShift(shift._id.toString(), { totalBreakMinutes })
  await createShiftEvent({
    shiftId: shift._id.toString(),
    staffUserId: auth.userId,
    actorUserId: auth.userId,
    actorName: auth.name,
    eventType: 'BREAK_END',
    metadata: { breakMinutes: ended.durationMinutes },
  })
  return NextResponse.json({ ok: true, break: ended, totalBreakMinutes })
}
