import { NextResponse } from 'next/server'
import { aggregateShiftOrderStats, computeShiftLatenessBand, requireShiftSessionUser } from '@/lib/catha-shift-service'
import { listStaffShifts } from '@/lib/models/staff-shift'
import { getCathaUserEmailsByIds } from '@/lib/models/catha-user'
import { getShiftSettings } from '@/lib/models/shift-setting'
import { autoCloseOverdueShifts } from '@/lib/catha-shift-auto-close'

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
  await autoCloseOverdueShifts({ limit: 500 })

  const url = new URL(request.url)
  const range = String(url.searchParams.get('range') ?? 'today')
  const staffUserId = url.searchParams.get('staffUserId') || undefined
  const from = getRangeStart(range)
  const settings = await getShiftSettings()
  const shifts = await listStaffShifts({ from, staffUserId, limit: 500 })
  const emailsById = await getCathaUserEmailsByIds(shifts.map((s) => s.staffUserId))
  const enrichedShifts = await Promise.all(
    shifts.map(async (shift) => {
      const liveStats = await aggregateShiftOrderStats(
        shift.staffName,
        shift.startedAt,
        shift.endedAt ? new Date(shift.endedAt) : new Date(),
        [emailsById[shift.staffUserId]],
        shift.staffUserId
      )
      return {
        ...shift,
        metadata: {
          ...(shift.metadata ?? {}),
          latenessBand: computeShiftLatenessBand(shift.startedAt, settings.openingTime),
        },
        ordersServed: liveStats.ordersServed,
        cashSales: liveStats.cashSales,
        mpesaSales: liveStats.mpesaSales,
        totalRevenue: liveStats.totalRevenue,
        refunds: liveStats.refunds,
        discounts: liveStats.discounts,
      }
    })
  )
  const active = enrichedShifts.filter((s) => s.status === 'ACTIVE').length
  const late = enrichedShifts.filter((s) => ['yellow', 'orange', 'red'].includes(String(s.metadata?.latenessBand ?? ''))).length
  const earlyExit = enrichedShifts.filter((s) => s.status === 'EARLY_EXIT').length
  const overtime = enrichedShifts.filter((s) => s.status === 'OVERTIME').length
  const shortages = enrichedShifts.filter((s) => (s.drawerVariance ?? 0) < 0).length
  const top = [...enrichedShifts].sort((a, b) => b.totalRevenue - a.totalRevenue)[0]
  const totalSalesByCashier = enrichedShifts.reduce<Record<string, number>>((acc, shift) => {
    acc[shift.staffName] = (acc[shift.staffName] ?? 0) + Number(shift.totalRevenue || 0)
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
    rows: enrichedShifts,
  })
}
