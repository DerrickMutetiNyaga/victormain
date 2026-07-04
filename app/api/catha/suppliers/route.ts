import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireCathaPermission } from '@/lib/auth-catha'

export const runtime = 'nodejs'

// GET all bar suppliers
export async function GET(request: Request) {
  const { allowed, response } = await requireCathaPermission('inventory.suppliers', 'view')
  if (!allowed && response) return response
  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query: any = { type: 'bar' } // Only get bar suppliers

    if (status && status !== 'all') {
      query.status = status
    }

    const suppliers = await db.collection('bar_suppliers')
      .find(query)
      .sort({ createdAt: -1, _id: -1 })
      .toArray()

    return NextResponse.json({
      success: true,
      suppliers: suppliers.map((s: any) => ({
        ...s,
        _id: s._id.toString(),
        id: s._id.toString(),
        lastDelivery: s.lastDelivery instanceof Date ? s.lastDelivery.toISOString() : s.lastDelivery,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
        updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
      })),
    })
  } catch (error: any) {
    console.error('[Bar Suppliers API] ❌ Error fetching suppliers:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch suppliers',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// POST create new bar supplier
export async function POST(request: Request) {
  const { allowed, response } = await requireCathaPermission('inventory.suppliers', 'create')
  if (!allowed && response) return response
  try {
    const body = await request.json()
    const {
      name,
      category,
      contact,
      email,
      phone,
      address,
      balance,
      notes,
    } = body

    // Validate required fields
    if (!name || !category || !contact || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category, contact, and phone are required' },
        { status: 400 }
      )
    }

    console.log('[Bar Suppliers API] Creating supplier:', name)

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    // Check if supplier already exists (case-insensitive)
    const existing = await db.collection('bar_suppliers').findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      type: 'bar'
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Supplier with this name already exists' },
        { status: 400 }
      )
    }

    // Prepare supplier document
    const supplierData = {
      type: 'bar',
      name: name.trim(),
      category: category.trim(),
      contact: contact.trim(),
      email: email?.trim() || '',
      phone: phone.trim(),
      address: address?.trim() || '',
      balance: balance ? Number(balance) : 0,
      notes: notes?.trim() || '',
      status: 'active',
      lastDelivery: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Insert supplier
    const result = await db.collection('bar_suppliers').insertOne(supplierData)
    
    console.log(`[Bar Suppliers API] ✅ Supplier created successfully: ${name} (ID: ${result.insertedId})`)

    return NextResponse.json({
      success: true,
      supplier: {
        ...supplierData,
        _id: result.insertedId.toString(),
        id: result.insertedId.toString(),
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('[Bar Suppliers API] ❌ Error creating supplier:', error)
    return NextResponse.json(
      {
        error: 'Failed to create supplier',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// PUT update existing bar supplier
export async function PUT(request: Request) {
  const { allowed, response } = await requireCathaPermission('inventory.suppliers', 'edit')
  if (!allowed && response) return response
  try {
    const body = await request.json()
    const {
      id,
      name,
      category,
      contact,
      email,
      phone,
      address,
      balance,
      notes,
      status,
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Supplier ID is required' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!name || !category || !contact || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category, contact, and phone are required' },
        { status: 400 }
      )
    }

    console.log('[Bar Suppliers API] Updating supplier:', name, 'ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if supplier exists
    const existing = await db.collection('bar_suppliers').findOne({ 
      _id: new ObjectId(id),
      type: 'bar'
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    // Check if new name conflicts with another supplier (case-insensitive)
    const duplicate = await db.collection('bar_suppliers').findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      _id: { $ne: new ObjectId(id) },
      type: 'bar'
    })

    if (duplicate) {
      return NextResponse.json(
        { error: 'Supplier with this name already exists' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData = {
      name: name.trim(),
      category: category.trim(),
      contact: contact.trim(),
      email: email?.trim() || '',
      phone: phone.trim(),
      address: address?.trim() || '',
      balance: balance !== undefined ? Number(balance) : existing.balance,
      notes: notes?.trim() || '',
      status: status || existing.status,
      updatedAt: new Date(),
    }

    // Update supplier
    await db.collection('bar_suppliers').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )
    
    console.log(`[Bar Suppliers API] ✅ Supplier updated successfully: ${name} (ID: ${id})`)

    return NextResponse.json({
      success: true,
      supplier: {
        ...updateData,
        _id: id,
        id: id,
        lastDelivery: existing.lastDelivery,
        createdAt: existing.createdAt,
      },
    })
  } catch (error: any) {
    console.error('[Bar Suppliers API] ❌ Error updating supplier:', error)
    return NextResponse.json(
      {
        error: 'Failed to update supplier',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// DELETE bar supplier
export async function DELETE(request: Request) {
  const { allowed, response } = await requireCathaPermission('inventory.suppliers', 'delete')
  if (!allowed && response) return response
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Supplier ID is required' },
        { status: 400 }
      )
    }

    console.log('[Bar Suppliers API] Deleting supplier ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if supplier exists
    const existing = await db.collection('bar_suppliers').findOne({ 
      _id: new ObjectId(id),
      type: 'bar'
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    // Delete supplier
    await db.collection('bar_suppliers').deleteOne({ _id: new ObjectId(id) })
    
    console.log(`[Bar Suppliers API] ✅ Supplier deleted successfully: ${existing.name} (ID: ${id})`)

    return NextResponse.json({
      success: true,
      message: 'Supplier deleted successfully',
    })
  } catch (error: any) {
    console.error('[Bar Suppliers API] ❌ Error deleting supplier:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete supplier',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

