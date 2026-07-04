import { NextResponse } from 'next/server'
import { getActiveStaffShiftByUserId } from '@/lib/models/staff-shift'
import { createShiftEvent } from '@/lib/models/shift-event'
import { getOpenBreak, startShiftBreak } from '@/lib/models/shift-break'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'

export async function POST(request: Request) {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const shift = await getActiveStaffShiftByUserId(auth.userId)
  if (!shift?._id) return NextResponse.json({ error: 'No active shift' }, { status: 400 })
  const open = await getOpenBreak(shift._id.toString())
  if (open) return NextResponse.json({ ok: true, break: open })

  const body = await request.json().catch(() => ({}))
  const breakType = String(body.breakType ?? 'TEA').toUpperCase()
  const created = await startShiftBreak({
    shiftId: shift._id.toString(),
    staffUserId: auth.userId,
    breakType: breakType === 'LUNCH' || breakType === 'EMERGENCY' ? breakType : 'TEA',
    startedAt: new Date(),
  })
  await createShiftEvent({
    shiftId: shift._id.toString(),
    staffUserId: auth.userId,
    actorUserId: auth.userId,
    actorName: auth.name,
    eventType: 'BREAK_START',
    metadata: { breakType: created.breakType },
  })
  return NextResponse.json({ ok: true, break: created })
}
