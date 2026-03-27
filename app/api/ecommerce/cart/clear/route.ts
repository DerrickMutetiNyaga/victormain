import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getShopSessionFromCookie } from '@/lib/shop-auth'
import { clearCart } from '@/lib/models/shop-cart'

const NO_STORE = { 'Cache-Control': 'no-store' }

async function getSessionCustomerId(): Promise<ObjectId | null> {
  const session = await getShopSessionFromCookie()
  if (!session?.userId) return null
  try {
    return new ObjectId(session.userId)
  } catch {
    return null
  }
}

export async function POST() {
  const customerId = await getSessionCustomerId()
  if (!customerId) {
    return NextResponse.json({ message: 'Not signed in' }, { status: 401 })
  }
  try {
    await clearCart(customerId)
    return NextResponse.json({ success: true, items: [] }, { headers: NO_STORE })
  } catch (error) {
    console.error('[ecommerce/cart/clear] POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to clear cart' }, { status: 500 })
  }
}

