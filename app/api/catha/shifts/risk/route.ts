import { NextResponse } from 'next/server'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'
import { listStaffShifts } from '@/lib/models/staff-shift'

function riskBand(score: number) {
  if (score >= 70) return 'high'
  if (score >= 35) return 'watch'
  return 'normal'
}

export async function GET(request: Request) {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!['ADMIN', 'SUPER_ADMIN'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const days = Math.min(180, Math.max(7, Number(url.searchParams.get('days') ?? 30)))
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const shifts = await listStaffShifts({ from, limit: 5000 })

  const byStaff: Record<
    string,
    {
      name: string
      shifts: number
      voidLike: number
      refunds: number
      discountHeavy: number
      shortages: number
      inactivityLike: number
      overtimeNoSales: number
      pendingClosures: number
      score: number
    }
  > = {}

  for (const shift of shifts) {
    if (!byStaff[shift.staffUserId]) {
      byStaff[shift.staffUserId] = {
        name: shift.staffName,
        shifts: 0,
        voidLike: 0,
        refunds: 0,
        discountHeavy: 0,
        shortages: 0,
        inactivityLike: 0,
        overtimeNoSales: 0,
        pendingClosures: 0,
        score: 0,
      }
    }
    const row = byStaff[shift.staffUserId]
    row.shifts += 1
    if ((shift.refunds ?? 0) > 0) row.refunds += 1
    if ((shift.discounts ?? 0) > 0 && (shift.discounts ?? 0) > (shift.totalRevenue ?? 0) * 0.15) row.discountHeavy += 1
    if ((shift.drawerVariance ?? 0) < 0) row.shortages += 1
    if ((shift.ordersServed ?? 0) === 0 && (shift.totalRevenue ?? 0) === 0) row.inactivityLike += 1
    if ((shift.status ?? '') === 'PENDING_CLOSURE' || shift.pendingClosureAt) row.pendingClosures += 1
    if ((shift.status ?? '') === 'OVERTIME' && (shift.ordersServed ?? 0) === 0) row.overtimeNoSales += 1
    if ((shift.metadata?.voidOrders as number | undefined) && Number(shift.metadata?.voidOrders) > 0) row.voidLike += 1
  }

  const rows = Object.entries(byStaff).map(([staffUserId, row]) => {
    const base = row.shifts || 1
    const score =
      (row.refunds / base) * 20 +
      (row.discountHeavy / base) * 15 +
      (row.shortages / base) * 25 +
      (row.inactivityLike / base) * 15 +
      (row.pendingClosures / base) * 15 +
      (row.overtimeNoSales / base) * 10 +
      (row.voidLike / base) * 20
    const normalized = Math.max(0, Math.min(100, Math.round(score)))
    return {
      staffUserId,
      staffName: row.name,
      shifts: row.shifts,
      indicators: {
        refunds: row.refunds,
        discountHeavy: row.discountHeavy,
        shortages: row.shortages,
        inactivityLike: row.inactivityLike,
        pendingClosures: row.pendingClosures,
        overtimeNoSales: row.overtimeNoSales,
        voidLike: row.voidLike,
      },
      score: normalized,
      band: riskBand(normalized),
    }
  })

  rows.sort((a, b) => b.score - a.score)

  return NextResponse.json({
    ok: true,
    rangeDays: days,
    summary: {
      highRisk: rows.filter((r) => r.band === 'high').length,
      watchlist: rows.filter((r) => r.band === 'watch').length,
      normal: rows.filter((r) => r.band === 'normal').length,
    },
    rows,
  })
}
