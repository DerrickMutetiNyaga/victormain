import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// POST create new supplier history entry
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      supplierName,
      itemName,
      quantity,
      unit,
      date,
      type,
      batchNumber,
      lotNumber,
      cost,
    } = body

    // Validate required fields
    if (!supplierName || !itemName || !quantity || !unit || !date || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: supplierName, itemName, quantity, unit, date, and type are required' },
        { status: 400 }
      )
    }

    console.log('[Supplier History API] Creating new history entry for:', supplierName)

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    // Prepare history document
    const historyData = {
      supplierName: supplierName.trim(),
      itemName: itemName.trim(),
      quantity: Number(quantity),
      unit: unit.trim(),
      date: new Date(date),
      type: type.trim() as "Restock" | "Usage",
      batchNumber: batchNumber?.trim() || '',
      lotNumber: lotNumber?.trim() || '',
      cost: cost ? Number(cost) : undefined,
    }

    // Insert history
    const result = await db.collection('jaba_supplierHistory').insertOne(historyData)
    
    console.log(`[Supplier History API] ✅ History entry created successfully (ID: ${result.insertedId})`)

    return NextResponse.json(
      { 
        success: true,
        history: {
          ...historyData,
          _id: result.insertedId.toString(),
          id: result.insertedId.toString(),
        }
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[Supplier History API] ❌ Error creating history entry:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create supplier history entry',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// GET delivery history for a specific supplier
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

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    
    const history = await db.collection('jaba_supplierHistory')
      .find({ supplierName: supplierName })
      .sort({ date: -1, _id: -1 }) // Latest first
      .limit(1000) // Limit to prevent large queries
      .toArray()

    // Convert MongoDB IDs and dates
    const formattedHistory = history.map(item => ({
      ...item,
      id: item._id.toString(),
      _id: item._id.toString(),
      date: item.date instanceof Date 
        ? item.date.toISOString() 
        : item.date,
    }))

    return NextResponse.json({ history: formattedHistory })
  } catch (error: any) {
    console.error('[Supplier History API] Error fetching history:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch supplier history',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

