import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

// GET production reports Excel export
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const dateRange = searchParams.get('dateRange') || 'thisMonth'

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    // Get batches with same filter logic as main API
    const now = new Date()
    const normalizeDate = (date: Date): Date => {
      const normalized = new Date(date)
      normalized.setHours(0, 0, 0, 0)
      return normalized
    }

    let dateFilter: any = {}
    if (dateRange === 'today') {
      const today = normalizeDate(now)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      dateFilter = { date: { $gte: today, $lt: tomorrow } }
    } else if (dateRange === 'thisWeek') {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const weekStartNormalized = normalizeDate(weekStart)
      const weekEnd = new Date(weekStartNormalized)
      weekEnd.setDate(weekEnd.getDate() + 7)
      dateFilter = { date: { $gte: weekStartNormalized, $lt: weekEnd } }
    } else if (dateRange === 'thisMonth') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      dateFilter = { date: { $gte: monthStart, $lt: monthEnd } }
    } else if (dateRange === 'lastMonth') {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1)
      dateFilter = { date: { $gte: lastMonthStart, $lt: lastMonthEnd } }
    } else if (dateRange === 'last3Months') {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      dateFilter = { date: { $gte: threeMonthsAgo } }
    }

    const query: any = {}
    if (Object.keys(dateFilter).length > 0) {
      query.date = dateFilter.date
    }

    const batches = await db.collection('jaba_batches')
      .find(query)
      .sort({ date: -1, createdAt: -1 })
      .toArray()

    // Calculate statistics
    const totalBatches = batches.length
    const completedBatches = batches.filter((b: any) => 
      b.status === 'Completed' || b.status === 'Ready for Distribution'
    ).length
    const totalLitres = batches.reduce((sum: number, b: any) => 
      sum + (parseFloat(b.totalLitres) || 0), 0
    )
    const avgLitresPerBatch = totalBatches > 0 ? totalLitres / totalBatches : 0

    // Prepare data for Excel
    const excelData = batches.map((batch: any) => ({
      'Batch Number': batch.batchNumber || 'N/A',
      'Date': batch.date instanceof Date 
        ? batch.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : batch.date ? new Date(batch.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A',
      'Flavor': batch.flavor || 'Unknown',
      'Total Litres': parseFloat(batch.totalLitres) || 0,
      'Bottles 500ml': parseFloat(batch.bottles500ml) || 0,
      'Bottles 1L': parseFloat(batch.bottles1L) || 0,
      'Bottles 2L': parseFloat(batch.bottles2L) || 0,
      'Shift': batch.shift || 'N/A',
      'Status': batch.status || 'Processing',
      'QC Status': batch.qcStatus || 'Pending',
      'Supervisor': batch.supervisor || 'N/A',
      'Efficiency': batch.expectedLoss !== undefined 
        ? (100 - (parseFloat(batch.expectedLoss) || 0)).toFixed(1) + '%'
        : '95.0%',
    }))

    // Create workbook
    const wb = XLSX.utils.book_new()
    
    // Summary sheet
    const summaryData = [
      { Metric: 'Total Batches', Value: totalBatches },
      { Metric: 'Completed Batches', Value: completedBatches },
      { Metric: 'Total Litres', Value: totalLitres.toLocaleString() + 'L' },
      { Metric: 'Average Litres per Batch', Value: avgLitresPerBatch.toFixed(2) + 'L' },
      { Metric: 'Period', Value: period },
      { Metric: 'Date Range', Value: dateRange },
      { Metric: 'Generated', Value: new Date().toLocaleString() },
    ]
    const summaryWs = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

    // Batches sheet
    const batchesWs = XLSX.utils.json_to_sheet(excelData)
    
    // Set column widths
    const colWidths = [
      { wch: 18 }, // Batch Number
      { wch: 15 }, // Date
      { wch: 20 }, // Flavor
      { wch: 12 }, // Total Litres
      { wch: 12 }, // Bottles 500ml
      { wch: 10 }, // Bottles 1L
      { wch: 10 }, // Bottles 2L
      { wch: 12 }, // Shift
      { wch: 20 }, // Status
      { wch: 12 }, // QC Status
      { wch: 15 }, // Supervisor
      { wch: 12 }, // Efficiency
    ]
    batchesWs['!cols'] = colWidths
    
    XLSX.utils.book_append_sheet(wb, batchesWs, 'Production Batches')

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Create filename
    const filename = `production_report_${dateRange}_${new Date().toISOString().split('T')[0]}.xlsx`

    // Return Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('[Production Reports Excel Export] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to export Excel',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}
