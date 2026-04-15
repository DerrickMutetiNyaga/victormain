import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// GET dashboard data
export async function GET(request: Request) {
  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    console.log('[Dashboard API] Fetching dashboard data...')

    // Helper function to normalize date to start of day
    const normalizeDate = (date: Date): Date => {
      const normalized = new Date(date)
      normalized.setHours(0, 0, 0, 0)
      return normalized
    }

    const now = new Date()
    const today = normalizeDate(now)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    // Get all batches
    const batches = await db.collection('jaba_batches')
      .find({})
      .sort({ date: -1, createdAt: -1 })
      .toArray()

    // Get all delivery notes
    const deliveryNotes = await db.collection('jaba_deliveryNotes')
      .find({})
      .sort({ date: -1, createdAt: -1 })
      .toArray()

    // Get all raw materials
    const rawMaterials = await db.collection('jaba_rawMaterials')
      .find({})
      .toArray()

    // Get all packaging outputs
    const packagingOutputs = await db.collection('jaba_packagingOutput')
      .find({})
      .toArray()

    console.log(`[Dashboard API] Found ${batches.length} batches, ${deliveryNotes.length} delivery notes, ${rawMaterials.length} raw materials`)

    // Calculate dashboard stats
    const totalBatches = batches.length
    
    // Batches this month
    const batchesThisMonth = batches.filter((b: any) => {
      const batchDate = b.date instanceof Date ? b.date : new Date(b.date)
      return batchDate >= thisMonthStart && batchDate < nextMonthStart
    }).length

    // Batches today
    const batchesToday = batches.filter((b: any) => {
      const batchDate = b.date instanceof Date ? b.date : new Date(b.date)
      const normalizedBatchDate = normalizeDate(batchDate)
      return normalizedBatchDate.getTime() === today.getTime()
    }).length

    // Total litres manufactured
    const totalLitresManufactured = batches.reduce((sum: number, b: any) => 
      sum + (parseFloat(b.totalLitres) || 0), 0
    )

    // Litres produced today
    const litresProducedToday = batches
      .filter((b: any) => {
        const batchDate = b.date instanceof Date ? b.date : new Date(b.date)
        const normalizedBatchDate = normalizeDate(batchDate)
        return normalizedBatchDate.getTime() === today.getTime()
      })
      .reduce((sum: number, b: any) => sum + (parseFloat(b.totalLitres) || 0), 0)

    // Batches in QC
    const batchesInQC = batches.filter((b: any) => 
      b.qcStatus === 'Pending' || b.qcStatus === 'In Progress' || b.status === 'QC Pending'
    ).length

    // Finished goods stock from packaging outputs
    let finishedGoodsStock500ml = 0
    let finishedGoodsStock1L = 0
    let finishedGoodsStock2L = 0
    let finishedGoodsStock250ml = 0

    packagingOutputs.forEach((po: any) => {
      if (po.containers && Array.isArray(po.containers)) {
        po.containers.forEach((container: any) => {
          const qty = parseFloat(container.quantity) || 0
          if (container.size === '250ml') {
            finishedGoodsStock250ml += qty
          } else if (container.size === '500ml') {
            finishedGoodsStock500ml += qty
          } else if (container.size === '1L') {
            finishedGoodsStock1L += qty
          } else if (container.size === '2L') {
            finishedGoodsStock2L += qty
          }
        })
      }
    })

    // Subtract only delivered quantities (items that have been delivered are no longer in stock)
    deliveryNotes
      .filter((note: any) => note.status === 'Delivered')
      .forEach((note: any) => {
        if (note.items && Array.isArray(note.items)) {
          note.items.forEach((item: any) => {
            const qty = parseFloat(item.quantity) || 0
            if (item.size === '250ml') {
              finishedGoodsStock250ml = Math.max(0, finishedGoodsStock250ml - qty)
            } else if (item.size === '500ml') {
              finishedGoodsStock500ml = Math.max(0, finishedGoodsStock500ml - qty)
            } else if (item.size === '1L') {
              finishedGoodsStock1L = Math.max(0, finishedGoodsStock1L - qty)
            } else if (item.size === '2L') {
              finishedGoodsStock2L = Math.max(0, finishedGoodsStock2L - qty)
            }
          })
        }
      })

    // Raw materials stats
    const currentRawMaterials = rawMaterials.length
    const lowStockMaterials = rawMaterials.filter((rm: any) => 
      (parseFloat(rm.currentStock) || 0) <= (parseFloat(rm.minStock) || 0)
    ).length

    // Distribution stats
    const pendingDistributions = deliveryNotes.filter((dn: any) => 
      dn.status === 'Pending'
    ).length
    const completedDistributions = deliveryNotes.filter((dn: any) => 
      dn.status === 'Delivered'
    ).length

    // Dashboard stats object
    const dashboardStats = {
      totalBatches,
      batchesThisMonth,
      batchesToday,
      totalLitresManufactured,
      litresProducedToday,
      batchesInQC,
      finishedGoodsStock: {
        '250ml': finishedGoodsStock250ml,
        '500ml': finishedGoodsStock500ml,
        '1L': finishedGoodsStock1L,
        '2L': finishedGoodsStock2L,
      },
      currentRawMaterials,
      lowStockMaterials,
      pendingDistributions,
      completedDistributions,
    }

    // Recent batches (last 8)
    const recentBatches = batches.slice(0, 8).map((batch: any) => ({
      id: batch._id.toString(),
      batchNumber: batch.batchNumber || '',
      flavor: batch.flavor || '',
      status: batch.status || 'Processing',
      totalLitres: parseFloat(batch.totalLitres) || 0,
      outputSummary: {
        totalBottles: (parseFloat(batch.bottles250ml) || 0) + 
                      (parseFloat(batch.bottles500ml) || 0) + 
                      (parseFloat(batch.bottles1L) || 0) + 
                      (parseFloat(batch.bottles2L) || 0),
        remainingLitres: parseFloat(batch.totalLitres) || 0,
        breakdown: [],
      },
      date: batch.date instanceof Date ? batch.date.toISOString() : batch.date,
    }))

    // Recent deliveries (last 5)
    const recentDeliveries = deliveryNotes.slice(0, 5).map((note: any) => ({
      id: note._id.toString(),
      distributorName: note.distributorName || '',
      batchNumber: note.batchNumber || '',
      items: note.items || [],
      driver: note.driver || 'N/A',
      date: note.date instanceof Date ? note.date.toISOString() : note.date,
    }))

    // Low stock materials
    const lowStockMaterialsList = rawMaterials
      .filter((rm: any) => (parseFloat(rm.currentStock) || 0) <= (parseFloat(rm.minStock) || 0))
      .slice(0, 5)
      .map((material: any) => ({
        id: material._id.toString(),
        name: material.name || '',
        currentStock: parseFloat(material.currentStock) || 0,
        unit: material.unit || '',
        minStock: parseFloat(material.minStock) || 0,
      }))

    // Daily production data (last 7 days)
    const dailyProductionData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today)
      date.setDate(date.getDate() - (6 - i))
      const normalizedDate = normalizeDate(date)
      
      const dayBatches = batches.filter((b: any) => {
        const batchDate = b.date instanceof Date ? b.date : new Date(b.date)
        const normalizedBatchDate = normalizeDate(batchDate)
        return normalizedBatchDate.getTime() === normalizedDate.getTime()
      })
      
      const litres = dayBatches.reduce((sum: number, b: any) => 
        sum + (parseFloat(b.totalLitres) || 0), 0
      )
      
      return {
        date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        litres,
        batches: dayBatches.length,
      }
    })

    // Weekly production summary
    const weeklyProductionData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today)
      date.setDate(date.getDate() - (6 - i))
      const normalizedDate = normalizeDate(date)
      
      const dayBatches = batches.filter((b: any) => {
        const batchDate = b.date instanceof Date ? b.date : new Date(b.date)
        const normalizedBatchDate = normalizeDate(batchDate)
        return normalizedBatchDate.getTime() === normalizedDate.getTime()
      })
      
      const litres = dayBatches.reduce((sum: number, b: any) => 
        sum + (parseFloat(b.totalLitres) || 0), 0
      )
      
      return {
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        litres,
        batches: dayBatches.length,
      }
    })

    // Material usage trends (last 7 days) - calculate from actual batch ingredients
    const materialUsageTrends = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today)
      date.setDate(date.getDate() - (6 - i))
      const normalizedDate = normalizeDate(date)
      
      const dayBatches = batches.filter((b: any) => {
        const batchDate = b.date instanceof Date ? b.date : new Date(b.date)
        const normalizedBatchDate = normalizeDate(batchDate)
        return normalizedBatchDate.getTime() === normalizedDate.getTime()
      })
      
      // Calculate actual usage from batch ingredients (no estimates - only real data)
      const usage = dayBatches.reduce((sum: number, batch: any) => {
        if (batch.ingredients && Array.isArray(batch.ingredients)) {
          const batchUsage = batch.ingredients.reduce((ingSum: number, ingredient: any) => {
            return ingSum + (parseFloat(ingredient.quantity) || 0)
          }, 0)
          return sum + batchUsage
        }
        return sum
      }, 0)
      
      return {
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        usage,
      }
    })

    // QC Pass/Fail data
    const qcPassed = batches.filter((b: any) => 
      b.qcStatus === 'Pass' || b.status === 'QC Passed - Ready for Packaging'
    ).length
    const qcFailed = batches.filter((b: any) => 
      b.qcStatus === 'Fail' || b.status === 'QC Failed'
    ).length
    const qcPending = batches.filter((b: any) => 
      b.qcStatus === 'Pending' || b.status === 'QC Pending'
    ).length

    const qcPassFailData = [
      { name: 'Pass', value: qcPassed, color: '#10b981' },
      { name: 'Fail', value: qcFailed, color: '#ef4444' },
      { name: 'Pending', value: qcPending, color: '#f59e0b' },
    ].filter(item => item.value > 0) // Only show categories with data

    // Weekly distribution data
    const weeklyDistributionData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today)
      date.setDate(date.getDate() - (6 - i))
      const normalizedDate = normalizeDate(date)
      
      const dayDeliveries = deliveryNotes.filter((dn: any) => {
        const deliveryDate = dn.date instanceof Date ? dn.date : new Date(dn.date)
        const normalizedDeliveryDate = normalizeDate(deliveryDate)
        return normalizedDeliveryDate.getTime() === normalizedDate.getTime()
      })
      
      const quantity = dayDeliveries.reduce((sum: number, dn: any) => {
        if (dn.items && Array.isArray(dn.items)) {
          return sum + dn.items.reduce((itemSum: number, item: any) => 
            itemSum + (parseFloat(item.quantity) || 0), 0
          )
        }
        return sum
      }, 0)
      
      return {
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        deliveries: dayDeliveries.length,
        quantity,
      }
    })

    console.log('[Dashboard API] ✅ Dashboard data prepared successfully')

    return NextResponse.json({
      dashboardStats,
      recentBatches,
      recentDeliveries,
      lowStockMaterials: lowStockMaterialsList,
      dailyProductionData,
      weeklyProductionData,
      materialUsageTrends,
      qcPassFailData,
      weeklyDistributionData,
    })
  } catch (error: any) {
    console.error('[Dashboard API] ❌ Error fetching dashboard data:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard data',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}
