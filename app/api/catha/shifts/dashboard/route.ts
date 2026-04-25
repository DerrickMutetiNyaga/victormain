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
  if (!['ADMIN', 'SUPER_ADMIN'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const range = String(url.searchParams.get('range') ?? 'today')
  const staffUserId = url.searchParams.get('staffUserId') || undefined
  const from = getRangeStart(range)
  const shifts = await listStaffShifts({ from, staffUserId, limit: 500 })
  const active = shifts.filter((s) => s.status === 'ACTIVE').length
  const late = shifts.filter((s) => ['yellow', 'orange', 'red'].includes(String(s.metadata?.latenessBand ?? ''))).length
  const earlyExit = shifts.filter((s) => s.status === 'EARLY_EXIT').length
  const overtime = shifts.filter((s) => s.status === 'OVERTIME').length
  const shortages = shifts.filter((s) => (s.drawerVariance ?? 0) < 0).length
  const top = [...shifts].sort((a, b) => b.totalRevenue - a.totalRevenue)[0]
  const totalSalesByCashier = shifts.reduce<Record<string, number>>((acc, shift) => {
    acc[shift.staffName] = (acc[shift.staffName] ?? 0) + shift.totalRevenue
    return acc
  }, {})
  return NextResponse.json({
    ok: true,
    cards: {
      activeShiftsNow: active,
      lateArrivalsToday: late,
      noShows: 0,
      bestPerformerToday: top?.staffName ?? null,
      earlyExits: earlyExit,
      cashShortages: shortages,
      overtimeStaff: overtime,
      totalSalesByCashier,
    },
    rows: shifts,
  })
}
