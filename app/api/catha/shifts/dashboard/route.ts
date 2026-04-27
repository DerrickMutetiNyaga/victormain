import { NextResponse } from 'next/server'
import { aggregateShiftOrderStats, computeShiftLatenessBand, requireShiftSessionUser } from '@/lib/catha-shift-service'
import { listStaffShifts } from '@/lib/models/staff-shift'
import { getCathaUserEmailsByIds } from '@/lib/models/catha-user'
import { getShiftSettings } from '@/lib/models/shift-setting'
import { autoCloseOverdueShifts } from '@/lib/catha-shift-auto-close'
import { getDatabase } from '@/lib/mongodb'
import { getEatBusinessDate } from '@/lib/catha-shift-time'

function getRangeStart(range: string): Date | undefined {
  const now = new Date()
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (range === 'week') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  if (range === 'month') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  return undefined
}

type TodayMetrics = {
  activeStaff: number
  activeStaffDeltaFromYesterday: number
  hoursWorkedMs: number
  hoursWorkedYesterdayMs: number
  revenue: number
  revenueYesterday: number
  pendingClockOuts: number
  pendingClockOutsYesterday: number
}

type MonthlyMetrics = {
  lateArrivals: number
  lateArrivalsLastMonth: number
  attendanceScore: number
  attendanceScoreLastMonth: number
}

let todayMetricsCache: { expiresAt: number; value: TodayMetrics } | null = null
let monthlyMetricsCache: { expiresAt: number; value: MonthlyMetrics } | null = null

const ONE_MINUTE_MS = 60_000
const TEN_MINUTES_MS = 10 * ONE_MINUTE_MS

function startOfEatDay(now: Date) {
  const businessDate = getEatBusinessDate(now)
  const [year, month, day] = businessDate.split('-').map((n) => Number(n))
  return new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0))
}

function startOfEatMonth(now: Date) {
  const businessDate = getEatBusinessDate(now)
  const [year, month] = businessDate.split('-').map((n) => Number(n))
  return new Date(Date.UTC(year, month - 1, 1, -3, 0, 0, 0))
}

function durationWithinWindowMs(start: Date, end: Date | null, windowStart: Date, windowEnd: Date) {
  const effectiveStart = Math.max(start.getTime(), windowStart.getTime())
  const effectiveEnd = Math.min((end ?? windowEnd).getTime(), windowEnd.getTime())
  return Math.max(0, effectiveEnd - effectiveStart)
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

async function computeTodayMetrics(now: Date): Promise<TodayMetrics> {
  const nowTs = now.getTime()
  const dayStart = startOfEatDay(now)
  const yesterdayStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000)
  const sameTimeYesterday = new Date(nowTs - 24 * 60 * 60 * 1000)
  const db = await getDatabase('infusion_jaba')
  const shiftsToday = await listStaffShifts({ from: dayStart, to: now, limit: 2000 })
  const shiftsYesterdayToNow = await listStaffShifts({ from: yesterdayStart, to: sameTimeYesterday, limit: 2000 })

  const activeStaff = shiftsToday.filter((s) => s.status === 'ACTIVE').length
  const activeYesterday = (
    await db
      .collection('staff_shifts')
      .find({
        startedAt: { $gte: yesterdayStart, $lte: sameTimeYesterday },
        status: 'ACTIVE',
      })
      .project({ _id: 1 })
      .toArray()
  ).length

  const hoursWorkedMs = shiftsToday.reduce((sum, shift) => {
    const started = toDate(shift.startedAt)
    if (!started) return sum
    const ended = toDate(shift.endedAt)
    return sum + durationWithinWindowMs(started, ended, dayStart, now)
  }, 0)

  const pendingClockOuts = shiftsToday.filter((shift) => {
    if (shift.status !== 'ACTIVE') return false
    const started = toDate(shift.startedAt)
    if (!started || started < dayStart) return false
    const scheduledEnd = toDate(shift.scheduledEndAt)
    return !shift.endedAt || (scheduledEnd ? scheduledEnd <= now : true)
  }).length
  const hoursWorkedYesterdayMs = shiftsYesterdayToNow.reduce((sum, shift) => {
    const started = toDate(shift.startedAt)
    if (!started) return sum
    const ended = toDate(shift.endedAt)
    return sum + durationWithinWindowMs(started, ended, yesterdayStart, sameTimeYesterday)
  }, 0)
  const pendingClockOutsYesterday = shiftsYesterdayToNow.filter((shift) => {
    if (shift.status !== 'ACTIVE') return false
    const started = toDate(shift.startedAt)
    if (!started || started < yesterdayStart) return false
    const scheduledEnd = toDate(shift.scheduledEndAt)
    return !shift.endedAt || (scheduledEnd ? scheduledEnd <= sameTimeYesterday : true)
  }).length

  const revenueAgg = await db
    .collection('orders')
    .aggregate<{ totalRevenue: number }>([
      {
        $match: {
          createdAt: { $gte: dayStart, $lte: now },
          status: { $in: ['completed', 'COMPLETED'] },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ['$total', 0] } },
        },
      },
    ])
    .toArray()
  const revenueYesterdayAgg = await db
    .collection('orders')
    .aggregate<{ totalRevenue: number }>([
      {
        $match: {
          createdAt: { $gte: yesterdayStart, $lte: sameTimeYesterday },
          status: { $in: ['completed', 'COMPLETED'] },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ['$total', 0] } },
        },
      },
    ])
    .toArray()
  const revenue = Number(revenueAgg[0]?.totalRevenue ?? 0)
  const revenueYesterday = Number(revenueYesterdayAgg[0]?.totalRevenue ?? 0)

  return {
    activeStaff,
    activeStaffDeltaFromYesterday: activeStaff - activeYesterday,
    hoursWorkedMs,
    hoursWorkedYesterdayMs,
    revenue,
    revenueYesterday,
    pendingClockOuts,
    pendingClockOutsYesterday,
  }
}

async function computeMonthlyMetrics(now: Date): Promise<MonthlyMetrics> {
  const monthStart = startOfEatMonth(now)
  const lastMonthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1, -3, 0, 0, 0))
  const monthEndExclusive = monthStart
  const settings = await getShiftSettings()
  const graceMs = Math.max(0, Number(settings.graceLatenessMinutes ?? 0)) * 60_000
  const monthlyShifts = await listStaffShifts({ from: monthStart, to: now, limit: 5000 })
  const lastMonthShifts = await listStaffShifts({ from: lastMonthStart, to: monthEndExclusive, limit: 5000 })
  const totalShifts = monthlyShifts.length
  const lateArrivals = monthlyShifts.filter((shift) => {
    const started = toDate(shift.startedAt)
    const scheduledStart = toDate(shift.scheduledStartAt)
    return !!started && !!scheduledStart && started.getTime() > scheduledStart.getTime()
  }).length
  const onTimeShifts = monthlyShifts.filter((shift) => {
    const started = toDate(shift.startedAt)
    const scheduledStart = toDate(shift.scheduledStartAt)
    if (!started || !scheduledStart) return false
    return started.getTime() <= scheduledStart.getTime() + graceMs
  }).length
  const lateArrivalsLastMonth = lastMonthShifts.filter((shift) => {
    const started = toDate(shift.startedAt)
    const scheduledStart = toDate(shift.scheduledStartAt)
    return !!started && !!scheduledStart && started.getTime() > scheduledStart.getTime()
  }).length
  const onTimeLastMonth = lastMonthShifts.filter((shift) => {
    const started = toDate(shift.startedAt)
    const scheduledStart = toDate(shift.scheduledStartAt)
    if (!started || !scheduledStart) return false
    return started.getTime() <= scheduledStart.getTime() + graceMs
  }).length

  return {
    lateArrivals,
    lateArrivalsLastMonth,
    attendanceScore: totalShifts ? Math.round((onTimeShifts / totalShifts) * 100) : 100,
    attendanceScoreLastMonth: lastMonthShifts.length ? Math.round((onTimeLastMonth / lastMonthShifts.length) * 100) : 100,
  }
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
      const shouldComputeLiveStats = shift.status === 'ACTIVE' || shift.status === 'PENDING_CLOSURE'
      const liveStats = shouldComputeLiveStats
        ? await aggregateShiftOrderStats(
            shift.staffName,
            shift.startedAt,
            shift.endedAt ? new Date(shift.endedAt) : new Date(),
            [emailsById[shift.staffUserId]],
            shift.staffUserId
          )
        : {
            ordersServed: Number(shift.ordersServed ?? 0),
            cashSales: Number(shift.cashSales ?? 0),
            mpesaSales: Number(shift.mpesaSales ?? 0),
            totalRevenue: Number(shift.totalRevenue ?? 0),
            refunds: Number(shift.refunds ?? 0),
            discounts: Number(shift.discounts ?? 0),
          }
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
  const now = new Date()
  const nowMs = now.getTime()
  const todayMetrics =
    todayMetricsCache && todayMetricsCache.expiresAt > nowMs
      ? todayMetricsCache.value
      : await computeTodayMetrics(now).then((value) => {
          todayMetricsCache = { value, expiresAt: nowMs + ONE_MINUTE_MS }
          return value
        })
  const monthlyMetrics =
    monthlyMetricsCache && monthlyMetricsCache.expiresAt > nowMs
      ? monthlyMetricsCache.value
      : await computeMonthlyMetrics(now).then((value) => {
          monthlyMetricsCache = { value, expiresAt: nowMs + TEN_MINUTES_MS }
          return value
        })

  const response = NextResponse.json({
    ok: true,
    cards: {
      activeShiftsNow: todayMetrics.activeStaff,
      activeShiftsDeltaFromYesterday: todayMetrics.activeStaffDeltaFromYesterday,
      hoursWorkedTodayMs: todayMetrics.hoursWorkedMs,
      hoursWorkedYesterdayMs: todayMetrics.hoursWorkedYesterdayMs,
      revenueToday: todayMetrics.revenue,
      revenueYesterday: todayMetrics.revenueYesterday,
      pendingClockOutsToday: todayMetrics.pendingClockOuts,
      pendingClockOutsYesterday: todayMetrics.pendingClockOutsYesterday,
      lateArrivalsMonth: monthlyMetrics.lateArrivals,
      lateArrivalsLastMonth: monthlyMetrics.lateArrivalsLastMonth,
      attendanceScoreMonth: monthlyMetrics.attendanceScore,
      attendanceScoreLastMonth: monthlyMetrics.attendanceScoreLastMonth,
      noShows: 0,
      bestPerformerToday: top?.staffName ?? null,
      earlyExits: earlyExit,
      cashShortages: shortages,
      overtimeStaff: overtime,
      totalSalesByCashier,
      scope: {
        today: { from: startOfEatDay(now).toISOString(), to: now.toISOString() },
        month: { from: startOfEatMonth(now).toISOString(), to: now.toISOString() },
      },
      legacy: {
        activeShiftsNow: active,
        lateArrivalsToday: late,
      },
    },
    rows: enrichedShifts,
  })
  response.headers.set('Cache-Control', 'private, max-age=30')
  return response
}
