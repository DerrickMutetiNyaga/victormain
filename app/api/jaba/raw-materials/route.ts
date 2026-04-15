import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireDeleteOtp } from '@/lib/jaba-delete-otp-guard'

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
      packagingStickerFlavor,
    } = body

    // Validate required fields (nullish checks — 0 is valid for minStock/reorderLevel/currentStock)
    const missingPost: string[] = []
    if (!String(name || '').trim()) missingPost.push('name')
    if (!String(category || '').trim()) missingPost.push('category')
    if (!String(unit || '').trim()) missingPost.push('unit')
    if (!String(supplier || '').trim()) missingPost.push('supplier')
    if (currentStock === undefined || currentStock === null) missingPost.push('currentStock')
    if (minStock === undefined || minStock === null) missingPost.push('minStock')
    if (reorderLevel === undefined || reorderLevel === null) missingPost.push('reorderLevel')
    if (missingPost.length) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingPost.join(', ')}` },
        { status: 400 }
      )
    }
    if (Number.isNaN(Number(currentStock)) || Number.isNaN(Number(minStock)) || Number.isNaN(Number(reorderLevel))) {
      return NextResponse.json(
        { error: 'currentStock, minStock, and reorderLevel must be valid numbers' },
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

    const flavorTag =
      typeof packagingStickerFlavor === 'string' && packagingStickerFlavor.trim()
        ? packagingStickerFlavor.trim()
        : undefined

    // Prepare material document
    const materialData: Record<string, unknown> = {
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

    if (flavorTag) {
      materialData.packagingStickerFlavor = flavorTag
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
      packagingStickerFlavor,
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Material ID is required' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if material exists first — merge body with DB so resupply works when optional fields were omitted or 0
    const existing = await db.collection('jaba_rawMaterials').findOne({ _id: new ObjectId(id) })
    if (!existing) {
      return NextResponse.json(
        { error: 'Raw material not found' },
        { status: 404 }
      )
    }

    const pickStr = (v: unknown, fallback: unknown) =>
      typeof v === 'string' && v.trim() ? v.trim() : String(fallback ?? '').trim()

    const pickNum = (v: unknown, fallback: unknown) => {
      if (v === undefined || v === null) return Number(fallback ?? 0)
      if (typeof v === 'string' && v.trim() === '') return Number(fallback ?? 0)
      const n = Number(v)
      return Number.isFinite(n) ? n : Number(fallback ?? 0)
    }

    const mergedName = pickStr(name, existing.name)
    const mergedCategory = pickStr(category, existing.category)
    const mergedUnit = pickStr(unit, existing.unit)
    const mergedSupplier = pickStr(supplier, existing.supplier)
    const mergedCurrent = pickNum(currentStock, existing.currentStock)
    const mergedMin = pickNum(minStock, existing.minStock)
    const mergedReorder = pickNum(reorderLevel, existing.reorderLevel)
    const mergedPreferred =
      typeof preferredSupplier === 'string' && preferredSupplier.trim()
        ? preferredSupplier.trim()
        : mergedSupplier || String(existing.preferredSupplier ?? '').trim() || mergedSupplier

    const missing: string[] = []
    if (!mergedName) missing.push('name')
    if (!mergedCategory) missing.push('category')
    if (!mergedUnit) missing.push('unit')
    if (!mergedSupplier) missing.push('supplier')
    if (missing.length) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      )
    }
    if (Number.isNaN(mergedCurrent) || Number.isNaN(mergedMin) || Number.isNaN(mergedReorder)) {
      return NextResponse.json(
        { error: 'currentStock, minStock, and reorderLevel must be valid numbers' },
        { status: 400 }
      )
    }

    console.log('[Raw Materials API] Updating raw material:', mergedName, 'ID:', id)

    // Check if new name conflicts with another material (case-insensitive)
    const duplicate = await db.collection('jaba_rawMaterials').findOne({ 
      name: { $regex: new RegExp(`^${mergedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      _id: { $ne: new ObjectId(id) }
    })

    if (duplicate) {
      return NextResponse.json(
        { error: 'Raw material with this name already exists' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      name: mergedName,
      category: mergedCategory,
      currentStock: mergedCurrent,
      unit: mergedUnit,
      minStock: mergedMin,
      supplier: mergedSupplier,
      reorderLevel: mergedReorder,
      preferredSupplier: mergedPreferred,
      updatedAt: new Date(),
    }

    if ('packagingStickerFlavor' in body) {
      const v = packagingStickerFlavor
      updateData.packagingStickerFlavor =
        typeof v === 'string' && v.trim() ? v.trim() : null
    }

    // Update material
    await db.collection('jaba_rawMaterials').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )
    
    console.log(`[Raw Materials API] ✅ Raw material updated successfully: ${mergedName}`)

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
    const otpCheck = await requireDeleteOtp(request, 'delete_raw_material', id)
    if ('response' in otpCheck) return otpCheck.response

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

