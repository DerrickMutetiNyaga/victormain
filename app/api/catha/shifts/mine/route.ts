import { NextResponse } from 'next/server'
import { aggregateShiftOrderStats, computeShiftLatenessBand, requireShiftSessionUser } from '@/lib/catha-shift-service'
import { listStaffShifts } from '@/lib/models/staff-shift'
import { getCathaUserEmailsByIds } from '@/lib/models/catha-user'
import { getShiftSettings } from '@/lib/models/shift-setting'
import { autoCloseOverdueShiftForUser } from '@/lib/catha-shift-auto-close'

export async function GET() {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  await autoCloseOverdueShiftForUser(auth.userId)
  const settings = await getShiftSettings()
  const shifts = await listStaffShifts({ staffUserId: auth.userId, limit: 30 })
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
