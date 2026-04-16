import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { normalizeKenyaPhone } from '@/lib/phone-utils'
import { getShopSessionFromCookie } from '@/lib/shop-auth'
import { auth, requireCathaPermission } from '@/lib/auth-catha'
import { assertPaidForStaffEcommerceCompletion } from '@/lib/ecommerce-staff-order-completion'
import { deductStockAtomic, restoreStockAtomic, validateStockForItems } from '@/lib/inventory-ops'
import { filterInventoryStockLineItems } from '@/lib/catha-order-inventory-lines'
import { getClientIp } from '@/lib/rate-limit-simple'
import { logOrderSecurityEvent } from '@/lib/order-security-audit'
import { ecommerceStaffOrderPutSchema, formatZodError } from '@/lib/order-request-schemas'
import { resolveEcommerceOrdersPutDenialWhenNotStaff } from '@/lib/ecommerce-orders-put-gate'

/** PUT is not a customer API — only Catha staff with `sales.orders` edit may mutate. */
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

    /** Shop history: only paid ecommerce orders in `orders` (unpaid flow lives in checkout sessions only). */
    const paidEcommerceFilter = {
      paymentStatus: { $in: ['PAID', 'OVERPAID', 'PARTIALLY_PAID', 'COMPLETED'] },
    }

    const query = { $and: [typeFilter, customerFilter, paidEcommerceFilter] }

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

/** Unpaid ecommerce rows are never inserted from the shop; use POST /api/ecommerce/checkout-sessions + M-Pesa. */
export async function POST(request: Request) {
  void request
  console.warn('[ecommerce-orders] POST blocked — unpaid ecommerce order creation removed')
  return NextResponse.json(
    {
      success: false,
      error:
        'Creating unpaid ecommerce orders is disabled. Complete checkout via a payment session and M-Pesa STK.',
    },
    { status: 403 }
  )
}

export async function PUT(request: Request) {
  try {
    const ip = getClientIp(request)
    const userAgent = request.headers.get('user-agent')
    const shopSession = await getShopSessionFromCookie()
    const staffGate = await requireCathaPermission('sales.orders', 'edit')

    if (!staffGate.allowed) {
      const cathaEmail = (await auth())?.user?.email ?? null
      const denialKind = resolveEcommerceOrdersPutDenialWhenNotStaff({
        hasCathaUserEmail: Boolean(cathaEmail),
        hasShopPhone: Boolean(shopSession?.phone),
      })
      if (denialKind === 'catha_denied') {
        if (staffGate.response?.status === 403) {
          logOrderSecurityEvent({
            route: '/api/ecommerce/orders',
            action: 'PUT',
            userId: cathaEmail ?? undefined,
            ip,
            userAgent,
            rejected: true,
            reason: 'catha_insufficient_permission_ecommerce_put',
            requestSummary: { message: 'Catha session cannot mutate ecommerce orders without sales.orders edit' },
          })
        }
        return staffGate.response ?? NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }
      if (denialKind === 'shop_denied') {
        const shopPhone = shopSession?.phone ?? ''
        logOrderSecurityEvent({
          route: '/api/ecommerce/orders',
          action: 'PUT',
          userId: shopPhone || undefined,
          ip,
          userAgent,
          rejected: true,
          reason: 'shop_session_order_put_forbidden',
          requestSummary: { message: 'Customer sessions cannot mutate ecommerce orders via PUT' },
        })
        return NextResponse.json(
          {
            success: false,
            error: 'Order updates are not available for shop sessions. Contact support if you need help.',
          },
          { status: 403 }
        )
      }
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const staffSession = await auth()
    const staffEmail = (staffSession?.user as { email?: string } | undefined)?.email ?? null

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = ecommerceStaffOrderPutSchema.safeParse(raw)
    if (!parsed.success) {
      logOrderSecurityEvent({
        route: '/api/ecommerce/orders',
        action: 'PUT',
        userId: staffEmail,
        ip,
        userAgent,
        rejected: true,
        reason: 'schema_validation',
        requestSummary: { details: parsed.error.flatten() },
      })
      return NextResponse.json({ success: false, ...formatZodError(parsed.error) }, { status: 400 })
    }

    const { id, status: nextStatus } = parsed.data
    const db = await getDatabase('infusion_jaba')
    const existingOrder = await db.collection('orders').findOne({ id, type: 'ecommerce' })

    if (!existingOrder) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const stockActor = staffEmail || 'System'

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    const inventoryItems = filterInventoryStockLineItems(existingOrder.items)
    const oldStatus = existingOrder.status

    if (nextStatus === 'cancelled') {
      if (oldStatus === 'cancelled') {
        return NextResponse.json({ success: true })
      }
      updateData.status = 'cancelled'
      const wasStockDeducted = existingOrder.stockDeducted === true
      if (wasStockDeducted && inventoryItems.length > 0) {
        for (const item of inventoryItems) {
          await restoreStockAtomic(
            db,
            item.productId,
            Number(item.quantity),
            id,
            stockActor,
            item.name || 'Unknown',
            'order_cancelled'
          )
        }
        updateData.stockDeducted = false
        updateData.stockReleasedAt = new Date()
      }
    } else {
      if (oldStatus === 'completed') {
        return NextResponse.json({ success: true })
      }
      const paidOk = assertPaidForStaffEcommerceCompletion(
        existingOrder as { paymentStatus?: unknown }
      )
      if (!paidOk.ok) {
        logOrderSecurityEvent({
          route: '/api/ecommerce/orders',
          action: 'PUT',
          userId: staffEmail,
          ip,
          userAgent,
          rejected: true,
          reason: 'ecommerce_complete_requires_paid',
          requestSummary: { id },
        })
        return NextResponse.json({ success: false, error: paidOk.message }, { status: 400 })
      }
      updateData.status = 'completed'
      if (!existingOrder.stockDeducted && inventoryItems.length > 0) {
        const validation = await validateStockForItems(db, inventoryItems)
        if (!validation.ok) {
          return NextResponse.json(
            {
              success: false,
              error: validation.error,
              productId: validation.productId,
              productName: validation.productName,
              available: validation.available,
            },
            { status: 400 }
          )
        }
        const deducted: Array<{ productId: string; quantity: number; name?: string }> = []
        for (const item of inventoryItems) {
          const qty = Number(item.quantity)
          const res = await deductStockAtomic(db, item.productId, qty, id, stockActor, item.name)
          if (!res.success) {
            for (const d of deducted) {
              await restoreStockAtomic(
                db,
                d.productId,
                d.quantity,
                id,
                stockActor,
                d.name || 'Unknown',
                'order_cancelled'
              )
            }
            return NextResponse.json({ success: false, error: res.error }, { status: 400 })
          }
          deducted.push({ productId: item.productId, quantity: qty, name: item.name })
        }
        updateData.stockDeducted = true
        updateData.stockDeductedAt = new Date()
        updateData.stockReleasedAt = null
      }
    }

    const result = await db.collection('orders').updateOne(
      { id, type: 'ecommerce' },
      { $set: updateData }
    )
    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    logOrderSecurityEvent({
      route: '/api/ecommerce/orders',
      action: nextStatus === 'cancelled' ? 'PUT_staff_cancel' : 'PUT_staff_complete',
      userId: staffEmail ?? undefined,
      ip,
      userAgent,
      requestSummary: { id, fromStatus: oldStatus, toStatus: nextStatus },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating e-commerce order:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update order', message: error.message },
      { status: 500 }
    )
  }
}
