import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

// GET export supplier history as Excel
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const supplierName = searchParams.get('supplier')

    if (!supplierName) {
      return NextResponse.json(
        { error: 'Supplier name is required' },
        { status: 400 }
      )
    }

    console.log('[Supplier History Export] Exporting history for:', supplierName)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    
    // Fetch supplier history
    const history = await db.collection('jaba_supplierHistory')
      .find({ supplierName: supplierName })
      .sort({ date: -1, _id: -1 })
      .toArray()

    console.log(`[Supplier History Export] Found ${history.length} history entries`)

    // Prepare data for Excel
    const excelData = history.length > 0 
      ? history.map(item => ({
          'Date': item.date instanceof Date 
            ? item.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            : item.date ? new Date(item.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A',
          'Item Name': item.itemName || 'N/A',
          'Quantity': item.quantity || 0,
          'Unit': item.unit || 'N/A',
          'Type': item.type || 'N/A',
          'Batch Number': item.batchNumber || 'N/A',
          'Lot Number': item.lotNumber || 'N/A',
          'Cost': item.cost ? `$${item.cost.toFixed(2)}` : 'N/A',
        }))
      : [{
          'Date': 'N/A',
          'Item Name': 'No history available',
          'Quantity': 0,
          'Unit': 'N/A',
          'Type': 'N/A',
          'Batch Number': 'N/A',
          'Lot Number': 'N/A',
          'Cost': 'N/A',
        }]

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    // Set column widths
    const colWidths = [
      { wch: 12 }, // Date
      { wch: 25 }, // Item Name
      { wch: 10 }, // Quantity
      { wch: 8 },  // Unit
      { wch: 12 }, // Type
      { wch: 15 }, // Batch Number
      { wch: 15 }, // Lot Number
      { wch: 12 }, // Cost
    ]
    ws['!cols'] = colWidths

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Supply History')

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Create filename with sanitized supplier name
    const sanitizedName = supplierName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const filename = `supplier_history_${sanitizedName}_${new Date().toISOString().split('T')[0]}.xlsx`

    // Return Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('[Supplier History Export] Error exporting history:', error)
    return NextResponse.json(
      { 
        error: 'Failed to export supplier history',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

