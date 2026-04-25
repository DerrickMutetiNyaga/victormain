import { NextResponse } from 'next/server'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'
import { listStaffShifts } from '@/lib/models/staff-shift'

function getRangeStart(range: string): Date | undefined {
  const now = new Date()
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (range === 'week') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  if (range === 'month') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  return undefined
}

export async function GET(request: Request) {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const url = new URL(request.url)
  const range = String(url.searchParams.get('range') ?? 'week')
  const staffUserId = url.searchParams.get('staffUserId') || undefined
  const customFrom = url.searchParams.get('from')
  const from = customFrom ? new Date(customFrom) : getRangeStart(range)
  const toRaw = url.searchParams.get('to')
  const to = toRaw ? new Date(toRaw) : undefined

  const canViewAll = auth.role === 'ADMIN' || auth.role === 'SUPER_ADMIN'
  const shifts = await listStaffShifts({
    staffUserId: canViewAll ? staffUserId : auth.userId,
    from,
    to,
    limit: 250,
  })
  return NextResponse.json({ ok: true, shifts })
}
