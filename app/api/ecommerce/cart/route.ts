import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getShopSessionFromCookie } from '@/lib/shop-auth'
import { getCartByCustomerId, upsertCart, clearCart } from '@/lib/models/shop-cart'

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
  try {
    const body = await request.json()
    const items = Array.isArray(body.items) ? body.items : []
    if (!items.every(
      (i: any) =>
        typeof i?.id === 'string' &&
        typeof i?.name === 'string' &&
        typeof i?.price === 'number' &&
        typeof i?.quantity === 'number' &&
        typeof i?.image === 'string'
    )) {
      return NextResponse.json({ success: false, error: 'Invalid cart items' }, { status: 400 })
    }
    const cart = await upsertCart(customerId, items)
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
