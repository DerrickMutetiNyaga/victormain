import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getShopSessionCookieName } from '@/lib/shop-auth'
import { deleteShopSession } from '@/lib/models/shop-session'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get(getShopSessionCookieName())?.value
    if (sessionId) {
      await deleteShopSession(sessionId)
    }
    cookieStore.delete(getShopSessionCookieName())
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
