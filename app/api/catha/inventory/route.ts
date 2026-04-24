import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions, hasCathaPermission } from '@/lib/catha-permissions-model'

export const runtime = 'nodejs'

// Cache configuration - Next.js will cache responses for 60 seconds
export const revalidate = 60
let visibilityDefaultsBackfilled = false

async function dropLegacyNameUniqueIndexes(db: any) {
  const collection = db.collection('bar_inventory')
  let indexes: any[] = []
  try {
    indexes = await collection.listIndexes().toArray()
  } catch (error: any) {
    // Fresh environments may not have bar_inventory yet; allow first insert to create it.
    if (error?.code === 26 || error?.codeName === 'NamespaceNotFound') {
      return
    }
    throw error
  }
  for (const index of indexes) {
    const key = index?.key || {}
    const hasNameKey = Object.prototype.hasOwnProperty.call(key, 'name')
    if (index?.unique && hasNameKey) {
      try {
        await collection.dropIndex(index.name)
        console.log(`[Bar Inventory API] Dropped legacy unique name index: ${index.name}`)
      } catch (error: any) {
        console.warn(`[Bar Inventory API] Failed to drop index ${index.name}:`, error?.message || error)
      }
    }
  }
}

async function ensureVisibilityDefaults(db: any) {
  if (visibilityDefaultsBackfilled) return
  const collection = db.collection('bar_inventory')
  try {
    await collection.updateMany(
      { type: 'bar', isVisible: { $exists: false } },
      { $set: { isVisible: true, updatedAt: new Date() } },
    )
    visibilityDefaultsBackfilled = true
  } catch (error: any) {
    console.warn('[Bar Inventory API] Failed to backfill isVisible defaults:', error?.message || error)
  }
}

// GET all bar inventory items - OPTIMIZED for high performance
// Public: allows unauthenticated (shop, home, product listing). If logged in, requires pos/inventory view.
export async function GET(request: Request) {
  // Public read is allowed; if authenticated, no additional check needed for read inventory list.

  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const stockStatus = searchParams.get('stockStatus') || 'all'
    const visibleOnly = searchParams.get('visibleOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '0') // 0 = no limit
    const skip = parseInt(searchParams.get('skip') || '0')
    const aiFilter = searchParams.get('aiFilter') || ''

    // Keep products visible at stock=0. Only hide archived/deleted items.
    let query: any = { type: 'bar', deleted: { $ne: true }, status: { $ne: 'archived' } }
    if (visibleOnly) {
      query.isVisible = { $ne: false }
    }

    await ensureVisibilityDefaults(db)

    if (category && category !== 'all') {
      query.category = category
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
      ]
    }
    if (stockStatus === 'in-stock') {
      query.stock = { $gt: 0 }
    } else if (stockStatus === 'out-of-stock') {
      query.stock = { $lte: 0 }
    }

    // Optimize query: only fetch needed fields (projection) - minimal fields for POS
    const projection = {
      _id: 1,
      name: 1,
      category: 1,
      price: 1,
      cost: 1,
      stock: 1,
      minStock: 1,
      size: 1,
      image: 1,
      barcode: 1,
      isJaba: 1,
      isFeatured: 1,
      isVisible: 1,
      unit: 1,
      supplier: 1,
      batch: 1,
      // Exclude heavy fields: notes, createdAt (only if needed)
    }

    // Build query with pagination
    let findQuery = db.collection('bar_inventory')
      .find(query, { projection })
      .sort({ createdAt: -1 })

    // Apply pagination if specified
    if (skip > 0) {
      findQuery = findQuery.skip(skip)
    }
    if (limit > 0) {
      findQuery = findQuery.limit(limit)
    }

    const products = await findQuery.toArray()

    // Get total count for pagination (only if limit is set)
    let totalCount = 0
    if (limit > 0) {
      totalCount = await db.collection('bar_inventory').countDocuments(query)
    }

    // Transform data efficiently - minimal transformation
    let transformedProducts = products.map((p: any) => ({
      _id: p._id.toString(),
      id: p._id.toString(),
      name: p.name || '',
      category: p.category || 'other',
      price: p.price || 0,
      cost: p.cost || 0,
      stock: p.stock || 0,
      minStock: p.minStock || 0,
      size: p.size || '',
      hasImage: Boolean(p.image),
      image: p.image || '/placeholder.svg',
      barcode: p.barcode || '',
      isJaba: p.isJaba || false,
      isFeatured: p.isFeatured || false,
      isVisible: p.isVisible !== false,
      unit: p.unit || 'item',
      supplier: p.supplier || 'Unknown',
      batch: p.batch || '',
      status: p.status || ((p.stock || 0) > 0 ? 'active' : 'out_of_stock'),
      stockStatus: (p.stock || 0) > 0 ? 'in_stock' : 'out_of_stock',
    }))

    const aiFiltersNeedingOrders = [
      'restock-urgent',
      'dead-stock',
      'overstock',
      'fast-movers',
      'low-margin-high-sales',
    ]
    if (aiFilter && aiFiltersNeedingOrders.includes(aiFilter)) {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const sevenDaysAgo = new Date(todayStart)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const thirtyDaysAgo = new Date(todayStart)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const recentOrders = await db
        .collection('orders')
        .find({ timestamp: { $gte: thirtyDaysAgo } })
        .project({ items: 1, timestamp: 1, status: 1, paymentStatus: 1 })
        .toArray()

      const completedOrders = recentOrders.filter(
        (o: any) => o.status === 'completed' || o.paymentStatus === 'PAID',
      )
      const weekOrders = completedOrders.filter((o: any) => {
        const t = o.timestamp instanceof Date ? o.timestamp : new Date(o.timestamp)
        return t >= sevenDaysAgo
      })

      const productSalesMap: Record<string, number> = {}
      for (const o of completedOrders) {
        for (const item of o.items || []) {
          const pid = String(item.productId || item._id || '')
          productSalesMap[pid] = (productSalesMap[pid] || 0) + (Number(item.quantity) || 0)
        }
      }

      const weekProductSalesMap: Record<string, number> = {}
      for (const o of weekOrders) {
        for (const item of o.items || []) {
          const pid = String(item.productId || item._id || '')
          weekProductSalesMap[pid] = (weekProductSalesMap[pid] || 0) + (Number(item.quantity) || 0)
        }
      }

      if (aiFilter === 'dead-stock') {
        transformedProducts = transformedProducts.filter((p: any) => {
          const stock = p.stock ?? 0
          return stock > 0 && !productSalesMap[p.id]
        })
      } else if (aiFilter === 'overstock') {
        transformedProducts = transformedProducts.filter((p: any) => {
          const stock = p.stock ?? 0
          const minStock = p.minStock ?? 0
          const sales = productSalesMap[p.id] || 0
          return stock > 0 && sales < stock * 0.1 && stock > minStock * 3
        })
      } else if (aiFilter === 'restock-urgent') {
        transformedProducts = transformedProducts.filter((p: any) => {
          const stock = p.stock ?? 0
          const minStock = p.minStock ?? 0
          const isLow = minStock > 0 && stock <= minStock
          return isLow && (weekProductSalesMap[p.id] || 0) > 0
        })
      } else if (aiFilter === 'fast-movers') {
        const topIds = Object.entries(productSalesMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([id]) => id)
        const idSet = new Set(topIds)
        transformedProducts = transformedProducts.filter((p: any) => idSet.has(p.id))
      } else if (aiFilter === 'low-margin-high-sales') {
        transformedProducts = transformedProducts.filter((p: any) => {
          const cost = p.cost || 0
          const price = p.price || 0
          if (!(cost > 0 && price > 0)) return false
          const margin = Math.round(((price - cost) / price) * 100)
          const monthly = productSalesMap[p.id] || 0
          return margin < 30 && monthly > 5
        })
      }
    }

    // Set cache headers for browser caching
    const response = NextResponse.json({
      success: true,
      products: transformedProducts,
      ...(limit > 0 && { total: totalCount, limit, skip }),
      ...(aiFilter ? { aiFilterApplied: aiFilter } : {}),
    })

    if (aiFilter && aiFiltersNeedingOrders.includes(aiFilter)) {
      response.headers.set('Cache-Control', 'private, no-store, max-age=0')
    } else {
      // POS-critical: stock must stay fresh. Short TTL - 5s cache, 10s SWR (product list/metadata OK; stock near real-time)
      response.headers.set('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=10, max-age=5')
    }
    
    return response
  } catch (error: any) {
    console.error('[Bar Inventory API] ❌ Error fetching inventory:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch inventory',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// POST create new bar inventory item
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = ((session.user as any).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'inventory', 'add')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  try {
    const body = await request.json()
    const {
      name,
      category,
      barcode,
      cost,
      price,
      stock,
      minStock,
      unit,
      size,
      supplier,
      batch,
      infusion,
      notes,
      image,
      isJaba,
      isFeatured,
      isVisible,
      status,
    } = body
    const requestedStatus = status === 'archived' || status === 'out_of_stock' || status === 'active' ? status : null

    // Validate required fields
    if (!name || !category || cost === undefined || price === undefined || stock === undefined || !unit || !supplier) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category, cost, price, stock, unit, and supplier are required' },
        { status: 400 }
      )
    }

    console.log('[Bar Inventory API] Creating new inventory item:', name)

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    await dropLegacyNameUniqueIndexes(db)
    const normalizedBarcode = barcode?.trim() || ''
    if (normalizedBarcode) {
      const existingBarcode = await db.collection('bar_inventory').findOne({
        type: 'bar',
        deleted: { $ne: true },
        barcode: normalizedBarcode,
      })
      if (existingBarcode) {
        return NextResponse.json(
          { error: 'Product with this barcode already exists' },
          { status: 400 }
        )
      }
    }

    // Prepare inventory item document
    const inventoryData = {
      name: name.trim(),
      category: category.trim(),
      barcode: normalizedBarcode,
      cost: Number(cost),
      price: Number(price),
      stock: Number(stock),
      minStock: Number(minStock) || 0,
      unit: unit.trim(),
      size: size?.trim() || '',
      supplier: supplier.trim(),
      image: image || '',
      batch: batch?.trim() || '',
      infusion: infusion?.trim() || '',
      notes: notes?.trim() || '',
      isJaba: Boolean(isJaba),
      isFeatured: Boolean(isFeatured),
      isVisible: isVisible !== false,
      status: requestedStatus || (Number(stock) > 0 ? 'active' : 'out_of_stock'),
      type: 'bar', // Specifically mark as bar inventory
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Insert inventory item
    const result = await db.collection('bar_inventory').insertOne(inventoryData)
    
    console.log(`[Bar Inventory API] ✅ Inventory item created successfully: ${name} (ID: ${result.insertedId})`)

    return NextResponse.json(
      {
        success: true,
        product: {
          ...inventoryData,
          _id: result.insertedId.toString(),
          id: result.insertedId.toString(),
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[Bar Inventory API] ❌ Error creating inventory item:', error)
    if (error?.code === 11000) {
      const key = Object.keys(error?.keyPattern || {})[0]
      return NextResponse.json(
        { error: key === 'barcode' ? 'Product with this barcode already exists' : 'Duplicate key error' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      {
        error: 'Failed to create inventory item',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// PUT update existing bar inventory item
export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = ((session.user as any).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'inventory', 'edit')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  try {
    const body = await request.json()
    const {
      id,
      name,
      category,
      barcode,
      cost,
      price,
      stock,
      minStock,
      unit,
      size,
      supplier,
      batch,
      infusion,
      notes,
      image,
      isJaba,
      isFeatured,
      isVisible,
      status,
    } = body
    const requestedStatus = status === 'archived' || status === 'out_of_stock' || status === 'active' ? status : null

    // Validate required fields
    if (!id || !name || !category || cost === undefined || price === undefined || stock === undefined || !unit || !supplier) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name, category, cost, price, stock, unit, and supplier are required' },
        { status: 400 }
      )
    }

    console.log('[Bar Inventory API] Updating inventory item:', name, 'ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if product exists
    const existing = await db.collection('bar_inventory').findOne({ 
      _id: new ObjectId(id),
      type: 'bar'
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    await dropLegacyNameUniqueIndexes(db)
    const normalizedBarcode = barcode?.trim() || ''
    if (normalizedBarcode) {
      const conflict = await db.collection('bar_inventory').findOne({
        _id: { $ne: new ObjectId(id) },
        type: 'bar',
        deleted: { $ne: true },
        barcode: normalizedBarcode,
      })
      if (conflict) {
        return NextResponse.json(
          { error: 'Product with this barcode already exists' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData = {
      name: name.trim(),
      category: category.trim(),
      barcode: normalizedBarcode,
      cost: Number(cost),
      price: Number(price),
      stock: Number(stock),
      minStock: Number(minStock) || 0,
      unit: unit.trim(),
      size: size?.trim() || '',
      supplier: supplier.trim(),
      image: image || existing.image || '',
      batch: batch?.trim() || '',
      infusion: infusion?.trim() || '',
      notes: notes?.trim() || '',
      isJaba: Boolean(isJaba),
      isFeatured: Boolean(isFeatured),
      isVisible: isVisible !== false,
      status: requestedStatus || (Number(stock) > 0 ? 'active' : 'out_of_stock'),
      updatedAt: new Date(),
    }

    // Update inventory item
    await db.collection('bar_inventory').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )
    
    console.log(`[Bar Inventory API] ✅ Inventory item updated successfully: ${name} (ID: ${id})`)

    return NextResponse.json({
      success: true,
      product: {
        ...updateData,
        _id: id,
        id: id,
        createdAt: existing.createdAt,
      },
    })
  } catch (error: any) {
    console.error('[Bar Inventory API] ❌ Error updating inventory item:', error)
    if (error?.code === 11000) {
      const key = Object.keys(error?.keyPattern || {})[0]
      return NextResponse.json(
        { error: key === 'barcode' ? 'Product with this barcode already exists' : 'Duplicate key error' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      {
        error: 'Failed to update inventory item',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// DELETE bar inventory item
export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = ((session.user as any).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'inventory', 'delete')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    console.log('[Bar Inventory API] Deleting inventory item ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if product exists
    const existing = await db.collection('bar_inventory').findOne({ 
      _id: new ObjectId(id),
      type: 'bar'
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Delete inventory item
    await db.collection('bar_inventory').deleteOne({ _id: new ObjectId(id) })
    
    console.log(`[Bar Inventory API] ✅ Inventory item deleted successfully: ${existing.name} (ID: ${id})`)

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    })
  } catch (error: any) {
    console.error('[Bar Inventory API] ❌ Error deleting inventory item:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete inventory item',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

