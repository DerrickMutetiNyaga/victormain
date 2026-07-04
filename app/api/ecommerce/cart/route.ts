import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getShopSessionFromCookie } from '@/lib/shop-auth'
import { getCartByCustomerId, upsertCart, clearCart } from '@/lib/models/shop-cart'
import { getDatabase } from '@/lib/mongodb'
import { resolveShopCartLines } from '@/lib/secure-bar-order-lines'
import { shopCartReplaceSchema, formatZodError } from '@/lib/order-request-schemas'
import { normalizeCartReplaceBody } from '@/lib/shop-cart-normalize'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit-simple'

async function getSessionCustomerId(): Promise<ObjectId | null> {
  const session = await getShopSessionFromCookie()
  if (!session?.userId) return null
  try {
    return new ObjectId(session.userId)
  } catch {
    return null
  }
}

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET() {
  const customerId = await getSessionCustomerId()
  if (!customerId) {
    return NextResponse.json({ message: 'Not signed in' }, { status: 401 })
  }
  try {
    const cart = await getCartByCustomerId(customerId)
    const items = cart?.items ?? []
    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error('[ecommerce/cart] GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load cart' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const customerId = await getSessionCustomerId()
  if (!customerId) {
    return NextResponse.json({ message: 'Not signed in' }, { status: 401 })
  }
  const ip = getClientIp(request)
  const rl = checkRateLimit(`ecom-cart-post:${ip}`, 60, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }
  try {
    const raw = await request.json()
    const normalized = normalizeCartReplaceBody(raw) ?? raw
    const parsed = shopCartReplaceSchema.safeParse(normalized)
    if (!parsed.success) {
      return NextResponse.json({ success: false, ...formatZodError(parsed.error) }, { status: 400 })
    }
    const db = await getDatabase('infusion_jaba')
    const lines = parsed.data.items.map((l) => ({
      productId: String(l.productId || l.id).trim(),
      quantity: l.quantity,
      size: l.size,
    }))
    const resolved = await resolveShopCartLines(db, lines)
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error, code: resolved.code }, { status: 400 })
    }
    const cart = await upsertCart(customerId, resolved.items)
    return NextResponse.json({ success: true, items: cart.items }, { headers: NO_STORE })
  } catch (error) {
    console.error('[ecommerce/cart] POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to save cart' }, { status: 500 })
  }
}

export async function DELETE() {
  const customerId = await getSessionCustomerId()
  if (!customerId) {
    return NextResponse.json({ message: 'Not signed in' }, { status: 401 })
  }
  try {
    await clearCart(customerId)
    return NextResponse.json({ success: true, items: [] }, { headers: NO_STORE })
  } catch (error) {
    console.error('[ecommerce/cart] DELETE error:', error)
    return NextResponse.json({ success: false, error: 'Failed to clear cart' }, { status: 500 })
  }
}
