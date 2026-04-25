import { NextResponse } from 'next/server'
import { requireShiftSessionUser } from '@/lib/catha-shift-service'
import { listStaffShifts } from '@/lib/models/staff-shift'
import { getShiftSettings } from '@/lib/models/shift-setting'

function rangeStart(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export async function GET() {
  const auth = await requireShiftSessionUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!['ADMIN', 'SUPER_ADMIN'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const settings = await getShiftSettings()
  const shifts = await listStaffShifts({ from: rangeStart(60), limit: 2000 })

  const revenuePerCashier = Object.entries(
    shifts.reduce<Record<string, number>>((acc, shift) => {
      acc[shift.staffName] = (acc[shift.staffName] ?? 0) + shift.totalRevenue
      return acc
    }, {})
  )
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  const peakHoursMap = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, '0')}:00`, count: 0 }))
  for (const shift of shifts) {
    const h = new Date(shift.startedAt).getHours()
    peakHoursMap[h]!.count += 1
  }

  const trendsMap: Record<string, { day: string; onTime: number; total: number }> = {}
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    trendsMap[key] = { day: key, onTime: 0, total: 0 }
  }
  for (const shift of shifts) {
    const key = new Date(shift.startedAt).toISOString().slice(0, 10)
    if (!trendsMap[key]) continue
    trendsMap[key].total += 1
    if (!['yellow', 'orange', 'red'].includes(String(shift.metadata?.latenessBand ?? ''))) trendsMap[key].onTime += 1
  }
  const attendanceTrends = Object.values(trendsMap).map((row) => ({
    day: row.day.slice(5),
    onTimeRate: row.total ? Math.round((row.onTime / row.total) * 100) : 100,
  }))

  const lateByStaff = Object.entries(
    shifts.reduce<Record<string, number>>((acc, shift) => {
      const band = String(shift.metadata?.latenessBand ?? '')
      if (['yellow', 'orange', 'red'].includes(band)) acc[shift.staffName] = (acc[shift.staffName] ?? 0) + 1
      return acc
    }, {})
  )
    .map(([name, lateCount]) => ({ name, lateCount }))
    .sort((a, b) => b.lateCount - a.lateCount)
    .slice(0, 10)

  const overtimeByStaff = Object.entries(
    shifts.reduce<Record<string, number>>((acc, shift) => {
      if (!shift.endedAt) return acc
      const mins = Math.max(
        0,
        Math.round((new Date(shift.endedAt).getTime() - new Date(shift.scheduledEndAt).getTime()) / 60000)
      )
      if (mins < 30) return acc
      acc[shift.staffName] = (acc[shift.staffName] ?? 0) + mins
      return acc
    }, {})
  ).map(([name, overtimeMinutes]) => ({
    name,
    overtimeMinutes,
    overtimeCost: Math.round((overtimeMinutes / 60) * (settings.overtimeHourlyRate || 0)),
  }))

  const shortagesTrendMap: Record<string, number> = {}
  for (const shift of shifts) {
    if ((shift.drawerVariance ?? 0) >= 0) continue
    const key = new Date(shift.startedAt).toISOString().slice(0, 10)
    shortagesTrendMap[key] = (shortagesTrendMap[key] ?? 0) + Math.abs(Math.round(shift.drawerVariance ?? 0))
  }
  const cashShortagesHistory = Object.entries(shortagesTrendMap)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-14)
    .map(([day, shortage]) => ({ day: day.slice(5), shortage }))

  const productive = [...shifts].sort((a, b) => b.totalRevenue - a.totalRevenue)[0]

  const scoreboard = Object.entries(
    shifts.reduce<Record<string, { revenue: number; onTime: number; total: number }>>((acc, shift) => {
      if (!acc[shift.staffName]) acc[shift.staffName] = { revenue: 0, onTime: 0, total: 0 }
      acc[shift.staffName].revenue += shift.totalRevenue
      acc[shift.staffName].total += 1
      if (!['yellow', 'orange', 'red'].includes(String(shift.metadata?.latenessBand ?? ''))) acc[shift.staffName].onTime += 1
      return acc
    }, {})
  )
    .map(([name, v]) => ({
      name,
      revenue: Math.round(v.revenue),
      attendanceScore: v.total ? Math.round((v.onTime / v.total) * 100) : 100,
      badge: v.total >= 7 && v.onTime === v.total ? 'On-Time Streak 7+' : v.revenue > 0 ? 'Top Seller' : 'Rising',
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  return NextResponse.json({
    ok: true,
    charts: {
      revenuePerCashier,
      peakHoursWorked: peakHoursMap,
      attendanceTrends,
      chronicLateness: lateByStaff,
      overtimeCosts: overtimeByStaff,
      cashShortagesHistory,
    },
    insights: {
      mostProductiveEmployee: productive?.staffName ?? null,
      mostProductiveRevenue: productive?.totalRevenue ?? 0,
    },
    scoreboard,
  })
}
