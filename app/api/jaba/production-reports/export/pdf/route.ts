import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// GET production reports PDF export
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

    // Generate simple PDF content (HTML format that can be converted to PDF)
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Production Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f3f4f6; }
    .summary { display: flex; gap: 20px; margin: 20px 0; }
    .summary-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
  </style>
</head>
<body>
  <h1>Production Report</h1>
  <p><strong>Period:</strong> ${period} | <strong>Date Range:</strong> ${dateRange}</p>
  <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
  
  <div class="summary">
    <div class="summary-card">
      <h3>Total Batches</h3>
      <p style="font-size: 24px; font-weight: bold;">${totalBatches}</p>
    </div>
    <div class="summary-card">
      <h3>Completed Batches</h3>
      <p style="font-size: 24px; font-weight: bold;">${completedBatches}</p>
    </div>
    <div class="summary-card">
      <h3>Total Litres</h3>
      <p style="font-size: 24px; font-weight: bold;">${totalLitres.toLocaleString()}L</p>
    </div>
  </div>

  <h2>Recent Batches</h2>
  <table>
    <thead>
      <tr>
        <th>Batch Number</th>
        <th>Date</th>
        <th>Flavor</th>
        <th>Litres</th>
        <th>Shift</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${batches.slice(0, 50).map((batch: any) => `
        <tr>
          <td>${batch.batchNumber || 'N/A'}</td>
          <td>${batch.date instanceof Date ? batch.date.toLocaleDateString() : new Date(batch.date).toLocaleDateString()}</td>
          <td>${batch.flavor || 'Unknown'}</td>
          <td>${(parseFloat(batch.totalLitres) || 0).toLocaleString()}L</td>
          <td>${batch.shift || 'N/A'}</td>
          <td>${batch.status || 'Processing'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>
    `

    // Return HTML that can be printed as PDF
    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="production_report_${dateRange}_${new Date().toISOString().split('T')[0]}.html"`,
      },
    })
  } catch (error: any) {
    console.error('[Production Reports PDF Export] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to export PDF',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}
