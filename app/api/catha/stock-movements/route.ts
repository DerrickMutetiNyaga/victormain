import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireCathaPermission } from '@/lib/auth-catha'

export const runtime = 'nodejs'

// GET all bar stock movements
export async function GET(request: Request) {
  const { allowed, response } = await requireCathaPermission('inventory.stockMovement', 'view')
  if (!allowed && response) return response
  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const reason = searchParams.get('reason')
    const productId = searchParams.get('productId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query: any = { type: 'bar' } // Only get bar stock movements

    if (type && type !== 'all') {
      query.movementType = type
    }

    if (reason && reason !== 'all') {
      query.reason = reason
    }

    if (productId) {
      query.productId = productId
    }

    if (startDate || endDate) {
      query.date = {}
      if (startDate) {
        query.date.$gte = new Date(startDate)
      }
      if (endDate) {
        query.date.$lte = new Date(endDate)
      }
    }

    const movements = await db.collection('bar_stock_movements')
      .find(query)
      .sort({ date: -1, createdAt: -1 })
      .toArray()

    return NextResponse.json({
      success: true,
      movements: movements.map((m: any) => ({
        ...m,
        _id: m._id.toString(),
        id: m._id.toString(),
        date: m.date instanceof Date ? m.date.toISOString() : m.date,
      })),
    })
  } catch (error: any) {
    console.error('[Bar Stock Movements API] ❌ Error fetching movements:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch stock movements',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// POST create new bar stock movement
export async function POST(request: Request) {
  const { allowed, response } = await requireCathaPermission('inventory.stockMovement', 'create')
  if (!allowed && response) return response
  try {
    const body = await request.json()
    const {
      productId,
      productName,
      movementType,
      reason,
      quantity,
      previousStock,
      newStock,
      supplier,
      reference,
      notes,
      userId,
      userName,
    } = body

    // Validate required fields
    if (!productId || !productName || !movementType || !reason || quantity === undefined || !reference) {
      return NextResponse.json(
        { error: 'Missing required fields: productId, productName, movementType, reason, quantity, and reference are required' },
        { status: 400 }
      )
    }

    console.log('[Bar Stock Movements API] Creating stock movement:', reference)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Verify product exists
    const product = await db.collection('bar_inventory').findOne({ 
      _id: new ObjectId(productId),
      type: 'bar'
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Prepare movement document
    const movementData = {
      type: 'bar',
      productId: productId,
      productName: productName.trim(),
      movementType: movementType, // 'inflow' or 'outflow'
      reason: reason.trim(),
      quantity: Number(quantity),
      previousStock: previousStock !== undefined ? Number(previousStock) : product.stock,
      newStock: newStock !== undefined ? Number(newStock) : (movementType === 'inflow' ? product.stock + Number(quantity) : product.stock - Number(quantity)),
      supplier: supplier?.trim() || '',
      reference: reference.trim(),
      notes: notes?.trim() || '',
      userId: userId || '',
      user: userName || 'System',
      date: new Date(),
      createdAt: new Date(),
    }

    // Insert movement
    const result = await db.collection('bar_stock_movements').insertOne(movementData)

    // Update product stock if this is a manual movement
    if (newStock !== undefined) {
      await db.collection('bar_inventory').updateOne(
        { _id: new ObjectId(productId) },
        { 
          $set: { 
            stock: movementData.newStock,
            updatedAt: new Date(),
          }
        }
      )
    }

    console.log(`[Bar Stock Movements API] ✅ Stock movement created successfully: ${reference} (ID: ${result.insertedId})`)

    return NextResponse.json({
      success: true,
      movement: {
        ...movementData,
        _id: result.insertedId.toString(),
        id: result.insertedId.toString(),
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('[Bar Stock Movements API] ❌ Error creating stock movement:', error)
    return NextResponse.json(
      {
        error: 'Failed to create stock movement',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

