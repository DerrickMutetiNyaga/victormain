import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// GET batch reports data
export async function GET(request: Request) {
  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    console.log('[Batch Reports API] Fetching batch reports data...')

    // Get all batches
    const batches = await db.collection('jaba_batches')
      .find({})
      .sort({ date: -1, createdAt: -1 })
      .toArray()

    console.log(`[Batch Reports API] Found ${batches.length} batches`)

    // Calculate statistics
    const totalBatches = batches.length
    const completedBatches = batches.filter((b: any) => 
      b.status === 'Completed' || b.status === 'Ready for Distribution'
    ).length
    const processingBatches = batches.filter((b: any) => 
      b.status === 'Processing' || b.status === 'Processed'
    ).length
    const qcPendingBatches = batches.filter((b: any) => 
      b.status === 'QC Pending'
    ).length
    const readyForDistributionBatches = batches.filter((b: any) => 
      b.status === 'Ready for Distribution'
    ).length

    // Total production volume
    const totalLitres = batches.reduce((sum: number, b: any) => 
      sum + (parseFloat(b.totalLitres) || 0), 0
    )

    // Total bottles produced
    const totalBottles = batches.reduce((sum: number, b: any) => {
      const bottles500ml = parseFloat(b.bottles500ml) || 0
      const bottles1L = parseFloat(b.bottles1L) || 0
      const bottles2L = parseFloat(b.bottles2L) || 0
      return sum + bottles500ml + bottles1L + bottles2L
    }, 0)

    // QC statistics
    const qcPassed = batches.filter((b: any) => 
      b.qcStatus === 'Pass' || b.status === 'QC Passed - Ready for Packaging'
    ).length
    const qcFailed = batches.filter((b: any) => 
      b.qcStatus === 'Fail' || b.status === 'QC Failed'
    ).length
    const qcPending = batches.filter((b: any) => 
      b.qcStatus === 'Pending' || b.status === 'QC Pending'
    ).length
    const qcPassRate = totalBatches > 0 
      ? ((qcPassed / (qcPassed + qcFailed)) * 100).toFixed(1)
      : '0'

    // Monthly production trend (last 6 months)
    const monthlyProduction: { month: string; batches: number; litres: number; bottles: number }[] = []
    const now = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' })
      
      let monthBatches = 0
      let monthLitres = 0
      let monthBottles = 0
      
      batches.forEach((batch: any) => {
        const batchDate = batch.date instanceof Date ? batch.date : new Date(batch.date)
        if (
          batchDate.getMonth() === monthDate.getMonth() &&
          batchDate.getFullYear() === monthDate.getFullYear()
        ) {
          monthBatches += 1
          monthLitres += parseFloat(batch.totalLitres) || 0
          monthBottles += (parseFloat(batch.bottles500ml) || 0) + 
                         (parseFloat(batch.bottles1L) || 0) + 
                         (parseFloat(batch.bottles2L) || 0)
        }
      })
      
      monthlyProduction.push({
        month: monthName,
        batches: monthBatches,
        litres: monthLitres,
        bottles: monthBottles,
      })
    }

    // Weekly production (last 4 weeks)
    // First, find the date range of all batches to determine which weeks to show
    const batchDates = batches
      .map((batch: any) => {
        if (batch.date instanceof Date) {
          return new Date(batch.date)
        } else if (typeof batch.date === 'string') {
          return new Date(batch.date)
        }
        return null
      })
      .filter((date: Date | null): date is Date => date !== null && !isNaN(date.getTime()))
    
    const minDate = batchDates.length > 0 ? new Date(Math.min(...batchDates.map(d => d.getTime()))) : now
    const maxDate = batchDates.length > 0 ? new Date(Math.max(...batchDates.map(d => d.getTime()))) : now
    
    // Helper function to normalize date to start of day (midnight)
    const normalizeDate = (date: Date): Date => {
      const normalized = new Date(date)
      normalized.setHours(0, 0, 0, 0)
      return normalized
    }
    
    // Helper function to get start of week (Sunday)
    const getWeekStart = (date: Date): Date => {
      const weekStart = new Date(date)
      const day = weekStart.getDay()
      weekStart.setDate(weekStart.getDate() - day)
      return normalizeDate(weekStart)
    }
    
    // Helper function to get end of week (Saturday)
    const getWeekEnd = (weekStart: Date): Date => {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)
      return weekEnd
    }
    
    // Get the most recent week that has batches, or use current week
    const referenceDate = maxDate > now ? maxDate : now
    const mostRecentWeekStart = getWeekStart(referenceDate)
    
    // Calculate last 4 weeks from the most recent week with batches
    const weeklyProduction: { date: string; batches: number; litres: number }[] = []
    
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(mostRecentWeekStart)
      weekStart.setDate(weekStart.getDate() - (i * 7))
      const weekEnd = getWeekEnd(weekStart)
      
      const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      
      const weekBatches = batches.filter((batch: any) => {
        let batchDate: Date
        if (batch.date instanceof Date) {
          batchDate = new Date(batch.date)
        } else if (typeof batch.date === 'string') {
          batchDate = new Date(batch.date)
          if (isNaN(batchDate.getTime())) {
            return false
          }
        } else {
          return false
        }
        
        const normalizedBatchDate = normalizeDate(batchDate)
        return normalizedBatchDate >= weekStart && normalizedBatchDate <= weekEnd
      })
      
      const weekLitres = weekBatches.reduce((sum: number, b: any) => 
        sum + (parseFloat(b.totalLitres) || 0), 0
      )
      
      weeklyProduction.push({
        date: weekLabel,
        batches: weekBatches.length,
        litres: weekLitres,
      })
    }

    // Status breakdown
    const statusData = [
      { status: 'Completed', count: completedBatches, color: '#10b981' },
      { status: 'Processing', count: processingBatches, color: '#3b82f6' },
      { status: 'QC Pending', count: qcPendingBatches, color: '#f59e0b' },
      { status: 'Ready for Distribution', count: readyForDistributionBatches, color: '#8b5cf6' },
    ]

    // Flavor distribution
    const flavorMap = new Map<string, { batches: number; litres: number; bottles: number }>()
    
    batches.forEach((batch: any) => {
      const flavor = batch.flavor || 'Unknown'
      const litres = parseFloat(batch.totalLitres) || 0
      const bottles = (parseFloat(batch.bottles500ml) || 0) + 
                     (parseFloat(batch.bottles1L) || 0) + 
                     (parseFloat(batch.bottles2L) || 0)
      
      const existing = flavorMap.get(flavor)
      if (existing) {
        existing.batches += 1
        existing.litres += litres
        existing.bottles += bottles
      } else {
        flavorMap.set(flavor, {
          batches: 1,
          litres,
          bottles,
        })
      }
    })

    const flavorDistribution = Array.from(flavorMap.entries())
      .map(([flavor, data]) => ({
        flavor,
        batches: data.batches,
        litres: data.litres,
        bottles: data.bottles,
      }))
      .sort((a, b) => b.batches - a.batches)

    // Top batches by volume
    const topBatches = batches
      .map((batch: any) => ({
        id: batch._id.toString(),
        batchNumber: batch.batchNumber || 'N/A',
        flavor: batch.flavor || 'Unknown',
        date: batch.date instanceof Date ? batch.date.toISOString() : batch.date,
        totalLitres: parseFloat(batch.totalLitres) || 0,
        bottles500ml: parseFloat(batch.bottles500ml) || 0,
        bottles1L: parseFloat(batch.bottles1L) || 0,
        bottles2L: parseFloat(batch.bottles2L) || 0,
        status: batch.status || 'Processing',
        qcStatus: batch.qcStatus || 'Pending',
        supervisor: batch.supervisor || 'N/A',
      }))
      .sort((a, b) => b.totalLitres - a.totalLitres)
      .slice(0, 10)

    // Recent batches
    const recentBatches = batches.slice(0, 20).map((batch: any) => ({
      id: batch._id.toString(),
      batchNumber: batch.batchNumber || 'N/A',
      flavor: batch.flavor || 'Unknown',
      date: batch.date instanceof Date ? batch.date.toISOString() : batch.date,
      totalLitres: parseFloat(batch.totalLitres) || 0,
      bottles500ml: parseFloat(batch.bottles500ml) || 0,
      bottles1L: parseFloat(batch.bottles1L) || 0,
      bottles2L: parseFloat(batch.bottles2L) || 0,
      status: batch.status || 'Processing',
      qcStatus: batch.qcStatus || 'Pending',
      supervisor: batch.supervisor || 'N/A',
      shift: batch.shift || 'N/A',
    }))

    // Production efficiency (average loss)
    const batchesWithLoss = batches.filter((b: any) => 
      b.expectedLoss !== undefined && b.actualLoss !== undefined
    )
    const avgLoss = batchesWithLoss.length > 0
      ? batchesWithLoss.reduce((sum: number, b: any) => 
          sum + (parseFloat(b.actualLoss) || 0) - (parseFloat(b.expectedLoss) || 0), 0
        ) / batchesWithLoss.length
      : 0

    // Shift distribution
    const shiftDistribution = {
      Morning: batches.filter((b: any) => b.shift === 'Morning').length,
      Afternoon: batches.filter((b: any) => b.shift === 'Afternoon').length,
      Night: batches.filter((b: any) => b.shift === 'Night').length,
    }

    console.log(`[Batch Reports API] ✅ Returning batch reports data`)

    return NextResponse.json({
      totalBatches,
      completedBatches,
      processingBatches,
      qcPendingBatches,
      readyForDistributionBatches,
      totalLitres,
      totalBottles,
      qcPassed,
      qcFailed,
      qcPending,
      qcPassRate,
      monthlyProduction,
      weeklyProduction,
      statusData,
      flavorDistribution,
      topBatches,
      recentBatches,
      avgLoss,
      shiftDistribution,
    })
  } catch (error: any) {
    console.error('[Batch Reports API] ❌ Error fetching batch reports:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch batch reports',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}
