import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// GET all suppliers
export async function GET(request: Request) {
  try {
    console.log('[Suppliers API] Starting fetch...')
    
    const client = await clientPromise
    console.log('[Suppliers API] Client obtained')
    
    const db = client.db('infusion_jaba')
    console.log('[Suppliers API] Database obtained')
    
    const suppliers = await db.collection('jaba_suppliers')
      .find({})
      .sort({ createdAt: -1, _id: -1 }) // Latest first
      .toArray()

    console.log(`[Suppliers API] Found ${suppliers.length} suppliers`)

    // Convert MongoDB IDs and dates efficiently
    const formattedSuppliers = suppliers.map(supplier => ({
      ...supplier,
      id: supplier._id.toString(),
      _id: supplier._id.toString(),
      createdAt: supplier.createdAt instanceof Date 
        ? supplier.createdAt.toISOString() 
        : supplier.createdAt,
      updatedAt: supplier.updatedAt instanceof Date 
        ? supplier.updatedAt.toISOString() 
        : supplier.updatedAt,
    }))

    return NextResponse.json({ suppliers: formattedSuppliers })
  } catch (error: any) {
    console.error('[Suppliers API] Error fetching suppliers:', error)
    console.error('[Suppliers API] Error stack:', error.stack)
    console.error('[Suppliers API] Error name:', error.name)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch suppliers',
        details: error.message || String(error),
        type: error.name || 'UnknownError',
      },
      { status: 500 }
    )
  }
}

// POST create new supplier
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name,
      category,
      contactPerson,
      phone,
      email,
      address,
      itemsSupplied,
    } = body

    // Validate required fields
    if (!name || !category || !contactPerson || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category, contactPerson, and phone are required' },
        { status: 400 }
      )
    }

    console.log('[Suppliers API] Creating new supplier:', name)

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    // Check if supplier already exists (case-insensitive)
    const existing = await db.collection('jaba_suppliers').findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Supplier with this name already exists' },
        { status: 400 }
      )
    }

    // Prepare supplier document
    const supplierData = {
      name: name.trim(),
      category: category.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email?.trim() || '',
      address: address?.trim() || '',
      itemsSupplied: itemsSupplied || [],
      type: 'Supplier',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Insert supplier
    const result = await db.collection('jaba_suppliers').insertOne(supplierData)
    
    console.log(`[Suppliers API] ✅ Supplier created successfully: ${name} (ID: ${result.insertedId})`)

    return NextResponse.json(
      { 
        success: true,
        supplier: {
          ...supplierData,
          _id: result.insertedId.toString(),
          id: result.insertedId.toString(),
        }
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[Suppliers API] ❌ Error creating supplier:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create supplier',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// PUT update supplier
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const {
      id,
      name,
      category,
      contactPerson,
      phone,
      email,
      address,
      itemsSupplied,
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Supplier ID is required' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!name || !category || !contactPerson || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category, contactPerson, and phone are required' },
        { status: 400 }
      )
    }

    console.log('[Suppliers API] Updating supplier:', name, 'ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if supplier exists
    const existing = await db.collection('jaba_suppliers').findOne({ _id: new ObjectId(id) })
    if (!existing) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    // Check if new name conflicts with another supplier (case-insensitive)
    const duplicate = await db.collection('jaba_suppliers').findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      _id: { $ne: new ObjectId(id) }
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
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email?.trim() || '',
      address: address?.trim() || '',
      itemsSupplied: itemsSupplied || [],
      updatedAt: new Date(),
    }

    // Update supplier
    await db.collection('jaba_suppliers').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )
    
    console.log(`[Suppliers API] ✅ Supplier updated successfully: ${name}`)

    return NextResponse.json(
      { 
        success: true,
        supplier: {
          ...updateData,
          _id: id,
          id: id,
        }
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[Suppliers API] ❌ Error updating supplier:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update supplier',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// DELETE supplier
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Supplier ID is required' },
        { status: 400 }
      )
    }

    console.log('[Suppliers API] Deleting supplier ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if supplier exists
    const existing = await db.collection('jaba_suppliers').findOne({ _id: new ObjectId(id) })
    if (!existing) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    // Delete supplier
    await db.collection('jaba_suppliers').deleteOne({ _id: new ObjectId(id) })
    
    console.log(`[Suppliers API] ✅ Supplier deleted successfully: ${existing.name}`)

    return NextResponse.json(
      { 
        success: true,
        message: 'Supplier deleted successfully'
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[Suppliers API] ❌ Error deleting supplier:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete supplier',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}
