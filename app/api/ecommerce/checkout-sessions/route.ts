import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { getShopSessionFromCookie } from '@/lib/shop-auth'
import { resolveBarOrderLines } from '@/lib/secure-bar-order-lines'
import { filterInventoryStockLineItems } from '@/lib/catha-order-inventory-lines'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit-simple'
import { logOrderSecurityEvent } from '@/lib/order-security-audit'
import { ecommerceOrderCreateSchema, formatZodError } from '@/lib/order-request-schemas'
import { normalizeEcommerceOrderCreateBody } from '@/lib/ecommerce-order-normalize'
import {
  ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION,
  newCheckoutSessionId,
} from '@/lib/ecommerce-checkout-session-constants'
import { ensureEcommerceCheckoutOrderIndexes } from '@/lib/ecommerce-order-from-session'
import {
  ECOMMERCE_RESERVATION_TTL_MS,
  expireCheckoutSessionIfNeeded,
  reserveStockForCheckoutSessionAtomic,
  releaseCheckoutSessionReservation,
} from '@/lib/ecommerce-stock-reservation'
import {
  defaultEcommerceOpeningHours,
  evaluateEcommerceOpeningHours,
  type EcommerceOpeningHoursSettings,
} from '@/lib/ecommerce-opening-hours'

async function resolveDeliveryFeeKes(
  db: Awaited<ReturnType<typeof getDatabase>>,
  body: { deliveryOption?: string; deliveryFee?: number }
): Promise<number> {
  const settings = await db.collection('catha_settings').findOne({})
  const options = (settings as any)?.delivery?.options
  const deliveryOpt = typeof body.deliveryOption === 'string' ? body.deliveryOption.trim() : ''
  if (deliveryOpt && Array.isArray(options)) {
    const opt = options.find((o: any) => o && o.value === deliveryOpt && o.enabled !== false)
    if (opt && typeof opt.fee === 'number' && Number.isFinite(opt.fee) && opt.fee >= 0 && opt.fee <= 50_000) {
      return opt.fee
    }
  }
  const clientFee = Number(body.deliveryFee)
  if (Number.isFinite(clientFee) && clientFee >= 0 && clientFee <= 50_000) {
    return Math.round(clientFee * 100) / 100
  }
  return 0
}

/**
 * POST — create a server-side checkout / payment session (no order row until M-Pesa succeeds).
 */
export async function POST(request: Request) {
  try {
    const session = await getShopSessionFromCookie()
    if (!session?.phone) {
      return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 })
    }

    const ip = getClientIp(request)
    const rl = checkRateLimit(`ecommerce-checkout-session:${ip}`, 25, 60_000)
    if (!rl.ok) {
      logOrderSecurityEvent({
        route: '/api/ecommerce/checkout-sessions',
        action: 'POST',
        userId: session.phone,
        ip,
        userAgent: request.headers.get('user-agent'),
        rejected: true,
        reason: 'rate_limit',
      })
      return NextResponse.json(
        { success: false, error: 'Too many requests', retryAfterMs: rl.retryAfterMs },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      )
    }

    const raw = await request.json()
    const normalized = normalizeEcommerceOrderCreateBody(raw)
    const parsed = ecommerceOrderCreateSchema.safeParse(normalized)
    if (!parsed.success) {
      logOrderSecurityEvent({
        route: '/api/ecommerce/checkout-sessions',
        action: 'POST',
        userId: session.phone,
        ip,
        userAgent: request.headers.get('user-agent'),
        rejected: true,
        reason: 'schema_validation',
        requestSummary: { details: parsed.error.flatten() },
      })
      return NextResponse.json({ success: false, ...formatZodError(parsed.error) }, { status: 400 })
    }

    const body = parsed.data
    const db = await getDatabase('infusion_jaba')

    const settingsDoc = await db.collection('catha_settings').findOne({})
    const hoursRaw = (settingsDoc as { ecommerceOpeningHours?: unknown } | null)?.ecommerceOpeningHours
    const hoursMerged: EcommerceOpeningHoursSettings = {
      ...defaultEcommerceOpeningHours,
      ...(hoursRaw && typeof hoursRaw === 'object' ? (hoursRaw as object) : {}),
    }
    const hoursEval = evaluateEcommerceOpeningHours(hoursMerged, new Date())
    if (hoursEval.isClosed && hoursMerged.blockCheckoutWhenClosed) {
      return NextResponse.json(
        { success: false, error: hoursEval.message, code: 'ECOMMERCE_CLOSED' },
        { status: 403 }
      )
    }

    const staleSessions = await db
      .collection(ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION)
      .find({
        shopUserId: session.userId,
        status: 'pending_payment',
        reservationExpiresAt: { $lt: new Date() },
      })
      .project({ id: 1 })
      .limit(12)
      .toArray()
    for (const s of staleSessions) {
      await expireCheckoutSessionIfNeeded(db, s.id as string)
    }

    await ensureEcommerceCheckoutOrderIndexes(db)
    try {
      await db.collection(ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION).createIndex({ id: 1 }, { unique: true })
      await db.collection(ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION).createIndex({ shopUserId: 1, createdAt: -1 })
    } catch (e: unknown) {
      const code = (e as { code?: number })?.code
      if (code !== 85 && code !== 86) {
        console.warn('[ecommerce-checkout-sessions] index ensure:', (e as Error)?.message)
      }
    }

    const rawLines = body.items.map((i) => ({
      productId: i.productId ?? i.id,
      quantity: i.quantity,
      size: i.size,
      selectedSize: i.selectedSize,
    }))

    const priced = await resolveBarOrderLines(db, rawLines as unknown[], {
      allowCustomLines: false,
      rejectCustomLines: true,
    })
    if (!priced.ok) {
      logOrderSecurityEvent({
        route: '/api/ecommerce/checkout-sessions',
        action: 'POST',
        userId: session.phone,
        ip,
        userAgent: request.headers.get('user-agent'),
        rejected: true,
        reason: priced.code,
        requestSummary: { itemCount: body.items.length },
      })
      return NextResponse.json({ success: false, error: priced.error, code: priced.code }, { status: 400 })
    }

    const deliveryFee = await resolveDeliveryFeeKes(db, body)
    const serverSubtotal = priced.subtotal
    const serverVat = 0
    const serverTotal = serverSubtotal + deliveryFee

    const sessionId = newCheckoutSessionId()
    const snapshot = {
      customerName: (body.customerName ?? '').trim(),
      customerEmail: (body.customerEmail ?? '').trim(),
      deliveryAddress: (body.deliveryAddress ?? '').trim(),
      city: (body.city ?? '').trim(),
      postalCode: (body.postalCode ?? '').trim(),
      deliveryNotes: (body.deliveryNotes ?? '').trim(),
      deliveryOption: body.deliveryOption?.trim() || null,
      items: priced.items,
      subtotal: serverSubtotal,
      vat: serverVat,
      deliveryFee,
      total: serverTotal,
      discountTotal: 0,
    }

    const reserve = await reserveStockForCheckoutSessionAtomic(db, sessionId, session.phone, priced.items)
    if (!reserve.ok) {
      logOrderSecurityEvent({
        route: '/api/ecommerce/checkout-sessions',
        action: 'POST',
        userId: session.phone,
        ip,
        userAgent: request.headers.get('user-agent'),
        rejected: true,
        reason: 'stock_reserve_failed',
        requestSummary: { sessionId, error: reserve.error },
      })
      return NextResponse.json({ success: false, error: reserve.error, code: 'STOCK_RESERVE' }, { status: 400 })
    }

    const now = new Date()
    const reservationExpiresAt = new Date(now.getTime() + ECOMMERCE_RESERVATION_TTL_MS)
    const reservationHoldActive = filterInventoryStockLineItems(priced.items).length > 0

    const checkoutSession = {
      id: sessionId,
      status: 'pending_payment' as const,
      shopUserId: session.userId,
      customerPhone: session.phone,
      amountExpected: serverTotal,
      snapshot,
      orderId: null as string | null,
      mpesaCheckoutRequestId: null as string | null,
      mpesaReceiptNumber: null as string | null,
      reservationHoldActive,
      reservationExpiresAt,
      reservationConsumedAt: null as Date | null,
      reservationReleasedAt: null as Date | null,
      createdAt: now,
      updatedAt: now,
    }

    try {
      await db.collection(ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION).insertOne(checkoutSession)
    } catch (insertErr) {
      await releaseCheckoutSessionReservation(db, {
        id: sessionId,
        customerPhone: session.phone,
        reservationHoldActive: true,
        snapshot,
      })
      console.error('[ecommerce-checkout] session_insert_failed_after_reserve', {
        sessionId,
        message: (insertErr as Error)?.message,
      })
      throw insertErr
    }

    console.log('[ecommerce-checkout] session_created', { sessionId, total: serverTotal })

    logOrderSecurityEvent({
      route: '/api/ecommerce/checkout-sessions',
      action: 'POST_create',
      userId: session.phone,
      ip,
      userAgent: request.headers.get('user-agent'),
      resolvedDbPrices: priced.dbPricesBySku,
      computedTotals: { subtotal: serverSubtotal, vat: serverVat, total: serverTotal },
      requestSummary: { sessionId, deliveryFee },
    })

    return NextResponse.json(
      {
        success: true,
        checkoutSession: {
          id: sessionId,
          total: serverTotal,
          subtotal: serverSubtotal,
          deliveryFee,
          vat: serverVat,
          items: priced.items,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[ecommerce-checkout-sessions] POST', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create checkout session', message: error.message },
      { status: 500 }
    )
  }
}
