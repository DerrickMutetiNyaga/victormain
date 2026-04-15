import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { requireSuperAdminApi } from '@/lib/catha-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [session, errResp] = await requireSuperAdminApi()
  if (errResp) return errResp

  try {
    const db = await getDatabase('infusion_jaba')
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [products, recentOrders] = await Promise.all([
      db.collection('bar_inventory').find({ type: 'bar', deleted: { $ne: true } }).project({ _id: 1, cost: 1, price: 1, stock: 1, minStock: 1 }).toArray(),
      db.collection('orders').find({ timestamp: { $gte: sevenDaysAgo } }).project({ _id: 1, status: 1, items: 1 }).toArray(),
    ])

    const weekProductSales: Record<string, number> = {}
    const completedOrders = recentOrders.filter((o: any) => o.status === 'completed' || (o as any).paymentStatus === 'PAID')
    for (const o of completedOrders) {
      for (const item of (o as any).items || []) {
        const pid = String(item.productId || item._id || '')
        weekProductSales[pid] = (weekProductSales[pid] || 0) + (Number(item.quantity) || 0)
      }
    }

    let criticalCount = 0
    const missingPrice = products.filter((p: any) => !p.price || p.price <= 0)
    if (missingPrice.length > 0) criticalCount++

    const lowStockHighDemand = products.filter((p: any) => {
      const isLow = (p.stock ?? 0) <= (p.minStock ?? 0) && (p.minStock ?? 0) > 0
      return isLow && (weekProductSales[p._id.toString()] || 0) > 0
    })
    if (lowStockHighDemand.length > 0) criticalCount++

    const outOfStock = products.filter((p: any) => (p.stock ?? 0) <= 0)
    if (outOfStock.length > 3) criticalCount++

    const cancelledOrders = recentOrders.filter((o: any) => o.status === 'cancelled' || o.status === 'voided')
    const cancelRate = recentOrders.length > 0 ? (cancelledOrders.length / recentOrders.length) * 100 : 0
    if (cancelRate > 10) criticalCount++

    const missingCost = products.filter((p: any) => !p.cost || p.cost <= 0)
    if (missingCost.length > products.length * 0.3) criticalCount++

    return NextResponse.json({ count: criticalCount })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
