import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { requireCathaPermission } from '@/lib/auth-catha'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Category display names mapping
const categoryLabels: Record<string, string> = {
  whiskey: 'Whiskey',
  vodka: 'Vodka',
  rum: 'Rum',
  gin: 'Gin',
  beer: 'Beer',
  wine: 'Wine',
  cocktails: 'Cocktails',
  'soft-drinks': 'Soft Drinks',
  jaba: 'Jaba',
  other: 'Other',
}

export async function GET() {
  const { allowed, response } = await requireCathaPermission('system.dashboard', 'view')
  if (!allowed && response) return response
  try {
    const db = await getDatabase('infusion_jaba')

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - 7)

    // Fetch completed orders (status completed or paymentStatus PAID)
    const completedOrders = await db
      .collection('orders')
      .find({
        $or: [{ status: 'completed' }, { paymentStatus: 'PAID' }],
        timestamp: { $gte: weekStart },
      })
      .sort({ timestamp: -1 })
      .toArray()

    // Today's and yesterday's totals
    const todayOrders = completedOrders.filter((o: any) => {
      const t = o.timestamp instanceof Date ? o.timestamp : new Date(o.timestamp)
      return t >= todayStart
    })
    const yesterdayOrders = completedOrders.filter((o: any) => {
      const t = o.timestamp instanceof Date ? o.timestamp : new Date(o.timestamp)
      return t >= yesterdayStart && t < todayStart
    })

    const todaySales = todayOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)
    const yesterdaySales = yesterdayOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)
    const todayCount = todayOrders.length
    const yesterdayCount = yesterdayOrders.length

    // Percent change
    const salesChange = yesterdaySales > 0
      ? (((todaySales - yesterdaySales) / yesterdaySales) * 100).toFixed(1)
      : todaySales > 0 ? '100' : '0'
    const ordersChange = yesterdayCount > 0
      ? (((todayCount - yesterdayCount) / yesterdayCount) * 100).toFixed(1)
      : todayCount > 0 ? '100' : '0'

    // Hourly stats for today
    const hours = Array.from({ length: 24 }, (_, i) => {
      const h = String(i).padStart(2, '0')
      return { hour: `${h}:00`, sales: 0, orders: 0 }
    })
    for (const o of todayOrders) {
      const t = o.timestamp instanceof Date ? o.timestamp : new Date(o.timestamp)
      const h = t.getHours()
      hours[h].sales += o.total || 0
      hours[h].orders += 1
    }
    let hourlyStats = hours.filter((h) => h.sales > 0 || h.orders > 0)
    if (hourlyStats.length === 0) {
      const currentHour = now.getHours()
      hourlyStats = hours.slice(0, Math.max(currentHour + 1, 6))
    }

    // Weekly stats (last 7 days)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const weeklyMap: Record<string, { sales: number; orders: number }> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart)
      d.setDate(d.getDate() - i)
      weeklyMap[d.toISOString().slice(0, 10)] = { sales: 0, orders: 0 }
    }
    for (const o of completedOrders) {
      const t = o.timestamp instanceof Date ? o.timestamp : new Date(o.timestamp)
      const key = t.toISOString().slice(0, 10)
      if (weeklyMap[key]) {
        weeklyMap[key].sales += o.total || 0
        weeklyMap[key].orders += 1
      }
    }
    const weeklyData = Object.entries(weeklyMap).map(([date, v]) => ({
      day: dayNames[new Date(date).getDay()],
      sales: Math.round(v.sales * 100) / 100,
      orders: v.orders,
    }))

    // Top selling items from order items
    const itemSales: Record<string, { name: string; sales: number; quantity: number }> = {}
    for (const o of completedOrders) {
      for (const item of o.items || []) {
        const pid = item.productId || item._id || 'unknown'
        const name = item.name || 'Unknown'
        const qty = Number(item.quantity) || 0
        const price = Number(item.price) || 0
        const sales = qty * price
        if (!itemSales[pid]) {
          itemSales[pid] = { name, sales: 0, quantity: 0 }
        }
        itemSales[pid].sales += sales
        itemSales[pid].quantity += qty
      }
    }
    const topSellingItems = Object.entries(itemSales)
      .sort((a, b) => b[1].sales - a[1].sales)
      .slice(0, 5)
      .map(([id, v]) => ({ id, name: v.name, sales: Math.round(v.sales * 100) / 100, quantity: v.quantity }))

    // Category stats from order items - lookup category from inventory by productId or name
    const categorySales: Record<string, number> = {}
    const productsCacheById: Record<string, string> = {}
    const productsCacheByName: Record<string, string> = {}
    const invProducts = await db
      .collection('bar_inventory')
      .find({ type: 'bar' })
      .project({ _id: 1, name: 1, category: 1 })
      .toArray()
    for (const p of invProducts) {
      const cat = (p.category || 'other').toLowerCase()
      productsCacheById[p._id.toString()] = cat
      productsCacheByName[(p.name || '').toLowerCase().trim()] = cat
    }
    for (const o of completedOrders) {
      for (const item of o.items || []) {
        const pid = String(item.productId || item._id || '')
        const nameKey = (item.name || '').toLowerCase().trim()
        const cat = productsCacheById[pid] || productsCacheByName[nameKey] || 'other'
        const label = categoryLabels[cat] || (cat.charAt(0).toUpperCase() + cat.slice(1))
        const sales = (Number(item.quantity) || 0) * (Number(item.price) || 0)
        categorySales[label] = (categorySales[label] || 0) + sales
      }
    }
    const totalCategorySales = Object.values(categorySales).reduce((a, b) => a + b, 0)
    const categoryStats = Object.entries(categorySales)
      .map(([category, sales]) => ({
        category,
        sales: Math.round(sales * 100) / 100,
        percentage: totalCategorySales > 0 ? Math.round((sales / totalCategorySales) * 100) : 0,
      }))
      .sort((a, b) => b.sales - a.sales)

    // Recent transactions (last 5)
    const recentTransactions = completedOrders.slice(0, 5).map((o: any) => ({
      id: o.id,
      table: o.table ?? 0,
      total: o.total ?? 0,
      paymentMethod: o.paymentMethod ?? 'Cash',
      cashier: o.cashier ?? 'Staff',
      timestamp: o.timestamp instanceof Date ? o.timestamp : new Date(o.timestamp),
      status: o.status ?? 'completed',
    }))

    // Inventory stats
    const allProducts = await db
      .collection('bar_inventory')
      .find({ type: 'bar' })
      .project({ _id: 1, name: 1, category: 1, stock: 1, minStock: 1, image: 1 })
      .toArray()

    const totalStockUnits = allProducts.reduce((sum: number, p: any) => sum + (p.stock || 0), 0)
    const lowStockItems = allProducts
      .filter((p: any) => (p.stock || 0) <= (p.minStock || 0))
      .map((p: any) => ({
        id: p._id.toString(),
        name: p.name || 'Unknown',
        stock: p.stock || 0,
        minStock: p.minStock || 0,
        status: (p.stock || 0) <= (p.minStock || 0) / 2 ? 'warning' : 'low',
      }))
      .slice(0, 10)

    return NextResponse.json({
      success: true,
      stats: {
        todaySales: Math.round(todaySales * 100) / 100,
        yesterdaySales: Math.round(yesterdaySales * 100) / 100,
        todayOrders: todayCount,
        yesterdayOrders: yesterdayCount,
        salesChange: String(salesChange),
        ordersChange: String(ordersChange),
        totalStockUnits,
        lowStockCount: lowStockItems.length,
        totalProducts: allProducts.length,
      },
      hourlyStats: hourlyStats.length > 0 ? hourlyStats : [{ hour: '00:00', sales: 0, orders: 0 }],
      weeklyData,
      categoryStats: categoryStats.length > 0 ? categoryStats : [{ category: 'No sales', sales: 0, percentage: 0 }],
      topSellingItems,
      recentTransactions,
      lowStockItems,
      products: allProducts.map((p: any) => ({
        id: p._id.toString(),
        name: p.name,
        category: p.category,
        image: p.image,
      })),
    })
  } catch (error: any) {
    console.error('[Dashboard API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load dashboard data', message: error.message },
      { status: 500 }
    )
  }
}
