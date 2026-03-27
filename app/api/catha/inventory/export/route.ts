import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import * as XLSX from 'xlsx'
import { requireCathaPermission } from '@/lib/auth-catha'

export const runtime = 'nodejs'

// GET export bar inventory as Excel
export async function GET(request: Request) {
  const { allowed, response } = await requireCathaPermission('inventory.inventory', 'view')
  if (!allowed && response) return response
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || 'all'
    const search = searchParams.get('search') || ''

    console.log('[Bar Inventory Export] Exporting inventory...')

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    
    // Build query
    const query: any = { type: 'bar' }
    
    if (category !== 'all') {
      query.category = category
    }
    
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { barcode: { $regex: search.trim(), $options: 'i' } },
      ]
    }
    
    // Fetch inventory items
    const products = await db.collection('bar_inventory')
      .find(query)
      .sort({ name: 1 })
      .toArray()

    console.log(`[Bar Inventory Export] Found ${products.length} products`)

    // Prepare data for Excel
    const excelData = products.length > 0 
      ? products.map(item => ({
          'Name': item.name || 'N/A',
          'Category': item.category || 'N/A',
          'Barcode': item.barcode || 'N/A',
          'Size': item.size || 'N/A',
          'Unit': item.unit || 'N/A',
          'Cost Price (Ksh)': item.cost || 0,
          'Selling Price (Ksh)': item.price || 0,
          'Stock': item.stock || 0,
          'Min Stock': item.minStock || 0,
          'Stock Status': (item.stock || 0) <= 0
            ? 'Out of Stock'
            : (item.stock || 0) <= (item.minStock || 0)
              ? 'Low Stock'
              : 'In Stock',
          'Total Cost Value (Ksh)': ((item.cost || 0) * (item.stock || 0)).toFixed(2),
          'Total Selling Value (Ksh)': ((item.price || 0) * (item.stock || 0)).toFixed(2),
          'Supplier': item.supplier || 'N/A',
          'Batch': item.batch || 'N/A',
          'Infusion': item.infusion || 'N/A',
          'Notes': item.notes || 'N/A',
          'Is Jaba Product': item.isJaba ? 'Yes' : 'No',
          'Last Updated': item.updatedAt 
            ? (item.updatedAt instanceof Date 
                ? item.updatedAt.toLocaleString('en-US')
                : new Date(item.updatedAt).toLocaleString('en-US'))
            : (item.createdAt 
                ? (item.createdAt instanceof Date 
                    ? item.createdAt.toLocaleString('en-US')
                    : new Date(item.createdAt).toLocaleString('en-US'))
                : 'N/A'),
        }))
      : [{
          'Name': 'No products found',
          'Category': 'N/A',
          'Barcode': 'N/A',
          'Size': 'N/A',
          'Unit': 'N/A',
          'Cost Price (Ksh)': 0,
          'Selling Price (Ksh)': 0,
          'Stock': 0,
          'Min Stock': 0,
          'Stock Status': 'N/A',
          'Total Cost Value (Ksh)': '0.00',
          'Total Selling Value (Ksh)': '0.00',
          'Supplier': 'N/A',
          'Batch': 'N/A',
          'Infusion': 'N/A',
          'Notes': 'N/A',
          'Is Jaba Product': 'N/A',
          'Last Updated': 'N/A',
        }]

    // Calculate summary stats
    const totalItems = products.length
    const totalStockValue = products.reduce((sum, p) => sum + (p.cost || 0) * (p.stock || 0), 0)
    const totalSellingValue = products.reduce((sum, p) => sum + (p.price || 0) * (p.stock || 0), 0)
    const totalStockUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0)
    const lowStockItems = products.filter((p) => (p.stock || 0) <= (p.minStock || 0)).length

    // Create workbook
    const wb = XLSX.utils.book_new()
    
    // Summary sheet
    const summaryData = [
      { Metric: 'Total Items', Value: totalItems },
      { Metric: 'Total Stock Units', Value: totalStockUnits },
      { Metric: 'Total Stock Value (Ksh)', Value: totalStockValue.toFixed(2) },
      { Metric: 'Total Selling Value (Ksh)', Value: totalSellingValue.toFixed(2) },
      { Metric: 'Low Stock Items', Value: lowStockItems },
      { Metric: 'Export Date', Value: new Date().toLocaleString('en-US') },
    ]
    const summaryWs = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

    // Inventory sheet
    const inventoryWs = XLSX.utils.json_to_sheet(excelData)
    
    // Set column widths
    const colWidths = [
      { wch: 25 }, // Name
      { wch: 15 }, // Category
      { wch: 15 }, // Barcode
      { wch: 10 }, // Size
      { wch: 10 }, // Unit
      { wch: 15 }, // Cost Price
      { wch: 15 }, // Selling Price
      { wch: 10 }, // Stock
      { wch: 12 }, // Min Stock
      { wch: 12 }, // Stock Status
      { wch: 18 }, // Total Cost Value
      { wch: 20 }, // Total Selling Value
      { wch: 20 }, // Supplier
      { wch: 15 }, // Batch
      { wch: 15 }, // Infusion
      { wch: 30 }, // Notes
      { wch: 15 }, // Is Jaba Product
      { wch: 20 }, // Last Updated
    ]
    inventoryWs['!cols'] = colWidths
    
    XLSX.utils.book_append_sheet(wb, inventoryWs, 'Inventory')

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Create filename
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `bar_inventory_${timestamp}.xlsx`

    console.log(`[Bar Inventory Export] ✅ Excel file generated: ${filename}`)

    // Return Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('[Bar Inventory Export] ❌ Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to export inventory',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

