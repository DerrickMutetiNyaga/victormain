import { NextResponse } from 'next/server'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'
import { getActiveStaffShiftByUserId } from '@/lib/models/staff-shift'
import { autoCloseOverdueShiftForUser, getContinuePromptShiftForUser } from '@/lib/catha-shift-auto-close'

const DELAYED_CLOSE_GRACE_HOURS = 2

function formatDurationHuman(ms: number): string {
  const safe = Math.max(0, Math.floor(ms))
  const totalMinutes = Math.floor(safe / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes}m`
}

export async function GET() {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const autoResult = await autoCloseOverdueShiftForUser(auth.userId)
  const shift = await getActiveStaffShiftByUserId(auth.userId)
  const now = new Date()
  const expectedCloseAt = shift?.scheduledEndAt ? new Date(shift.scheduledEndAt) : null
  const overdueByMs = expectedCloseAt ? now.getTime() - expectedCloseAt.getTime() : 0
  const delayedByMs = Math.max(0, overdueByMs - DELAYED_CLOSE_GRACE_HOURS * 60 * 60 * 1000)
  const timing =
    shift && expectedCloseAt
      ? {
          isDelayed: delayedByMs > 0,
          overdueByMs: Math.max(0, overdueByMs),
          delayedByMs,
          overdueByHuman: formatDurationHuman(Math.max(0, overdueByMs)),
          delayedByHuman: formatDurationHuman(delayedByMs),
          expectedCloseAt: expectedCloseAt.toISOString(),
          now: now.toISOString(),
        }
      : null
  const continuePromptShift = shift ? null : await getContinuePromptShiftForUser(auth.userId)
  const autoClosedShift = autoResult.autoClosed[0]
    ? {
        _id: autoResult.autoClosed[0]._id?.toString(),
        startedAt: autoResult.autoClosed[0].startedAt,
        endedAt: autoResult.autoClosed[0].endedAt,
        status: autoResult.autoClosed[0].status,
      }
    : null

  return NextResponse.json({ ok: true, shift, timing, autoClosedShift, continuePromptShift })
}
