import { NextResponse } from 'next/server'
import { aggregateShiftOrderStats, computeShiftLatenessBand, requireShiftSessionUser } from '@/lib/catha-shift-service'
import { listStaffShifts } from '@/lib/models/staff-shift'
import { getCathaUserEmailsByIds } from '@/lib/models/catha-user'
import { getShiftSettings } from '@/lib/models/shift-setting'

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
  const range = String(url.searchParams.get('range') ?? 'month')
  const staffUserId = url.searchParams.get('staffUserId') || undefined
  const customFrom = url.searchParams.get('from')
  const from = customFrom ? new Date(customFrom) : getRangeStart(range)
  const toRaw = url.searchParams.get('to')
  const to = toRaw ? new Date(toRaw) : undefined
  const settings = await getShiftSettings()

  const canViewAll = auth.role === 'ADMIN' || auth.role === 'SUPER_ADMIN'
  const shifts = await listStaffShifts({
    staffUserId: canViewAll ? staffUserId : auth.userId,
    from,
    to,
    limit: 250,
  })
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
  return NextResponse.json({ ok: true, shifts: enrichedShifts })
}
