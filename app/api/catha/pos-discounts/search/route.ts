import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions } from '@/lib/catha-permissions-model'
import { ObjectId } from 'mongodb'
import { POS_DISCOUNTS_COLLECTION } from '@/lib/pos-product-discounts'
import { canManagePosDiscounts } from '@/lib/pos-discount-permissions'

export const runtime = 'nodejs'

/** Fast server-side product search for POS discount modal with filters */
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = String((session.user as { role?: string }).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as { permissions?: unknown }).permissions)

  if (!canManagePosDiscounts(role, perms)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const q = String(searchParams.get('q') ?? '').trim()
    const category = searchParams.get('category')
    const brand = searchParams.get('brand')
    const discountFilter = searchParams.get('discount') // all | has_discount | no_discount
    const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10) || 30, 50)

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const query: Record<string, unknown> = {
      type: 'bar',
      deleted: { $ne: true },
      status: { $ne: 'archived' },
    }

    if (category && category !== 'all') query.category = category
    if (brand && brand !== 'all') query.supplier = brand

    if (q.length >= 1) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = { $regex: escaped, $options: 'i' }
      const orConditions: Record<string, unknown>[] = [
        { name: regex },
        { barcode: regex },
        { category: regex },
        { supplier: regex },
      ]
      if (ObjectId.isValid(q) && q.length === 24) {
        orConditions.push({ _id: new ObjectId(q) })
      }
      query.$or = orConditions
    } else if (!category && !brand && discountFilter !== 'has_discount' && discountFilter !== 'no_discount') {
      return NextResponse.json({ success: true, products: [], categories: [], brands: [] })
    }

    const products = await db
      .collection('bar_inventory')
      .find(query)
      .project({
        _id: 1,
        name: 1,
        category: 1,
        price: 1,
        image: 1,
        barcode: 1,
        size: 1,
        supplier: 1,
      })
      .sort({ name: 1 })
      .limit(limit)
      .toArray()

    const productIds = products.map((p) => p._id.toString())
    const discountRows =
      productIds.length > 0
        ? await db
            .collection(POS_DISCOUNTS_COLLECTION)
            .find({ productId: { $in: productIds } })
            .toArray()
        : []
    const discountSet = new Set(discountRows.map((d) => String(d.productId)))

    let filtered = products
    if (discountFilter === 'has_discount') {
      filtered = products.filter((p) => discountSet.has(p._id.toString()))
    } else if (discountFilter === 'no_discount') {
      filtered = products.filter((p) => !discountSet.has(p._id.toString()))
    }

    const [categories, brands] = await Promise.all([
      db.collection('bar_inventory').distinct('category', { type: 'bar', deleted: { $ne: true } }),
      db.collection('bar_inventory').distinct('supplier', { type: 'bar', deleted: { $ne: true } }),
    ])

    return NextResponse.json({
      success: true,
      products: filtered.map((p) => ({
        id: p._id.toString(),
        name: String(p.name ?? ''),
        category: String(p.category ?? ''),
        price: Number(p.price ?? 0),
        image: String(p.image ?? '/placeholder.svg'),
        barcode: String(p.barcode ?? ''),
        sku: p._id.toString().slice(-8).toUpperCase(),
        size: String(p.size ?? ''),
        supplier: String(p.supplier ?? ''),
        hasProductDiscount: discountSet.has(p._id.toString()),
      })),
      categories: (categories as string[]).filter(Boolean).sort(),
      brands: (brands as string[]).filter(Boolean).sort(),
    })
  } catch (error: unknown) {
    console.error('[POS Discounts Search] error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
