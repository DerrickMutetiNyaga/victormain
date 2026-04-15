import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getShopSessionFromCookie } from '@/lib/shop-auth'
import { getCartByCustomerId, upsertCart } from '@/lib/models/shop-cart'
import { getDatabase } from '@/lib/mongodb'
import { resolveShopCartLines, type ShopCartResolvedLine } from '@/lib/secure-bar-order-lines'
import {
  shopCartAddItemsSchema,
  shopCartQuantityUpdateSchema,
  formatZodError,
} from '@/lib/order-request-schemas'
import { normalizeCartAddBody } from '@/lib/shop-cart-normalize'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit-simple'

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

export async function POST(request: Request) {
  const customerId = await getSessionCustomerId()
  if (!customerId) {
    return NextResponse.json({ message: 'Not signed in' }, { status: 401 })
  }
  const ip = getClientIp(request)
  const rl = checkRateLimit(`ecom-cart-items-post:${ip}`, 90, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }
  try {
    const raw = await request.json()
    const normalized = normalizeCartAddBody(raw) ?? raw
    const parsed = shopCartAddItemsSchema.safeParse(normalized)
    if (!parsed.success) {
      return NextResponse.json({ success: false, ...formatZodError(parsed.error) }, { status: 400 })
    }
    const toAdd = parsed.data.items?.length
      ? parsed.data.items
      : parsed.data.item
        ? [parsed.data.item]
        : []
    if (toAdd.length === 0) {
      return NextResponse.json({ success: false, error: 'No items to add' }, { status: 400 })
    }

    const db = await getDatabase('infusion_jaba')
    const lines = toAdd.map((l) => ({
      productId: String(l.productId || l.id).trim(),
      quantity: l.quantity,
      size: l.size,
    }))
    const resolved = await resolveShopCartLines(db, lines)
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error, code: resolved.code }, { status: 400 })
    }

    const cart = await getCartByCustomerId(customerId)
    const existing = cart?.items ?? []
    const existingMap = new Map(existing.map((i) => [getUniqueId(i), i]))
    for (const item of resolved.items) {
      const uid = getUniqueId(item)
      const current = existingMap.get(uid)
      if (current) {
        existingMap.set(uid, {
          ...current,
          quantity: current.quantity + item.quantity,
        })
      } else {
        existingMap.set(uid, item)
      }
    }
    const items = Array.from(existingMap.values()) as ShopCartResolvedLine[]
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
    const raw = await request.json()
    const parsed = shopCartQuantityUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ success: false, ...formatZodError(parsed.error) }, { status: 400 })
    }
    const updates =
      parsed.data.items ??
      (parsed.data.uniqueId != null && parsed.data.quantity != null
        ? [{ uniqueId: String(parsed.data.uniqueId), quantity: parsed.data.quantity }]
        : [])
    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid update' }, { status: 400 })
    }

    const cart = await getCartByCustomerId(customerId)
    const existing = cart?.items ?? []
    const existingMap = new Map(existing.map((i) => [getUniqueId(i), { ...i }]))
    for (const u of updates) {
      const uid = u.uniqueId
      const qty = u.quantity
      const current = existingMap.get(uid)
      if (current) {
        const newQty = Math.max(1, Math.min(999, qty))
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
        lineIds = Array.isArray(body.uniqueIds)
          ? body.uniqueIds
          : body.uniqueId
            ? [body.uniqueId]
            : body.productId
              ? [body.productId]
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
    const toRemove = new Set(lineIds.map((s) => String(s).trim()).filter(Boolean))

    const items = existing.filter((i) => !toRemove.has(getUniqueId(i)))

    const updated = await upsertCart(customerId, items)
    return NextResponse.json({ success: true, items: updated.items }, { headers: NO_STORE })
  } catch (error) {
    console.error('[ecommerce/cart/items] DELETE error:', error)
    return NextResponse.json({ success: false, error: 'Failed to remove from cart' }, { status: 500 })
  }
}
