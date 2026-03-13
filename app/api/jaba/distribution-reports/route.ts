import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// GET distribution reports data
export async function GET(request: Request) {
  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    console.log('[Distribution Reports API] Fetching distribution reports data...')

    // Get all delivery notes
    const deliveryNotes = await db.collection('jaba_deliveryNotes')
      .find({})
      .sort({ date: -1, createdAt: -1 })
      .toArray()

    console.log(`[Distribution Reports API] Found ${deliveryNotes.length} delivery notes`)

    // Get all distributors
    const distributors = await db.collection('jaba_distributors')
      .find({})
      .toArray()

    console.log(`[Distribution Reports API] Found ${distributors.length} distributors`)

    // Calculate statistics
    const totalDeliveries = deliveryNotes.length
    const deliveredCount = deliveryNotes.filter((dn: any) => dn.status === 'Delivered').length
    const pendingCount = deliveryNotes.filter((dn: any) => dn.status === 'Pending').length
    const inTransitCount = deliveryNotes.filter((dn: any) => dn.status === 'In Transit').length

    // Total items delivered
    const totalItemsDelivered = deliveryNotes
      .filter((dn: any) => dn.status === 'Delivered')
      .reduce((sum: number, dn: any) => {
        if (dn.items && Array.isArray(dn.items)) {
          return sum + dn.items.reduce((itemSum: number, item: any) => itemSum + (parseFloat(item.quantity) || 0), 0)
        }
        return sum
      }, 0)

    // Distribution by distributor
    const distributorStatsMap = new Map<string, {
      name: string
      distributorId: string
      region: string
      totalDeliveries: number
      delivered: number
      totalItems: number
    }>()

    deliveryNotes.forEach((note: any) => {
      const distId = note.distributorId || ''
      const distName = note.distributorName || 'Unknown'
      
      // Find distributor to get region
      const distributor = distributors.find((d: any) => 
        (d._id?.toString() === distId) || (d.name === distName)
      )

      const existing = distributorStatsMap.get(distId || distName)
      const itemCount = note.items && Array.isArray(note.items)
        ? note.items.reduce((sum: number, item: any) => sum + (parseFloat(item.quantity) || 0), 0)
        : 0

      if (existing) {
        existing.totalDeliveries += 1
        if (note.status === 'Delivered') {
          existing.delivered += 1
        }
        existing.totalItems += itemCount
      } else {
        distributorStatsMap.set(distId || distName, {
          name: distName,
          distributorId: distId,
          region: distributor?.region || distributor?.address || 'N/A',
          totalDeliveries: 1,
          delivered: note.status === 'Delivered' ? 1 : 0,
          totalItems: itemCount,
        })
      }
    })

    const distributorStats = Array.from(distributorStatsMap.values())
      .sort((a, b) => b.totalItems - a.totalItems)

    // Calculate active distributors (distributors with at least one delivery)
    const activeDistributors = distributorStats.length

    // Calculate delivery rate (percentage of delivered vs total)
    const deliveryRate = totalDeliveries > 0 
      ? (deliveredCount / totalDeliveries) * 100 
      : 0

    // Monthly distribution trend (last 6 months)
    const monthlyDistribution: { month: string; deliveries: number; items: number }[] = []
    const now = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' })
      
      let monthDeliveries = 0
      let monthItems = 0
      
      deliveryNotes.forEach((note: any) => {
        const noteDate = note.date instanceof Date ? note.date : new Date(note.date)
        if (
          noteDate.getMonth() === monthDate.getMonth() &&
          noteDate.getFullYear() === monthDate.getFullYear()
        ) {
          monthDeliveries += 1
          if (note.items && Array.isArray(note.items)) {
            monthItems += note.items.reduce((sum: number, item: any) => 
              sum + (parseFloat(item.quantity) || 0), 0
            )
          }
        }
      })
      
      monthlyDistribution.push({
        month: monthName,
        deliveries: monthDeliveries,
        items: monthItems,
      })
    }

    // Weekly distribution (last 4 weeks)
    const weeklyDistribution: { date: string; deliveries: number }[] = []
    for (let i = 3; i >= 0; i--) {
      const weekDate = new Date(now)
      weekDate.setDate(weekDate.getDate() - (i * 7))
      const weekLabel = weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      
      const weekStart = new Date(weekDate)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      
      const weekDeliveries = deliveryNotes.filter((note: any) => {
        const noteDate = note.date instanceof Date ? note.date : new Date(note.date)
        return noteDate >= weekStart && noteDate <= weekEnd
      }).length
      
      weeklyDistribution.push({
        date: weekLabel,
        deliveries: weekDeliveries,
      })
    }

    // Distribution by status
    const statusData = [
      { status: 'Delivered', count: deliveredCount, color: '#10b981' },
      { status: 'In Transit', count: inTransitCount, color: '#ef4444' },
      { status: 'Pending', count: pendingCount, color: '#f59e0b' },
    ]

    // Top distributors by volume
    const topDistributors = distributorStats.slice(0, 10)

    // Recent deliveries
    const recentDeliveries = deliveryNotes.slice(0, 20).map((note: any) => ({
      id: note._id.toString(),
      noteId: note.noteId || '',
      distributorName: note.distributorName || 'Unknown',
      batchNumber: note.items && note.items.length > 0 ? note.items[0].batchNumber : 'N/A',
      date: note.date instanceof Date ? note.date.toISOString() : note.date,
      items: note.items || [],
      driver: note.driver || 'N/A',
      status: note.status || 'Pending',
    }))

    // Delivery performance by region
    const regionPerformanceMap = new Map<string, { deliveries: number; items: number }>()
    
    distributorStats.forEach((dist) => {
      const existing = regionPerformanceMap.get(dist.region)
      if (existing) {
        existing.deliveries += dist.delivered
        existing.items += dist.totalItems
      } else {
        regionPerformanceMap.set(dist.region, {
          deliveries: dist.delivered,
          items: dist.totalItems,
        })
      }
    })

    const regionPerformance = Array.from(regionPerformanceMap.entries()).map(([region, data]) => ({
      region,
      deliveries: data.deliveries,
      items: data.items,
    }))

    console.log(`[Distribution Reports API] ✅ Returning distribution reports data`)

    return NextResponse.json({
      totalDeliveries,
      deliveredCount,
      pendingCount,
      inTransitCount,
      totalItemsDelivered,
      deliveryRate,
      activeDistributors,
      totalDistributors: distributors.length,
      monthlyDistribution,
      weeklyDistribution,
      statusData,
      topDistributors,
      recentDeliveries,
      regionPerformance,
    })
  } catch (error: any) {
    console.error('[Distribution Reports API] ❌ Error fetching distribution reports:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch distribution reports',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}
