import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// Cache configuration - cache single product lookups for 60 seconds
export const revalidate = 60

// GET single bar inventory item by ID - OPTIMIZED
// NOTE: GET is public (for ecommerce product pages), but POST/PUT/DELETE require auth
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Public endpoint - no authentication required for viewing products
  try {
    const { id: productId } = await params
    console.log('[Bar Inventory API] Fetching product with ID:', productId)
    
    if (!productId || typeof productId !== 'string') {
      console.error('[Bar Inventory API] Invalid product ID:', productId)
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const collection = db.collection('bar_inventory')

    const projection = {
      _id: 1,
      name: 1,
      category: 1,
      price: 1,
      stock: 1,
      size: 1,
      image: 1,
      notes: 1,
      description: 1,
    }

    // Try to find by ObjectId first (24-char hex string)
    let firstProduct: any = null
    const isValidObjectId = /^[a-fA-F0-9]{24}$/.test(productId)
    console.log('[Bar Inventory API] Is valid ObjectId:', isValidObjectId)

    if (isValidObjectId) {
      try {
        const objectId = new ObjectId(productId)
        console.log('[Bar Inventory API] Searching by ObjectId:', objectId.toString())
        firstProduct = await collection.findOne(
          { _id: objectId, deleted: { $ne: true }, status: { $ne: 'archived' } },
          { projection }
        )
        console.log('[Bar Inventory API] Found by ObjectId:', !!firstProduct)
      } catch (oidErr: any) {
        console.error('[Bar Inventory API] ObjectId parse error:', oidErr?.message, oidErr?.stack)
      }
    }

    // Fallback: search by name (URL-encoded product name)
    if (!firstProduct) {
      try {
        const decodedName = decodeURIComponent(productId)
        const safeName = decodedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        console.log('[Bar Inventory API] Searching by name:', safeName)
        firstProduct = await collection.findOne(
          { name: { $regex: new RegExp(`^${safeName}$`, 'i') }, deleted: { $ne: true }, status: { $ne: 'archived' } },
          { projection }
        )
        console.log('[Bar Inventory API] Found by name:', !!firstProduct)
      } catch (nameErr: any) {
        console.error('[Bar Inventory API] Name search error:', nameErr?.message, nameErr?.stack)
      }
    }

    if (firstProduct) {
      const productName = (firstProduct.name ?? '').toString().trim()
      if (!productName) {
        console.error('[Bar Inventory API] Product found but has no name:', firstProduct)
        return NextResponse.json(
          { success: false, error: 'Product has no name' },
          { status: 404 }
        )
      }

      console.log('[Bar Inventory API] Product found, name:', productName)
      
      // Get ALL variants with same name (including 0 stock)
      try {
        const allVariants = await collection
          .find({ name: productName, deleted: { $ne: true }, status: { $ne: 'archived' } }, { projection })
          .toArray()
        
        console.log('[Bar Inventory API] Found variants:', allVariants.length)

        const transformedProducts = allVariants.map((p: any) => {
          try {
            return {
              _id: p._id?.toString?.() ?? String(p._id),
              id: p._id?.toString?.() ?? String(p._id),
              name: (p.name ?? '').toString(),
              category: (p.category ?? 'other').toString(),
              price: Number(p.price) || 0,
              stock: Number(p.stock) || 0,
              size: (p.size ?? '').toString(),
              image: (p.image ?? '/placeholder.svg').toString(),
              notes: (p.notes ?? '').toString(),
              description: (p.description ?? '').toString(),
            }
          } catch (mapErr: any) {
            console.error('[Bar Inventory API] Error mapping product:', mapErr?.message, p)
            throw mapErr
          }
        })

        const res = NextResponse.json({
          success: true,
          products: transformedProducts,
        })
        res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120, max-age=60')
        return res
      } catch (variantsErr: any) {
        console.error('[Bar Inventory API] Error fetching variants:', variantsErr?.message, variantsErr?.stack)
        throw variantsErr
      }
    }

    console.log('[Bar Inventory API] Product not found for ID:', productId)
    return NextResponse.json(
      { success: false, error: 'Product not found' },
      { status: 404 }
    )
  } catch (error: any) {
    console.error('[Bar Inventory API] ❌ Error fetching product:', error?.message ?? error)
    console.error('[Bar Inventory API] Error stack:', error?.stack)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch product',
        details: error?.message || String(error),
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    )
  }
}

