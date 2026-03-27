import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// GET all categories
export async function GET(request: Request) {
  try {
    console.log('[Categories API] Fetching categories...')
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    
    const categories = await db.collection('jaba_categories')
      .find({})
      .sort({ name: 1 })
      .toArray()

    console.log(`[Categories API] Found ${categories.length} categories`)

    // Convert MongoDB IDs
    const formattedCategories = categories.map(category => ({
      ...category,
      id: category._id.toString(),
      _id: category._id.toString(),
      createdAt: category.createdAt instanceof Date 
        ? category.createdAt.toISOString() 
        : category.createdAt,
      updatedAt: category.updatedAt instanceof Date 
        ? category.updatedAt.toISOString() 
        : category.updatedAt,
    }))

    return NextResponse.json({ categories: formattedCategories })
  } catch (error: any) {
    console.error('[Categories API] Error fetching categories:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch categories',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// POST create new category
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      )
    }

    console.log('[Categories API] Creating new category:', name)

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    // Check if category already exists (case-insensitive)
    const existing = await db.collection('jaba_categories').findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Category with this name already exists' },
        { status: 400 }
      )
    }

    // Prepare category document
    const categoryData = {
      name: name.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Insert category
    const result = await db.collection('jaba_categories').insertOne(categoryData)
    
    console.log(`[Categories API] ✅ Category created successfully: ${name} (ID: ${result.insertedId})`)

    return NextResponse.json(
      { 
        success: true,
        category: {
          ...categoryData,
          _id: result.insertedId.toString(),
          id: result.insertedId.toString(),
        }
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[Categories API] ❌ Error creating category:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create category',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// PUT update category
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name } = body

    if (!id || !name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Category ID and name are required' },
        { status: 400 }
      )
    }

    console.log('[Categories API] Updating category:', name, 'ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if category exists
    const existing = await db.collection('jaba_categories').findOne({ _id: new ObjectId(id) })
    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    // Check if new name conflicts with another category (case-insensitive)
    const duplicate = await db.collection('jaba_categories').findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      _id: { $ne: new ObjectId(id) }
    })

    if (duplicate) {
      return NextResponse.json(
        { error: 'Category with this name already exists' },
        { status: 400 }
      )
    }

    // Update category
    await db.collection('jaba_categories').updateOne(
      { _id: new ObjectId(id) },
      { $set: { name: name.trim(), updatedAt: new Date() } }
    )
    
    console.log(`[Categories API] ✅ Category updated successfully: ${name}`)

    return NextResponse.json(
      { 
        success: true,
        category: {
          name: name.trim(),
          _id: id,
          id: id,
        }
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[Categories API] ❌ Error updating category:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update category',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// DELETE category
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      )
    }

    console.log('[Categories API] Deleting category ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if category exists
    const existing = await db.collection('jaba_categories').findOne({ _id: new ObjectId(id) })
    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    // Check if category is being used by any raw materials
    const materialsUsingCategory = await db.collection('jaba_rawMaterials').countDocuments({ 
      category: existing.name 
    })

    if (materialsUsingCategory > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete category. It is being used by ${materialsUsingCategory} material(s)`,
          materialsCount: materialsUsingCategory
        },
        { status: 400 }
      )
    }

    // Delete category
    await db.collection('jaba_categories').deleteOne({ _id: new ObjectId(id) })
    
    console.log(`[Categories API] ✅ Category deleted successfully: ${existing.name}`)

    return NextResponse.json(
      { 
        success: true,
        message: 'Category deleted successfully'
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[Categories API] ❌ Error deleting category:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete category',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

