import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireCathaPermission } from '@/lib/auth-catha'

export const runtime = 'nodejs'

// POST create new supplier delivery
export async function POST(request: Request) {
  const { allowed, response } = await requireCathaPermission('inventory.suppliers', 'create')
  if (!allowed && response) return response
  try {
    const body = await request.json()
    const {
      supplierId,
      supplierName,
      deliveryNote,
      items,
      notes,
      date,
    } = body

    // Validate required fields
    if (!supplierId || !supplierName || !deliveryNote || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: supplierId, supplierName, deliveryNote, and items are required' },
        { status: 400 }
      )
    }

    console.log('[Bar Supplier Deliveries API] Creating delivery:', deliveryNote)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Verify supplier exists
    const supplier = await db.collection('bar_suppliers').findOne({ 
      _id: new ObjectId(supplierId),
      type: 'bar'
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    // Process items and update inventory
    const processedItems = []
    for (const item of items) {
      if (!item.productId || !item.quantity || item.cost === undefined) {
        continue
      }

      // Get product
      const product = await db.collection('bar_inventory').findOne({
        _id: new ObjectId(item.productId),
        type: 'bar'
      })

      if (product) {
        // Update product stock
        const newStock = (product.stock || 0) + Number(item.quantity)
        await db.collection('bar_inventory').updateOne(
          { _id: new ObjectId(item.productId) },
          { 
            $set: { 
              stock: newStock,
              updatedAt: new Date(),
            }
          }
        )

        // Create stock movement
        await db.collection('bar_stock_movements').insertOne({
          type: 'bar',
          productId: item.productId,
          productName: product.name,
          movementType: 'inflow',
          reason: 'delivery',
          quantity: Number(item.quantity),
          previousStock: product.stock || 0,
          newStock: newStock,
          supplier: supplierName,
          reference: deliveryNote,
          notes: notes || '',
          user: 'System',
          date: date ? new Date(date) : new Date(),
          createdAt: new Date(),
        })

        processedItems.push({
          productId: item.productId,
          productName: product.name,
          quantity: Number(item.quantity),
          cost: Number(item.cost),
        })
      }
    }

    // Prepare delivery document
    const deliveryData = {
      type: 'bar',
      supplierId: supplierId,
      supplierName: supplierName.trim(),
      deliveryNote: deliveryNote.trim(),
      items: processedItems,
      notes: notes?.trim() || '',
      date: date ? new Date(date) : new Date(),
      createdAt: new Date(),
    }

    // Insert delivery
    const result = await db.collection('bar_supplier_deliveries').insertOne(deliveryData)

    // Update supplier's lastDelivery date
    await db.collection('bar_suppliers').updateOne(
      { _id: new ObjectId(supplierId) },
      { 
        $set: { 
          lastDelivery: deliveryData.date,
          updatedAt: new Date(),
        }
      }
    )
    
    console.log(`[Bar Supplier Deliveries API] ✅ Delivery created successfully: ${deliveryNote} (ID: ${result.insertedId})`)

    return NextResponse.json({
      success: true,
      delivery: {
        ...deliveryData,
        _id: result.insertedId.toString(),
        id: result.insertedId.toString(),
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('[Bar Supplier Deliveries API] ❌ Error creating delivery:', error)
    return NextResponse.json(
      {
        error: 'Failed to create delivery',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// GET supplier deliveries
export async function GET(request: Request) {
  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    
    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplierId')

    let query: any = { type: 'bar' }

    if (supplierId) {
      query.supplierId = supplierId
    }

    const deliveries = await db.collection('bar_supplier_deliveries')
      .find(query)
      .sort({ date: -1, createdAt: -1 })
      .toArray()

    return NextResponse.json({
      success: true,
      deliveries: deliveries.map((d: any) => ({
        ...d,
        _id: d._id.toString(),
        id: d._id.toString(),
        date: d.date instanceof Date ? d.date.toISOString() : d.date,
      })),
    })
  } catch (error: any) {
    console.error('[Bar Supplier Deliveries API] ❌ Error fetching deliveries:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch deliveries',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

