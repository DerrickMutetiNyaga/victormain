import { NextResponse } from 'next/server'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'
import { createShiftEvent } from '@/lib/models/shift-event'
import { getActiveStaffShiftByUserId } from '@/lib/models/staff-shift'

export async function POST(request: Request) {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json().catch(() => ({}))
  const issue = String(body.issue ?? '').trim()
  if (!issue) return NextResponse.json({ error: 'Issue is required' }, { status: 400 })
  const shift = await getActiveStaffShiftByUserId(auth.userId)
  if (!shift?._id) return NextResponse.json({ error: 'No active shift' }, { status: 400 })
  await createShiftEvent({
    shiftId: shift._id.toString(),
    staffUserId: auth.userId,
    actorUserId: auth.userId,
    actorName: auth.name,
    eventType: 'ISSUE_REPORTED',
    reason: issue,
  })
  return NextResponse.json({ ok: true })
}
