import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// GET all flavors
export async function GET(request: Request) {
  try {
    console.log('[Flavors API] Fetching flavors from database...')
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    
    const flavors = await db.collection('jaba_flavors')
      .find({})
      .sort({ name: 1 })
      .toArray()

    console.log(`[Flavors API] Found ${flavors.length} flavors:`, flavors.map(f => f.name))
    
    // Convert _id to string for JSON serialization
    const formattedFlavors = flavors.map(flavor => ({
      _id: flavor._id.toString(),
      name: flavor.name,
      createdAt: flavor.createdAt,
    }))

    return NextResponse.json({ flavors: formattedFlavors })
  } catch (error: any) {
    console.error('[Flavors API] Error fetching flavors:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch flavors',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// POST create new flavor
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Flavor name is required' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    // Check if flavor already exists (case-insensitive)
    const existing = await db.collection('jaba_flavors').findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Flavor already exists' },
        { status: 400 }
      )
    }

    const flavorData = {
      name: name.trim(),
      createdAt: new Date(),
    }

    const result = await db.collection('jaba_flavors').insertOne(flavorData)
    
    console.log(`[Flavors API] ✅ Flavor created: ${name}`)

    return NextResponse.json(
      { 
        success: true,
        flavor: {
          ...flavorData,
          _id: result.insertedId.toString(),
        }
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating flavor:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create flavor',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// PUT update flavor
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name } = body

    if (!id || !name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Flavor ID and name are required' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    // Check if flavor exists
    const existing = await db.collection('jaba_flavors').findOne({ _id: new (await import('mongodb')).ObjectId(id) })
    if (!existing) {
      return NextResponse.json(
        { error: 'Flavor not found' },
        { status: 404 }
      )
    }

    // Check if new name already exists (excluding current flavor, case-insensitive)
    const duplicate = await db.collection('jaba_flavors').findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      _id: { $ne: new (await import('mongodb')).ObjectId(id) }
    })

    if (duplicate) {
      return NextResponse.json(
        { error: 'Flavor name already exists' },
        { status: 400 }
      )
    }

    await db.collection('jaba_flavors').updateOne(
      { _id: new (await import('mongodb')).ObjectId(id) },
      { $set: { name: name.trim(), updatedAt: new Date() } }
    )
    
    console.log(`[Flavors API] ✅ Flavor updated: ${name}`)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating flavor:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update flavor',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// DELETE flavor
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Flavor ID is required' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    // Get flavor name first
    const flavor = await db.collection('jaba_flavors').findOne({ 
      _id: new (await import('mongodb')).ObjectId(id) 
    })

    if (!flavor) {
      return NextResponse.json(
        { error: 'Flavor not found' },
        { status: 404 }
      )
    }

    // Check if flavor is used in any batches (by name, since batches store flavor as string)
    const batchesUsingFlavor = await db.collection('jaba_batches').countDocuments({ flavor: flavor.name })
    if (batchesUsingFlavor > 0) {
      return NextResponse.json(
        { error: `Cannot delete flavor: it is used in ${batchesUsingFlavor} batch(es)` },
        { status: 400 }
      )
    }

    const result = await db.collection('jaba_flavors').deleteOne({ 
      _id: new (await import('mongodb')).ObjectId(id) 
    })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Flavor not found' },
        { status: 404 }
      )
    }
    
    console.log(`[Flavors API] ✅ Flavor deleted: ${flavor.name}`)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting flavor:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete flavor',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

