import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth-catha'
import { getDatabase } from '@/lib/mongodb'
import { normalizePermissions, hasCathaPermission } from '@/lib/catha-permissions-model'

type Summary = {
  revenue: number
  orders: number
  avgOrderValue: number
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

    if (format === 'csv') {
      const lines: string[] = []
      lines.push(`Report Range,${start.toISOString()},${end.toISOString()}`)
      lines.push(`Revenue,${summary.revenue}`)
      lines.push(`Orders,${summary.orders}`)
      lines.push(`Average Order Value,${summary.avgOrderValue}`)
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
        paymentBreakdown,
        topProducts,
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
