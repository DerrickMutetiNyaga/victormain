import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

// GET export distributor history as Excel
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const distributorName = searchParams.get('distributor')

    if (!distributorName) {
      return NextResponse.json(
        { error: 'Distributor name is required' },
        { status: 400 }
      )
    }

    console.log('[Distributor History Export] Exporting history for:', distributorName)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    
    const history = await db.collection('jaba_distributorHistory')
      .find({ distributorName: distributorName })
      .sort({ date: -1, _id: -1 })
      .toArray()

    console.log(`[Distributor History Export] Found ${history.length} history entries`)

    // Prepare data for Excel
    const excelData = history.map(item => {
      const itemsStr = item.items?.map((i: any) => `${i.size}: ${i.quantity}`).join(', ') || 'N/A'
      
      return {
        'Date': item.date instanceof Date 
          ? item.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          : item.date ? new Date(item.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A',
        'Note ID': item.noteId || 'N/A',
        'Batch Number': item.batchNumber || 'N/A',
        'Items': itemsStr,
        'Status': item.status || 'N/A',
        'Vehicle': item.vehicle || 'N/A',
        'Driver': item.driver || 'N/A',
        'Delivery Location': item.deliveryLocation || 'N/A',
        'Time Out': item.timeOut instanceof Date 
          ? item.timeOut.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : item.timeOut ? new Date(item.timeOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        'Time Delivered': item.timeDelivered instanceof Date 
          ? item.timeDelivered.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : item.timeDelivered ? new Date(item.timeDelivered).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
      }
    })

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    // Set column widths
    const colWidths = [
      { wch: 12 }, // Date
      { wch: 15 }, // Note ID
      { wch: 15 }, // Batch Number
      { wch: 30 }, // Items
      { wch: 12 }, // Status
      { wch: 12 }, // Vehicle
      { wch: 15 }, // Driver
      { wch: 40 }, // Delivery Location
      { wch: 12 }, // Time Out
      { wch: 15 }, // Time Delivered
    ]
    ws['!cols'] = colWidths

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Delivery History')

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Create filename with sanitized distributor name
    const sanitizedName = distributorName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const filename = `distributor_history_${sanitizedName}_${new Date().toISOString().split('T')[0]}.xlsx`

    // Return Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('[Distributor History Export] Error exporting history:', error)
    return NextResponse.json(
      { 
        error: 'Failed to export distributor history',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

