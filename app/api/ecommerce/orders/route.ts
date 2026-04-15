import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { normalizeKenyaPhone } from '@/lib/phone-utils'
import { getShopSessionFromCookie } from '@/lib/shop-auth'
import { restoreStockAtomic } from '@/lib/inventory-ops'
import { filterInventoryStockLineItems } from '@/lib/catha-order-inventory-lines'
import { resolveBarOrderLines } from '@/lib/secure-bar-order-lines'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit-simple'
import { logOrderSecurityEvent } from '@/lib/order-security-audit'
import {
  ecommerceOrderCreateSchema,
  ecommerceOrderCancelSchema,
  formatZodError,
} from '@/lib/order-request-schemas'
import { normalizeEcommerceOrderCreateBody } from '@/lib/ecommerce-order-normalize'

async function getSessionPhone(): Promise<string | null> {
  const session = await getShopSessionFromCookie()
  return session?.phone ?? null
}

function phonesMatch(orderPhone: string | undefined, sessionPhone: string): boolean {
  const a = normalizeKenyaPhone(orderPhone || '') || orderPhone?.trim()
  const b = normalizeKenyaPhone(sessionPhone) || sessionPhone.trim()
  if (a && b && a === b) return true
  const variants = new Set<string>()
  if (orderPhone) {
    variants.add(orderPhone.trim())
    const n = normalizeKenyaPhone(orderPhone)
    if (n) {
      variants.add(n)
      if (n.startsWith('+')) variants.add(n.slice(1))
      if (n.startsWith('+254')) variants.add(`0${n.slice(4)}`)
    }
  }
  if (variants.has(sessionPhone.trim())) return true
  const nb = normalizeKenyaPhone(sessionPhone)
  if (nb && variants.has(nb)) return true
  return false
}

async function resolveDeliveryFeeKes(
  db: Awaited<ReturnType<typeof getDatabase>>,
  body: { deliveryOption?: string; deliveryFee?: number }
): Promise<number> {
  const settings = await db.collection('catha_settings').findOne({})
  const options = (settings as any)?.delivery?.options
  const deliveryOpt = typeof body.deliveryOption === 'string' ? body.deliveryOption.trim() : ''
  if (deliveryOpt && Array.isArray(options)) {
    const opt = options.find(
      (o: any) => o && o.value === deliveryOpt && o.enabled !== false
    )
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

export async function GET(request: Request) {
  try {
    const session = await getShopSessionFromCookie()
    if (!session?.phone) {
      return NextResponse.json(
        { success: false, error: 'Sign in required to view your orders.' },
        { status: 401 }
      )
    }
    const phone = session.phone

    const db = await getDatabase('infusion_jaba')

    // Build query: ecommerce orders (or legacy without type) for this customer
    const typeFilter = { $or: [{ type: 'ecommerce' }, { type: { $exists: false } }] }
    const normalizedPhone = normalizeKenyaPhone(phone)
    const phones = [phone]
    if (normalizedPhone) {
      phones.push(normalizedPhone)
      if (normalizedPhone.startsWith('+')) phones.push(normalizedPhone.slice(1))
      if (normalizedPhone.startsWith('+254')) phones.push(`0${normalizedPhone.slice(4)}`)
    }
    const customerFilter = { $or: [...new Set(phones)].map(p => ({ customerPhone: p })) }

    const query = { $and: [typeFilter, customerFilter] }

    const orders = await db.collection('orders').find(query).sort({ timestamp: -1 }).toArray()

    // Format orders for response
    const formattedOrders = orders.map((order: any) => {
      const ts = order.timestamp ?? order.createdAt
      const createdAt = order.createdAt
        ? (order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt))
        : (order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp || Date.now()))
      return {
        id: order.id || order._id?.toString(),
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        deliveryAddress: order.deliveryAddress,
        city: order.city,
        postalCode: order.postalCode,
        deliveryNotes: order.deliveryNotes,
        items: order.items || [],
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee || 0,
        total: order.total,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        mpesaReceiptNumber: order.mpesaReceiptNumber,
        status: order.status,
        timestamp: ts instanceof Date ? ts.toISOString() : (ts ? new Date(ts).toISOString() : new Date().toISOString()),
        createdAt: createdAt instanceof Date ? createdAt.toISOString() : new Date().toISOString(),
      }
    })

    // Deduplicate by id (keep first occurrence - most recent due to sort)
    const seen = new Set<string>()
    const uniqueOrders = formattedOrders.filter((o) => {
      const id = o.id || ''
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })

    return NextResponse.json({ success: true, orders: uniqueOrders })
  } catch (error: any) {
    console.error('Error fetching e-commerce orders:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders', message: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getShopSessionFromCookie()
    if (!session?.phone) {
      return NextResponse.json({ message: 'Not signed in' }, { status: 401 })
    }

    const ip = getClientIp(request)
    const rl = checkRateLimit(`ecommerce-orders-post:${ip}`, 25, 60_000)
    if (!rl.ok) {
      logOrderSecurityEvent({
        route: '/api/ecommerce/orders',
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
        route: '/api/ecommerce/orders',
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
        route: '/api/ecommerce/orders',
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

    const order = {
      id: body.id || `ECO${Date.now().toString().slice(-8)}`,
      type: 'ecommerce' as const,
      customerName: (body.customerName ?? '').trim(),
      customerPhone: session.phone,
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
      paymentMethod: 'mpesa',
      paymentStatus: 'PENDING' as const,
      mpesaReceiptNumber: null as string | null,
      status: 'pending',
      timestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      stockDeducted: false,
      stockDeductedAt: null as Date | null,
    }

    logOrderSecurityEvent({
      route: '/api/ecommerce/orders',
      action: 'POST',
      userId: session.phone,
      ip,
      userAgent: request.headers.get('user-agent'),
      resolvedDbPrices: priced.dbPricesBySku,
      computedTotals: { subtotal: serverSubtotal, vat: serverVat, total: serverTotal },
      requestSummary: { orderId: order.id, deliveryFee },
    })

    // Duplicate detection: Check for similar ecommerce orders created within the last 5 seconds
    const fiveSecondsAgo = new Date(Date.now() - 5000)

    const itemsFingerprint = JSON.stringify(
      order.items
        .map((item: any) => ({ productId: item.productId, quantity: item.quantity }))
        .sort((a: any, b: any) => (a.productId || '').localeCompare(b.productId || ''))
    )

    const recentOrders = await db.collection('orders').find({
      type: 'ecommerce',
      customerPhone: order.customerPhone,
      total: order.total,
      timestamp: { $gte: fiveSecondsAgo },
    }).toArray()

    for (const recentOrder of recentOrders) {
      const recentItemsFingerprint = JSON.stringify(
        (recentOrder.items || [])
          .map((item: any) => ({ productId: item.productId, quantity: item.quantity }))
          .sort((a: any, b: any) => (a.productId || '').localeCompare(b.productId || ''))
      )

      if (recentItemsFingerprint === itemsFingerprint) {
        console.log('[Ecommerce Orders API] Duplicate order detected:', {
          existingId: recentOrder.id,
          newId: order.id,
          customerPhone: order.customerPhone,
          total: order.total,
        })
        return NextResponse.json({ success: true, order: recentOrder }, { status: 200 })
      }
    }

    await db.collection('orders').insertOne(order)

    return NextResponse.json({ success: true, order }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating e-commerce order:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create order', message: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getShopSessionFromCookie()
    if (!session?.phone) {
      return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 })
    }

    const raw = await request.json()
    const parsed = ecommerceOrderCancelSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ success: false, ...formatZodError(parsed.error) }, { status: 400 })
    }
    const { id } = parsed.data
    const db = await getDatabase('infusion_jaba')

    const existingOrder = await db.collection('orders').findOne({ id, type: 'ecommerce' })
    if (!existingOrder) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    if (!phonesMatch(existingOrder.customerPhone, session.phone)) {
      logOrderSecurityEvent({
        route: '/api/ecommerce/orders',
        action: 'PUT',
        userId: session.phone,
        rejected: true,
        reason: 'forbidden_not_owner',
        requestSummary: { id },
      })
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {
      status: 'cancelled',
      updatedAt: new Date(),
    }

    const oldStatus = existingOrder.status
    const wasStockDeducted = existingOrder.stockDeducted === true
    const userId = existingOrder.customerPhone || existingOrder.customerEmail || 'System'

    const inventoryItems = filterInventoryStockLineItems(existingOrder.items)

    if (wasStockDeducted && inventoryItems.length > 0) {
      for (const item of inventoryItems) {
        await restoreStockAtomic(
          db, item.productId, Number(item.quantity), id, userId, item.name || 'Unknown', 'order_cancelled'
        )
      }
      updateData.stockDeducted = false
      updateData.stockReleasedAt = new Date()
    }

    const result = await db.collection('orders').updateOne({ id }, { $set: updateData })
    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    if (oldStatus !== 'cancelled') {
      logOrderSecurityEvent({
        route: '/api/ecommerce/orders',
        action: 'PUT_cancel',
        userId: session.phone,
        requestSummary: { id },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating e-commerce order:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update order', message: error.message },
      { status: 500 }
    )
  }
}
