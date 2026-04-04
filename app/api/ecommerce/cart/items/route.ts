import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getShopSessionFromCookie } from '@/lib/shop-auth'
import { getCartByCustomerId, upsertCart } from '@/lib/models/shop-cart'
import type { CartItemDoc } from '@/lib/models/shop-cart'

const NO_STORE = { 'Cache-Control': 'no-store' }

function getUniqueId(item: { id: string; size?: string }) {
  return item.size ? `${item.id}-${item.size}` : item.id
}

async function getSessionCustomerId(): Promise<ObjectId | null> {
  const session = await getShopSessionFromCookie()
  if (!session?.userId) return null
  try {
    return new ObjectId(session.userId)
  } catch {
    return null
  }
}

function isValidItem(i: any): i is CartItemDoc {
  return (
    typeof i?.id === 'string' &&
    typeof i?.name === 'string' &&
    typeof i?.price === 'number' &&
    typeof i?.quantity === 'number' &&
    typeof i?.image === 'string'
  )
}

export async function POST(request: Request) {
  const customerId = await getSessionCustomerId()
  if (!customerId) {
    return NextResponse.json({ message: 'Not signed in' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const toAdd = Array.isArray(body.items) ? body.items : body.item ? [body.item] : []
    if (toAdd.length === 0 || !toAdd.every(isValidItem)) {
      return NextResponse.json({ success: false, error: 'Invalid cart items' }, { status: 400 })
    }
    const cart = await getCartByCustomerId(customerId)
    const existing = cart?.items ?? []
    const existingMap = new Map(existing.map((i) => [getUniqueId(i), i]))
    for (const item of toAdd) {
      const uid = getUniqueId(item)
      const current = existingMap.get(uid)
      if (current) {
        existingMap.set(uid, { ...current, quantity: current.quantity + (item.quantity ?? 1) })
      } else {
        existingMap.set(uid, { ...item, quantity: item.quantity ?? 1 })
      }
    }
    const items = Array.from(existingMap.values())
    const updated = await upsertCart(customerId, items)
    return NextResponse.json({ success: true, items: updated.items }, { headers: NO_STORE })
  } catch (error) {
    console.error('[ecommerce/cart/items] POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to add to cart' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const customerId = await getSessionCustomerId()
  if (!customerId) {
    return NextResponse.json({ message: 'Not signed in' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const updates = Array.isArray(body.items) ? body.items : body.uniqueId ? [{ uniqueId: body.uniqueId, quantity: body.quantity }] : []
    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid update' }, { status: 400 })
    }
    const cart = await getCartByCustomerId(customerId)
    const existing = cart?.items ?? []
    const existingMap = new Map(existing.map((i) => [getUniqueId(i), { ...i }]))
    for (const u of updates) {
      const uid = typeof u === 'object' && u.uniqueId ? u.uniqueId : (u as any).uniqueId
      const qty = typeof u === 'object' && typeof (u as any).quantity === 'number' ? (u as any).quantity : (u as any).quantity
      const current = existingMap.get(uid)
      if (current) {
        const newQty = Math.max(1, qty)
        existingMap.set(uid, { ...current, quantity: newQty })
      }
    }
    const items = Array.from(existingMap.values())
    const updated = await upsertCart(customerId, items)
    return NextResponse.json({ success: true, items: updated.items }, { headers: NO_STORE })
  } catch (error) {
    console.error('[ecommerce/cart/items] PUT error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update cart' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const customerId = await getSessionCustomerId()
  if (!customerId) {
    return NextResponse.json({ message: 'Not signed in' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(request.url)
    let lineIds: string[] = []
    const qUniqueId = searchParams.get('uniqueId')
    const qProductId = searchParams.get('productId')
    if (qUniqueId) {
      lineIds = [qUniqueId]
    } else if (qProductId) {
      lineIds = [qProductId]
    } else {
      try {
        const body = await request.json()
        lineIds = Array.isArray(body.uniqueIds) ? body.uniqueIds
          : body.uniqueId ? [body.uniqueId]
          : body.productId ? [body.productId]
          : []
      } catch {
        lineIds = []
      }
    }
    if (lineIds.length === 0) {
      return NextResponse.json({ success: false, error: 'uniqueId or productId required' }, { status: 400 })
    }

    const cart = await getCartByCustomerId(customerId)
    const existing = cart?.items ?? []
    const toRemove = new Set(lineIds)

    // Remove ONLY items matching the given lineId(s) - never clear entire cart
    const items = existing.filter((i) => !toRemove.has(getUniqueId(i)))

    if (process.env.NODE_ENV === 'development') {
      console.log('[cart/items DELETE] received lineIds:', lineIds)
      console.log('[cart/items DELETE] existing cart length:', existing.length)
      console.log('[cart/items DELETE] cart length after removal:', items.length)
    }

    const updated = await upsertCart(customerId, items)
    return NextResponse.json({ success: true, items: updated.items }, { headers: NO_STORE })
  } catch (error) {
    console.error('[ecommerce/cart/items] DELETE error:', error)
    return NextResponse.json({ success: false, error: 'Failed to remove from cart' }, { status: 500 })
  }
}

