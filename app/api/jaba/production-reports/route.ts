import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// GET production reports data
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const dateRange = searchParams.get('dateRange') || 'thisMonth'

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    console.log('[Production Reports API] Fetching production reports data...', { period, dateRange })

    // Helper function to normalize date to start of day
    const normalizeDate = (date: Date): Date => {
      const normalized = new Date(date)
      normalized.setHours(0, 0, 0, 0)
      return normalized
    }

    // Calculate date range filter
    const now = new Date()
    let dateFilter: any = {}
    
    if (dateRange === 'today') {
      const today = normalizeDate(now)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      dateFilter = {
        date: {
          $gte: today,
          $lt: tomorrow
        }
      }
    } else if (dateRange === 'thisWeek') {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const weekStartNormalized = normalizeDate(weekStart)
      const weekEnd = new Date(weekStartNormalized)
      weekEnd.setDate(weekEnd.getDate() + 7)
      dateFilter = {
        date: {
          $gte: weekStartNormalized,
          $lt: weekEnd
        }
      }
    } else if (dateRange === 'thisMonth') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      dateFilter = {
        date: {
          $gte: monthStart,
          $lt: monthEnd
        }
      }
    } else if (dateRange === 'lastMonth') {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1)
      dateFilter = {
        date: {
          $gte: lastMonthStart,
          $lt: lastMonthEnd
        }
      }
    } else if (dateRange === 'last3Months') {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      dateFilter = {
        date: {
          $gte: threeMonthsAgo
        }
      }
    }
    // For 'custom' or 'all', no date filter is applied

    // Get batches with date filter
    const query: any = {}
    if (Object.keys(dateFilter).length > 0) {
      query.date = dateFilter.date
    }

    const batches = await db.collection('jaba_batches')
      .find(query)
      .sort({ date: -1, createdAt: -1 })
      .toArray()

    console.log(`[Production Reports API] Found ${batches.length} batches`)

    // Calculate statistics
    const totalBatches = batches.length
    const completedBatches = batches.filter((b: any) => 
      b.status === 'Completed' || b.status === 'Ready for Distribution'
    ).length
    const totalLitres = batches.reduce((sum: number, b: any) => 
      sum + (parseFloat(b.totalLitres) || 0), 0
    )
    const avgLitresPerBatch = totalBatches > 0 ? totalLitres / totalBatches : 0
    const completionRate = totalBatches > 0 ? (completedBatches / totalBatches) * 100 : 0

    // Calculate average efficiency (based on loss) - only use real data, no defaults
    const batchesWithLoss = batches.filter((b: any) => 
      b.expectedLoss !== undefined && b.actualLoss !== undefined
    )
    const avgEfficiency = batchesWithLoss.length > 0
      ? batchesWithLoss.reduce((sum: number, b: any) => {
          const expectedLoss = parseFloat(b.expectedLoss) || 0
          const efficiency = 100 - expectedLoss
          return sum + efficiency
        }, 0) / batchesWithLoss.length
      : 0 // No default - show 0 if no real data

    // Monthly production trend (last 6 months)
    const monthlyProduction: { month: string; batches: number; litres: number; efficiency: number }[] = []
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' })
      
      let monthBatches = 0
      let monthLitres = 0
      let monthEfficiencySum = 0
      let monthEfficiencyCount = 0
      
      batches.forEach((batch: any) => {
        const batchDate = batch.date instanceof Date ? batch.date : new Date(batch.date)
        if (
          batchDate.getMonth() === monthDate.getMonth() &&
          batchDate.getFullYear() === monthDate.getFullYear()
        ) {
          monthBatches += 1
          monthLitres += parseFloat(batch.totalLitres) || 0
          
          if (batch.expectedLoss !== undefined) {
            const efficiency = 100 - (parseFloat(batch.expectedLoss) || 0)
            monthEfficiencySum += efficiency
            monthEfficiencyCount += 1
          }
        }
      })
      
      const monthEfficiency = monthEfficiencyCount > 0 
        ? monthEfficiencySum / monthEfficiencyCount 
        : 0 // No default - show 0 if no real data
      
      monthlyProduction.push({
        month: monthName,
        batches: monthBatches,
        litres: monthLitres,
        efficiency: monthEfficiency,
      })
    }

    // Weekly production (last 7 days or based on period)
    const weeklyProduction: { day: string; litres: number; batches: number }[] = []
    
    // Get the date range of all batches
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
    
    const maxDate = batchDates.length > 0 ? new Date(Math.max(...batchDates.map(d => d.getTime()))) : now
    const referenceDate = maxDate > now ? maxDate : now
    
    // Determine number of days based on period
    const daysToShow = period === 'day' ? 7 : period === 'week' ? 7 : period === 'month' ? 30 : 7
    
    // Get last N days based on period
    for (let i = daysToShow - 1; i >= 0; i--) {
      const dayDate = new Date(referenceDate)
      dayDate.setDate(dayDate.getDate() - i)
      const dayLabel = dayDate.toLocaleDateString('en-US', { weekday: 'short' })
      const dayStart = normalizeDate(dayDate)
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)
      
      const dayBatches = batches.filter((batch: any) => {
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
        return normalizedBatchDate >= dayStart && normalizedBatchDate <= dayEnd
      })
      
      const dayLitres = dayBatches.reduce((sum: number, b: any) => 
        sum + (parseFloat(b.totalLitres) || 0), 0
      )
      
      weeklyProduction.push({
        day: dayLabel,
        litres: dayLitres,
        batches: dayBatches.length,
      })
    }

    // Production by shift
    const shiftData = [
      {
        shift: 'Morning',
        batches: batches.filter((b: any) => b.shift === 'Morning').length,
        litres: batches.filter((b: any) => b.shift === 'Morning').reduce((sum: number, b: any) => 
          sum + (parseFloat(b.totalLitres) || 0), 0
        ),
      },
      {
        shift: 'Afternoon',
        batches: batches.filter((b: any) => b.shift === 'Afternoon').length,
        litres: batches.filter((b: any) => b.shift === 'Afternoon').reduce((sum: number, b: any) => 
          sum + (parseFloat(b.totalLitres) || 0), 0
        ),
      },
      {
        shift: 'Night',
        batches: batches.filter((b: any) => b.shift === 'Night').length,
        litres: batches.filter((b: any) => b.shift === 'Night').reduce((sum: number, b: any) => 
          sum + (parseFloat(b.totalLitres) || 0), 0
        ),
      },
    ]

    // Production by flavor (top 10)
    const flavorMap = new Map<string, { batches: number; litres: number }>()
    
    batches.forEach((batch: any) => {
      const flavor = batch.flavor || 'Unknown'
      const litres = parseFloat(batch.totalLitres) || 0
      
      const existing = flavorMap.get(flavor)
      if (existing) {
        existing.batches += 1
        existing.litres += litres
      } else {
        flavorMap.set(flavor, {
          batches: 1,
          litres,
        })
      }
    })

    const flavorData = Array.from(flavorMap.entries())
      .map(([flavor, data]) => ({
        flavor,
        batches: data.batches,
        litres: data.litres,
      }))
      .sort((a, b) => b.litres - a.litres)
      .slice(0, 10)

    // Recent production batches
    const recentBatches = batches.slice(0, 15).map((batch: any) => ({
      id: batch._id.toString(),
      batchNumber: batch.batchNumber || 'N/A',
      flavor: batch.flavor || 'Unknown',
      date: batch.date instanceof Date ? batch.date.toISOString() : batch.date,
      totalLitres: parseFloat(batch.totalLitres) || 0,
      shift: batch.shift || 'N/A',
      status: batch.status || 'Processing',
      expectedLoss: parseFloat(batch.expectedLoss) || 0,
      efficiency: batch.expectedLoss !== undefined 
        ? (100 - (parseFloat(batch.expectedLoss) || 0)).toFixed(1)
        : '0.0', // No default - show 0 if no real data
    }))

    console.log(`[Production Reports API] ✅ Returning production reports data`)

    return NextResponse.json({
      totalBatches,
      completedBatches,
      totalLitres,
      avgLitresPerBatch,
      completionRate,
      avgEfficiency,
      monthlyProduction,
      weeklyProduction,
      shiftData,
      flavorData,
      recentBatches,
    })
  } catch (error: any) {
    console.error('[Production Reports API] ❌ Error fetching production reports:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch production reports',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}
