import { NextResponse } from 'next/server'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'
import { listStaffShifts } from '@/lib/models/staff-shift'

export async function GET() {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const shifts = await listStaffShifts({ staffUserId: auth.userId, limit: 30 })
  return NextResponse.json({ ok: true, shifts })
}
