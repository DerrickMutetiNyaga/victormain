import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth-catha'
import { getDatabase } from '@/lib/mongodb'
import { normalizePermissions, hasCathaPermission } from '@/lib/catha-permissions-model'

type Summary = {
  revenue: number
  orders: number
  avgOrderValue: number
}

type ProfitPeriod = {
  revenue: number
  cost: number
  profit: number
}

type ProfitSummary = {
  weekly: ProfitPeriod
  monthly: ProfitPeriod
  yearly: ProfitPeriod
}

function parseDateRange(startDate: string | null, endDate: string | null) {
  const now = new Date()
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1)
  const endBase = endDate ? new Date(endDate) : now
  const end = new Date(endBase)
  // include end date up to 23:59:59.999
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function getPeriodBoundaries(now: Date) {
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  const weeklyStart = new Date(now)
  weeklyStart.setDate(weeklyStart.getDate() - 6)
  weeklyStart.setHours(0, 0, 0, 0)

  const monthlyStart = new Date(now.getFullYear(), now.getMonth(), 1)
  monthlyStart.setHours(0, 0, 0, 0)

  const yearlyStart = new Date(now.getFullYear(), 0, 1)
  yearlyStart.setHours(0, 0, 0, 0)

  return { weeklyStart, monthlyStart, yearlyStart, end }
}

async function computeProfitForPeriod(
  db: any,
  start: Date,
  end: Date
): Promise<ProfitPeriod> {
  const [agg] = await db.collection('orders').aggregate<any>([
    { $match: { status: 'completed', timestamp: { $gte: start, $lte: end } } },
    { $unwind: '$items' },
    {
      $addFields: {
        productObjectId: {
          $convert: { input: '$items.productId', to: 'objectId', onError: null, onNull: null },
        },
      },
    },
    {
      $lookup: {
        from: 'bar_inventory',
        localField: 'productObjectId',
        foreignField: '_id',
        as: 'inventoryProduct',
      },
    },
    {
      $addFields: {
        itemQty: { $ifNull: ['$items.quantity', 0] },
        itemPrice: { $ifNull: ['$items.price', 0] },
        itemCost: { $ifNull: [{ $arrayElemAt: ['$inventoryProduct.cost', 0] }, 0] },
      },
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: { $multiply: ['$itemPrice', '$itemQty'] } },
        cost: { $sum: { $multiply: ['$itemCost', '$itemQty'] } },
      },
    },
  ]).toArray()

  const revenue = Number(agg?.revenue || 0)
  const cost = Number(agg?.cost || 0)
  return { revenue, cost, profit: revenue - cost }
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = ((session.user as any).role ?? '').toUpperCase()
    const perms = normalizePermissions((session.user as any).permissions)
    if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'reports', 'view')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const format = (searchParams.get('format') || 'json').toLowerCase()

    const { start, end } = parseDateRange(startDate, endDate)
    const db = await getDatabase('infusion_jaba')

    const baseMatch = { status: 'completed', timestamp: { $gte: start, $lte: end } }

    const [summaryAgg] = await db
      .collection('orders')
      .aggregate<{ revenue: number; orders: number }>([
        { $match: baseMatch },
        { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
      ])
      .toArray()
    const summary: Summary = {
      revenue: summaryAgg?.revenue ?? 0,
      orders: summaryAgg?.orders ?? 0,
      avgOrderValue: summaryAgg?.orders ? (summaryAgg.revenue ?? 0) / summaryAgg.orders : 0,
    }

    const paymentBreakdown = await db
      .collection('orders')
      .aggregate<{ method: string; total: number; count: number }>([
        { $match: baseMatch },
        {
          $group: {
            _id: { $ifNull: ['$paymentMethod', 'unknown'] },
            total: { $sum: '$total' },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ])
      .toArray()
      .then((rows) =>
        rows.map((r: any) => ({
          method: String(r._id || 'unknown'),
          total: Number(r.total || 0),
          count: Number(r.count || 0),
        }))
      )

    const topProducts = await db
      .collection('orders')
      .aggregate<{ productId: string; name: string; revenue: number; quantity: number }>([
        { $match: baseMatch },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            name: { $first: '$items.name' },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
            quantity: { $sum: '$items.quantity' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ])
      .toArray()
      .then((rows) =>
        rows.map((r: any) => ({
          productId: String(r._id || ''),
          name: String(r.name || r._id || 'Unknown'),
          revenue: Number(r.revenue || 0),
          quantity: Number(r.quantity || 0),
        }))
      )

    const { weeklyStart, monthlyStart, yearlyStart, end: periodEnd } = getPeriodBoundaries(new Date())
    const [weekly, monthly, yearly] = await Promise.all([
      computeProfitForPeriod(db, weeklyStart, periodEnd),
      computeProfitForPeriod(db, monthlyStart, periodEnd),
      computeProfitForPeriod(db, yearlyStart, periodEnd),
    ])
    const profitSummary: ProfitSummary = { weekly, monthly, yearly }

    const shiftRows = await db
      .collection('staff_shifts')
      .find({ startedAt: { $gte: start, $lte: end } })
      .project({
        status: 1,
        scheduledEndAt: 1,
        endedAt: 1,
        metadata: 1,
      })
      .toArray()
    const shiftBreakdown = shiftRows.reduce(
      (acc, shift: any) => {
        const status = String(shift.status || '').toUpperCase()
        if (status === 'AUTO_CLOSED') {
          if (shift?.metadata?.autoClosedBySystem) acc.autoClockouts += 1
          else acc.manualManagerClose += 1
        } else if (['COMPLETED', 'FORGOT_CLOCK_OUT', 'EARLY_EXIT', 'OVERTIME'].includes(status)) {
          acc.normalClockouts += 1
        }
        if (shift?.metadata?.resumedAfterAutoClose) acc.continuedShifts += 1
        const endedAt = shift?.endedAt ? new Date(shift.endedAt).getTime() : 0
        const scheduledEndAt = shift?.scheduledEndAt ? new Date(shift.scheduledEndAt).getTime() : 0
        if (endedAt && scheduledEndAt && endedAt > scheduledEndAt) {
          acc.overtimeAfterScheduleMinutes += Math.max(0, Math.round((endedAt - scheduledEndAt) / 60000))
        }
        return acc
      },
      {
        normalClockouts: 0,
        manualManagerClose: 0,
        autoClockouts: 0,
        continuedShifts: 0,
        overtimeAfterScheduleMinutes: 0,
      }
    )

    if (format === 'csv') {
      const lines: string[] = []
      lines.push(`Report Range,${start.toISOString()},${end.toISOString()}`)
      lines.push(`Revenue,${summary.revenue}`)
      lines.push(`Orders,${summary.orders}`)
      lines.push(`Average Order Value,${summary.avgOrderValue}`)
      lines.push('')
      lines.push('Profit Summary (Buying vs Selling)')
      lines.push(`Weekly Profit,${profitSummary.weekly.profit}`)
      lines.push(`Monthly Profit,${profitSummary.monthly.profit}`)
      lines.push(`Yearly Profit,${profitSummary.yearly.profit}`)
      lines.push('')
      lines.push('Shift Closures')
      lines.push(`Normal Clockouts,${shiftBreakdown.normalClockouts}`)
      lines.push(`Manual Manager Close,${shiftBreakdown.manualManagerClose}`)
      lines.push(`Auto Clockouts,${shiftBreakdown.autoClockouts}`)
      lines.push(`Continued Shifts,${shiftBreakdown.continuedShifts}`)
      lines.push(`Overtime After Schedule (minutes),${shiftBreakdown.overtimeAfterScheduleMinutes}`)
      lines.push('')
      lines.push('Payment Method,Orders,Revenue')
      for (const p of paymentBreakdown) {
        lines.push(`"${p.method}",${p.count},${p.total}`)
      }
      lines.push('')
      lines.push('Top Products,Units,Revenue')
      for (const p of topProducts) {
        lines.push(`"${p.name}",${p.quantity},${p.revenue}`)
      }
      const csv = lines.join('\n')
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="catha-report-${start.toISOString().slice(0, 10)}-to-${end.toISOString().slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    return NextResponse.json(
      {
        success: true,
        range: { start: start.toISOString(), end: end.toISOString() },
        summary,
        profitSummary,
        paymentBreakdown,
        topProducts,
        shiftBreakdown,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error: any) {
    console.error('[Catha Reports API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load reports', message: error.message },
      { status: 500 }
    )
  }
}
