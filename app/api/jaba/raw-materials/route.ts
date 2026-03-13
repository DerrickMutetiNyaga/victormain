import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// GET all raw materials
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    console.log('[Raw Materials API] Fetching raw materials...')
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    
    // Build query
    const query: any = {}
    
    if (category && category !== 'all') {
      query.category = category
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ]
    }

    const materials = await db.collection('jaba_rawMaterials')
      .find(query)
      .sort({ createdAt: -1, _id: -1 }) // Latest first (by creation date, then by _id)
      .toArray()

    console.log(`[Raw Materials API] Found ${materials.length} materials`)

    // Convert MongoDB dates and IDs
    const formattedMaterials = materials.map(material => ({
      ...material,
      id: material._id.toString(),
      _id: material._id.toString(),
      lastRestocked: material.lastRestocked instanceof Date 
        ? material.lastRestocked.toISOString() 
        : material.lastRestocked,
      createdAt: material.createdAt instanceof Date 
        ? material.createdAt.toISOString() 
        : material.createdAt,
      updatedAt: material.updatedAt instanceof Date 
        ? material.updatedAt.toISOString() 
        : material.updatedAt,
    }))

    return NextResponse.json({ materials: formattedMaterials })
  } catch (error: any) {
    console.error('[Raw Materials API] Error fetching materials:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch raw materials',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// POST create new raw material
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name,
      category,
      currentStock,
      unit,
      minStock,
      supplier,
      reorderLevel,
      preferredSupplier,
    } = body

    // Validate required fields
    if (!name || !category || currentStock === undefined || !unit || !minStock || !supplier || !reorderLevel) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('[Raw Materials API] Creating new raw material:', name)

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    // Check if material already exists
    const existing = await db.collection('jaba_rawMaterials').findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Raw material with this name already exists' },
        { status: 400 }
      )
    }

    // Prepare material document
    const materialData = {
      name: name.trim(),
      category: category.trim(),
      currentStock: Number(currentStock),
      unit: unit.trim(),
      minStock: Number(minStock),
      supplier: supplier.trim(),
      reorderLevel: Number(reorderLevel),
      preferredSupplier: preferredSupplier?.trim() || supplier.trim(),
      lastRestocked: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Insert material
    const result = await db.collection('jaba_rawMaterials').insertOne(materialData)
    
    console.log(`[Raw Materials API] ✅ Raw material created successfully: ${name} (ID: ${result.insertedId})`)

    return NextResponse.json(
      { 
        success: true,
        material: {
          ...materialData,
          _id: result.insertedId.toString(),
          id: result.insertedId.toString(),
        }
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[Raw Materials API] ❌ Error creating raw material:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create raw material',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// PUT update raw material
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const {
      id,
      name,
      category,
      currentStock,
      unit,
      minStock,
      supplier,
      reorderLevel,
      preferredSupplier,
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Material ID is required' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!name || !category || currentStock === undefined || !unit || !minStock || !supplier || !reorderLevel) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('[Raw Materials API] Updating raw material:', name, 'ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if material exists
    const existing = await db.collection('jaba_rawMaterials').findOne({ _id: new ObjectId(id) })
    if (!existing) {
      return NextResponse.json(
        { error: 'Raw material not found' },
        { status: 404 }
      )
    }

    // Check if new name conflicts with another material (case-insensitive)
    const duplicate = await db.collection('jaba_rawMaterials').findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      _id: { $ne: new ObjectId(id) }
    })

    if (duplicate) {
      return NextResponse.json(
        { error: 'Raw material with this name already exists' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData = {
      name: name.trim(),
      category: category.trim(),
      currentStock: Number(currentStock),
      unit: unit.trim(),
      minStock: Number(minStock),
      supplier: supplier.trim(),
      reorderLevel: Number(reorderLevel),
      preferredSupplier: preferredSupplier?.trim() || supplier.trim(),
      updatedAt: new Date(),
    }

    // Update material
    await db.collection('jaba_rawMaterials').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )
    
    console.log(`[Raw Materials API] ✅ Raw material updated successfully: ${name}`)

    return NextResponse.json(
      { 
        success: true,
        material: {
          ...updateData,
          _id: id,
          id: id,
        }
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[Raw Materials API] ❌ Error updating raw material:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update raw material',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// DELETE raw material
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Material ID is required' },
        { status: 400 }
      )
    }

    console.log('[Raw Materials API] Deleting raw material ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if material exists
    const existing = await db.collection('jaba_rawMaterials').findOne({ _id: new ObjectId(id) })
    if (!existing) {
      return NextResponse.json(
        { error: 'Raw material not found' },
        { status: 404 }
      )
    }

    // Delete material
    await db.collection('jaba_rawMaterials').deleteOne({ _id: new ObjectId(id) })
    
    console.log(`[Raw Materials API] ✅ Raw material deleted successfully: ${existing.name}`)

    return NextResponse.json(
      { 
        success: true,
        message: 'Raw material deleted successfully'
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[Raw Materials API] ❌ Error deleting raw material:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete raw material',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

