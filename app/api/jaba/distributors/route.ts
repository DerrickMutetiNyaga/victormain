import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// GET all distributors
export async function GET(request: Request) {
  try {
    console.log('[Distributors API] Starting fetch...')
    
    const client = await clientPromise
    console.log('[Distributors API] Client obtained')
    
    const db = client.db('infusion_jaba')
    console.log('[Distributors API] Database obtained')
    
    const distributors = await db.collection('jaba_distributors')
      .find({})
      .sort({ createdAt: -1, _id: -1 }) // Latest first
      .toArray()

    console.log(`[Distributors API] Found ${distributors.length} distributors`)

    // Convert MongoDB IDs and dates efficiently
    const formattedDistributors = distributors.map(distributor => ({
      ...distributor,
      id: distributor._id.toString(),
      _id: distributor._id.toString(),
      createdAt: distributor.createdAt instanceof Date 
        ? distributor.createdAt.toISOString() 
        : distributor.createdAt,
      updatedAt: distributor.updatedAt instanceof Date 
        ? distributor.updatedAt.toISOString() 
        : distributor.updatedAt,
    }))

    return NextResponse.json({ distributors: formattedDistributors })
  } catch (error: any) {
    console.error('[Distributors API] Error fetching distributors:', error)
    console.error('[Distributors API] Error stack:', error.stack)
    console.error('[Distributors API] Error name:', error.name)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch distributors',
        details: error.message || String(error),
        type: error.name || 'UnknownError',
      },
      { status: 500 }
    )
  }
}

// POST create new distributor
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name,
      contactPerson,
      phone,
      email,
      address,
      region,
      volumeMonthly,
      deliveryFrequency,
      notes,
    } = body

    // Validate required fields
    if (!name || !contactPerson || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: name, contactPerson, and phone are required' },
        { status: 400 }
      )
    }

    console.log('[Distributors API] Creating new distributor:', name)

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    // Check if distributor already exists (case-insensitive)
    const existing = await db.collection('jaba_distributors').findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Distributor with this name already exists' },
        { status: 400 }
      )
    }

    // Prepare distributor document
    const distributorData = {
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email?.trim() || '',
      address: address?.trim() || '',
      region: region?.trim() || '',
      volumeMonthly: volumeMonthly ? Number(volumeMonthly) : 0,
      deliveryFrequency: deliveryFrequency?.trim() || '',
      notes: notes?.trim() || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Insert distributor
    const result = await db.collection('jaba_distributors').insertOne(distributorData)
    
    console.log(`[Distributors API] ✅ Distributor created successfully: ${name} (ID: ${result.insertedId})`)

    return NextResponse.json(
      { 
        success: true,
        distributor: {
          ...distributorData,
          _id: result.insertedId.toString(),
          id: result.insertedId.toString(),
        }
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[Distributors API] ❌ Error creating distributor:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create distributor',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// PUT update distributor
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const {
      id,
      name,
      contactPerson,
      phone,
      email,
      address,
      region,
      volumeMonthly,
      deliveryFrequency,
      notes,
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Distributor ID is required' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!name || !contactPerson || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: name, contactPerson, and phone are required' },
        { status: 400 }
      )
    }

    console.log('[Distributors API] Updating distributor:', name, 'ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if distributor exists
    const existing = await db.collection('jaba_distributors').findOne({ _id: new ObjectId(id) })
    if (!existing) {
      return NextResponse.json(
        { error: 'Distributor not found' },
        { status: 404 }
      )
    }

    // Check if new name conflicts with another distributor (case-insensitive)
    const duplicate = await db.collection('jaba_distributors').findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      _id: { $ne: new ObjectId(id) }
    })

    if (duplicate) {
      return NextResponse.json(
        { error: 'Distributor with this name already exists' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData = {
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email?.trim() || '',
      address: address?.trim() || '',
      region: region?.trim() || '',
      volumeMonthly: volumeMonthly ? Number(volumeMonthly) : 0,
      deliveryFrequency: deliveryFrequency?.trim() || '',
      notes: notes?.trim() || '',
      updatedAt: new Date(),
    }

    // Update distributor
    await db.collection('jaba_distributors').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )
    
    console.log(`[Distributors API] ✅ Distributor updated successfully: ${name}`)

    return NextResponse.json(
      { 
        success: true,
        distributor: {
          ...updateData,
          _id: id,
          id: id,
        }
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[Distributors API] ❌ Error updating distributor:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update distributor',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// DELETE distributor
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Distributor ID is required' },
        { status: 400 }
      )
    }

    console.log('[Distributors API] Deleting distributor ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if distributor exists
    const existing = await db.collection('jaba_distributors').findOne({ _id: new ObjectId(id) })
    if (!existing) {
      return NextResponse.json(
        { error: 'Distributor not found' },
        { status: 404 }
      )
    }

    // Delete distributor
    await db.collection('jaba_distributors').deleteOne({ _id: new ObjectId(id) })
    
    console.log(`[Distributors API] ✅ Distributor deleted successfully: ${existing.name}`)

    return NextResponse.json(
      { 
        success: true,
        message: 'Distributor deleted successfully'
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[Distributors API] ❌ Error deleting distributor:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete distributor',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

