import { NextResponse } from 'next/server'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'
import { getActiveStaffShiftByUserId } from '@/lib/models/staff-shift'
import { autoCloseOverdueShiftForUser, getContinuePromptShiftForUser } from '@/lib/catha-shift-auto-close'

export async function GET() {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const autoResult = await autoCloseOverdueShiftForUser(auth.userId)
  const shift = await getActiveStaffShiftByUserId(auth.userId)
  const continuePromptShift = shift ? null : await getContinuePromptShiftForUser(auth.userId)
  const autoClosedShift = autoResult.autoClosed[0]
    ? {
        _id: autoResult.autoClosed[0]._id?.toString(),
        startedAt: autoResult.autoClosed[0].startedAt,
        endedAt: autoResult.autoClosed[0].endedAt,
        status: autoResult.autoClosed[0].status,
      }
    : null

  return NextResponse.json({ ok: true, shift, autoClosedShift, continuePromptShift })
}
