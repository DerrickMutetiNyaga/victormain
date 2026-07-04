import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { getShopSessionFromCookie } from '@/lib/shop-auth'
import { normalizeKenyaPhone } from '@/lib/phone-utils'
import { ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION } from '@/lib/ecommerce-checkout-session-constants'
import { expireCheckoutSessionIfNeeded, releaseHoldAndUpdateSessionStatus } from '@/lib/ecommerce-stock-reservation'
import { getClientIp } from '@/lib/rate-limit-simple'
import { logOrderSecurityEvent } from '@/lib/order-security-audit'

function phonesMatchCustomer(sessionPhone: string, sessionDocPhone: string | undefined): boolean {
  if (!sessionDocPhone) return false
  const a = normalizeKenyaPhone(sessionPhone) || sessionPhone.trim()
  const b = normalizeKenyaPhone(sessionDocPhone) || sessionDocPhone.trim()
  if (a && b && a === b) return true
  return sessionPhone.trim() === sessionDocPhone.trim()
}

type Ctx = { params: Promise<{ id: string }> }

/** GET — poll session status / resolved order id after payment (shop session only). */
export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const shop = await getShopSessionFromCookie()
    if (!shop?.phone) {
      return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 })
    }

    const db = await getDatabase('infusion_jaba')
    await expireCheckoutSessionIfNeeded(db, id)
    const doc = await db.collection(ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION).findOne({ id })
    if (!doc || !phonesMatchCustomer(shop.phone, doc.customerPhone)) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      id: doc.id,
      status: doc.status,
      orderId: doc.orderId ?? null,
      amountExpected: doc.amountExpected,
      needsAdminReview: doc.needsAdminReview === true,
    })
  } catch (e: any) {
    console.error('[checkout-sessions GET]', e)
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
  }
}

/**
 * PATCH — mark session abandoned (no order). Only from pending_payment.
 * body: { "action": "abandon" }
 */
export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const shop = await getShopSessionFromCookie()
    if (!shop?.phone) {
      return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 })
    }

    let body: { action?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }
    if (body.action !== 'abandon') {
      return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 })
    }

    const db = await getDatabase('infusion_jaba')
    const doc = await db.collection(ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION).findOne({ id })
    if (!doc || !phonesMatchCustomer(shop.phone, doc.customerPhone)) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    if (doc.status !== 'pending_payment') {
      return NextResponse.json({ success: true, status: doc.status, skipped: true })
    }

    await releaseHoldAndUpdateSessionStatus(db, doc as any, 'abandoned')

    const ip = getClientIp(request)
    logOrderSecurityEvent({
      route: '/api/ecommerce/checkout-sessions/[id]',
      action: 'PATCH_abandon',
      userId: shop.phone,
      ip,
      userAgent: request.headers.get('user-agent'),
      requestSummary: { sessionId: id, modified: 1 },
    })

    console.log('[ecommerce-checkout] session_abandoned', { sessionId: id })

    return NextResponse.json({ success: true, status: 'abandoned' })
  } catch (e: any) {
    console.error('[checkout-sessions PATCH]', e)
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
  }
}
