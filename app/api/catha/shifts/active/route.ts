import { NextResponse } from 'next/server'
import { getActiveStaffShiftByUserId } from '@/lib/models/staff-shift'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'

export async function GET() {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const shift = await getActiveStaffShiftByUserId(auth.userId)
  return NextResponse.json({ ok: true, shift })
}
