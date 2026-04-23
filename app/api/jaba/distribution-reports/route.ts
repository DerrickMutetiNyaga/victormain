import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// GET distribution reports data
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'month').toLowerCase()
    const statusFilter = searchParams.get('status') || 'all'

    const now = new Date()
    const periodStart = new Date(now)
    if (period === 'week') {
      periodStart.setDate(now.getDate() - 7)
    } else if (period === 'quarter') {
      periodStart.setDate(now.getDate() - 90)
    } else {
      periodStart.setDate(now.getDate() - 30)
    }

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

    const filteredNotes = deliveryNotes.filter((note: any) => {
      const noteDate = note.date instanceof Date ? note.date : new Date(note.date)
      const withinPeriod = noteDate >= periodStart && noteDate <= now
      const matchesStatus = statusFilter === 'all' || note.status === statusFilter
      return withinPeriod && matchesStatus
    })

    // Calculate statistics
    const totalDeliveries = filteredNotes.length
    const deliveredCount = filteredNotes.filter((dn: any) => dn.status === 'Delivered').length
    const pendingCount = filteredNotes.filter((dn: any) => dn.status === 'Pending').length
    const inTransitCount = filteredNotes.filter((dn: any) => dn.status === 'In Transit').length
    const totalAmountInvoiced = filteredNotes.reduce(
      (sum: number, dn: any) => sum + (Number(dn.totalCost) || 0),
      0
    )
    const totalAmountCollected = filteredNotes.reduce((sum: number, dn: any) => {
      const noteTotal = Number(dn.totalCost) || 0
      const paidAmount = Number(dn.paymentAmount)
      if (Number.isFinite(paidAmount) && paidAmount > 0) {
        return sum + Math.min(paidAmount, noteTotal)
      }
      if (dn.paymentStatus === 'Paid') return sum + noteTotal
      return sum
    }, 0)
    const outstandingAmount = filteredNotes.reduce((sum: number, dn: any) => {
      const noteTotal = Number(dn.totalCost) || 0
      const paidAmount = Number(dn.paymentAmount)
      const collectedForNote =
        Number.isFinite(paidAmount) && paidAmount > 0
          ? Math.min(paidAmount, noteTotal)
          : dn.paymentStatus === 'Paid'
            ? noteTotal
            : 0
      return sum + Math.max(0, noteTotal - collectedForNote)
    }, 0)
    const paymentCollectionRate = totalAmountInvoiced > 0
      ? (totalAmountCollected / totalAmountInvoiced) * 100
      : 0

    // Total items delivered
    const totalItemsDelivered = filteredNotes
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
      totalInvoiced: number
      totalCollected: number
      outstanding: number
    }>()

    filteredNotes.forEach((note: any) => {
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
      const noteTotal = Number(note.totalCost) || 0
      const paidAmount = Number(note.paymentAmount)
      const collectedForNote =
        Number.isFinite(paidAmount) && paidAmount > 0
          ? Math.min(paidAmount, noteTotal)
          : note.paymentStatus === 'Paid'
            ? noteTotal
            : 0
      const outstandingForNote = Math.max(0, noteTotal - collectedForNote)

      if (existing) {
        existing.totalDeliveries += 1
        if (note.status === 'Delivered') {
          existing.delivered += 1
        }
        existing.totalItems += itemCount
        existing.totalInvoiced += noteTotal
        existing.totalCollected += collectedForNote
        existing.outstanding += outstandingForNote
      } else {
        distributorStatsMap.set(distId || distName, {
          name: distName,
          distributorId: distId,
          region: distributor?.region || distributor?.address || 'N/A',
          totalDeliveries: 1,
          delivered: note.status === 'Delivered' ? 1 : 0,
          totalItems: itemCount,
          totalInvoiced: noteTotal,
          totalCollected: collectedForNote,
          outstanding: outstandingForNote,
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

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' })
      
      let monthDeliveries = 0
      let monthItems = 0
      
      filteredNotes.forEach((note: any) => {
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
      
      const weekDeliveries = filteredNotes.filter((note: any) => {
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
    const topDistributors = distributorStats.slice(0, 10).map((dist) => ({
      ...dist,
      collectionRate: dist.totalInvoiced > 0 ? (dist.totalCollected / dist.totalInvoiced) * 100 : 0,
    }))

    // Recent deliveries
    const recentDeliveries = filteredNotes.slice(0, 30).map((note: any) => {
      const noteTotal = Number(note.totalCost) || 0
      const paidAmount = Number(note.paymentAmount)
      const collectedForNote =
        Number.isFinite(paidAmount) && paidAmount > 0
          ? Math.min(paidAmount, noteTotal)
          : note.paymentStatus === 'Paid'
            ? noteTotal
            : 0
      return {
      id: note._id.toString(),
      noteId: note.noteId || '',
      distributorName: note.distributorName || 'Unknown',
      batchNumber: note.items && note.items.length > 0 ? note.items[0].batchNumber : 'N/A',
      date: note.date instanceof Date ? note.date.toISOString() : note.date,
      items: note.items || [],
      driver: note.driver || 'N/A',
      vehicle: note.vehicle || 'N/A',
      paymentStatus: note.paymentStatus || 'Unpaid',
      paymentAmount: collectedForNote,
      paymentReason: note.paymentReason || '',
      totalCost: noteTotal,
      remainingAmount: Math.max(0, noteTotal - collectedForNote),
      status: note.status || 'Pending',
      }
    })

    const paymentStatusData = [
      { status: 'Paid', count: filteredNotes.filter((note: any) => note.paymentStatus === 'Paid').length, color: '#10b981' },
      { status: 'Partial', count: filteredNotes.filter((note: any) => note.paymentStatus === 'Partial').length, color: '#f59e0b' },
      { status: 'Unpaid', count: filteredNotes.filter((note: any) => !note.paymentStatus || note.paymentStatus === 'Unpaid').length, color: '#ef4444' },
    ]

    const agingBuckets = [
      { bucket: '0-7 days', amount: 0, count: 0 },
      { bucket: '8-30 days', amount: 0, count: 0 },
      { bucket: '31-60 days', amount: 0, count: 0 },
      { bucket: '60+ days', amount: 0, count: 0 },
    ]
    filteredNotes.forEach((note: any) => {
      const noteDate = note.date instanceof Date ? note.date : new Date(note.date)
      const noteTotal = Number(note.totalCost) || 0
      const paidAmount = Number(note.paymentAmount)
      const collectedForNote =
        Number.isFinite(paidAmount) && paidAmount > 0
          ? Math.min(paidAmount, noteTotal)
          : note.paymentStatus === 'Paid'
            ? noteTotal
            : 0
      const remaining = Math.max(0, noteTotal - collectedForNote)
      if (remaining <= 0) return
      const ageDays = Math.floor((now.getTime() - noteDate.getTime()) / (24 * 60 * 60 * 1000))
      const index = ageDays <= 7 ? 0 : ageDays <= 30 ? 1 : ageDays <= 60 ? 2 : 3
      agingBuckets[index].amount += remaining
      agingBuckets[index].count += 1
    })

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
      totalAmountInvoiced,
      totalAmountCollected,
      outstandingAmount,
      paymentCollectionRate,
      totalItemsDelivered,
      deliveryRate,
      activeDistributors,
      totalDistributors: distributors.length,
      period,
      statusFilter,
      monthlyDistribution,
      weeklyDistribution,
      statusData,
      paymentStatusData,
      agingBuckets,
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
