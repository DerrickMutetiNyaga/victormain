import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions, hasCathaPermission } from '@/lib/catha-permissions-model'

// Mutations (create/update/delete) must never be cached - money/stock changes
function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init)
  res.headers.set('Cache-Control', 'no-store')
  return res
}
import {
  validateStockForItems,
  deductStockAtomic,
  restoreStockAtomic,
  diffOrderItems,
} from '@/lib/inventory-ops'
import { formatCathaOrderForApi } from '@/lib/catha-order-payments'
import { baseLinkedListFromOrder } from '@/lib/catha-append-mpesa-payment'
import { deleteAllAllocationsForOrder, refreshMpesaTransactionLinkMetadata } from '@/lib/catha-mpesa-order-allocations'
import { filterInventoryStockLineItems, orderLineFingerprintParts } from '@/lib/catha-order-inventory-lines'
import { buildOrdersListMongoFilter, mergeCathaOrdersMainListFilter } from '@/lib/catha-orders-list-filter'
import { computeOrdersDashboardSummary } from '@/lib/catha-orders-dashboard-summary'
import {
  resolveBarOrderLines,
  deriveInitialPaymentStatusForCatha,
} from '@/lib/secure-bar-order-lines'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit-simple'
import { logOrderSecurityEvent } from '@/lib/order-security-audit'
import {
  cathaStaffOrderCreateSchema,
  cathaStaffOrderUpdateSchema,
  formatZodError,
} from '@/lib/order-request-schemas'
import { maybeSendCathaPaymentReceiptSms } from '@/lib/catha-payment-sms'

function orderDocumentToJson(order: any) {
  const pay = formatCathaOrderForApi(order)
  return {
    id: order.id || order._id?.toString(),
    table: order.table,
    orderType: order.orderType || 'INHOUSE',
    orderSource: order.orderSource || null,
    items: order.items || [],
    subtotal: order.subtotal,
    vat: order.vat,
    total: order.total,
    paymentMethod: order.paymentMethod,
    ...pay,
    mpesaTransactionId: order.mpesaTransactionId || null,
    mpesaReceiptNumber: order.mpesaReceiptNumber || null,
    linkedAt: order.linkedAt || null,
    linkedBy: order.linkedBy || null,
    glovoOrderNumber: order.glovoOrderNumber || null,
    cardTransactionReference: order.cardTransactionReference || null,
    paymentReference: order.paymentReference || null,
    reference: order.reference || null,
    paidAmount: order.paidAmount ?? null,
    paidAt: order.paidAt || null,
    paidBy: order.paidBy || null,
    cashAmount: order.cashAmount || null,
    cashBalance: order.cashBalance || null,
    changeGiven: order.changeGiven === true,
    changeGivenAt: order.changeGivenAt || null,
    changeGivenBy: order.changeGivenBy || null,
    changeNotes: order.changeNotes || null,
    cashier: order.cashier,
    waiter: order.waiter,
    customerName: order.customerName || null,
    customerPhone: order.customerPhone || null,
    paymentReceiptSmsStatus: order.paymentReceiptSmsStatus || null,
    paymentReceiptSmsSentAt: order.paymentReceiptSmsSentAt || null,
    paymentReceiptSmsPhone: order.paymentReceiptSmsPhone || null,
    paymentReceiptSmsLastError: order.paymentReceiptSmsLastError || null,
    timestamp: order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp),
    status: order.status,
  }
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = ((session.user as any).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'orders', 'view')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    const db = await getDatabase('infusion_jaba')

    if (searchParams.get('summaryOnly') === '1') {
      const summary = await computeOrdersDashboardSummary(db)
      const res = NextResponse.json(summary)
      res.headers.set('Cache-Control', 'no-store')
      return res
    }

    const paged = searchParams.get('paged') === '1'
    if (paged) {
      const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '72', 10), 1), 72)
      const skip = Math.max(parseInt(searchParams.get('skip') || '0', 10), 0)
      const q = searchParams.get('q') || ''
      const paymentMethodRaw = (searchParams.get('paymentMethod') || 'all').toLowerCase()
      const paymentStatusRaw = (searchParams.get('paymentStatus') || 'all').toUpperCase()
      const lifecycle = searchParams.get('lifecycle') === 'cancelled' ? 'cancelled' : 'all'
      const paymentMethod = (['all', 'glovo', 'mpesa', 'card'].includes(paymentMethodRaw)
        ? paymentMethodRaw
        : 'all') as 'all' | 'glovo' | 'mpesa' | 'card'
      const paymentStatus = (['all', 'PAID', 'PARTIALLY_PAID', 'NOT_PAID'].includes(paymentStatusRaw)
        ? paymentStatusRaw
        : 'all') as 'all' | 'PAID' | 'PARTIALLY_PAID' | 'NOT_PAID'

      const filter = mergeCathaOrdersMainListFilter(
        buildOrdersListMongoFilter({ q, paymentMethod, paymentStatus, lifecycle })
      )
      const coll = db.collection('orders')
      const [total, rawList] = await Promise.all([
        coll.countDocuments(filter),
        coll.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).toArray(),
      ])
      const orders = rawList.map((order: any) => orderDocumentToJson(order))
      const res = NextResponse.json({ orders, total, limit, skip })
      res.headers.set('Cache-Control', 'no-store')
      return res
    }
    
    // If ID is provided, fetch single order
    if (id) {
      const order = await db.collection('orders').findOne({ id })
      
      if (!order) {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(orderDocumentToJson(order))
    }
    
    // Fetch orders: ?limit=200&skip=0 (default 200 newest, supports pagination)
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500)
    const skip = parseInt(searchParams.get('skip') || '0')
    const orders = await db.collection('orders')
      .find(mergeCathaOrdersMainListFilter({}))
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()
    
    // Convert MongoDB _id and date strings to proper format
    const formattedOrders = orders.map((order: any) => orderDocumentToJson(order))
    
    const res = NextResponse.json(formattedOrders)
    // Orders state: short TTL - 3s cache, 5s SWR (near real-time for POS)
    res.headers.set('Cache-Control', 'public, s-maxage=3, stale-while-revalidate=5, max-age=3')
    return res
  } catch (error: any) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders', message: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = ((session.user as any).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'orders', 'add')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  try {
    const ip = getClientIp(request)
    const rl = checkRateLimit(`catha-orders-post:${ip}`, 40, 60_000)
    if (!rl.ok) {
      logOrderSecurityEvent({
        route: '/api/catha/orders',
        action: 'POST',
        userId: (session.user as any)?.email ?? null,
        role,
        ip,
        userAgent: request.headers.get('user-agent'),
        rejected: true,
        reason: 'rate_limit',
      })
      return NextResponse.json(
        { error: 'Too many requests', retryAfterMs: rl.retryAfterMs },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      )
    }

    const rawBody = await request.json()
    const parsedIn = cathaStaffOrderCreateSchema.safeParse(rawBody)
    if (!parsedIn.success) {
      logOrderSecurityEvent({
        route: '/api/catha/orders',
        action: 'POST',
        userId: (session.user as any)?.email ?? null,
        role,
        ip,
        userAgent: request.headers.get('user-agent'),
        rejected: true,
        reason: 'schema_validation',
        requestSummary: { details: parsedIn.error.flatten() },
      })
      return NextResponse.json(formatZodError(parsedIn.error), { status: 400 })
    }
    const body = parsedIn.data
    if (typeof body.clientEditingOrderId === 'string' && body.clientEditingOrderId.trim() !== '') {
      console.warn('[Orders API] POST rejected: clientEditingOrderId set — updates must use PUT', body.clientEditingOrderId)
      return NextResponse.json(
        { error: 'Cannot create a new order while editing an existing order. Use PUT to update.' },
        { status: 400 }
      )
    }
    const db = await getDatabase('infusion_jaba')

    const allowCustomLines =
      role === 'SUPER_ADMIN' || hasCathaPermission(perms, 'orders', 'edit')

    const priced = await resolveBarOrderLines(db, body.items as unknown[], {
      allowCustomLines,
      rejectCustomLines: false,
    })
    if (!priced.ok) {
      logOrderSecurityEvent({
        route: '/api/catha/orders',
        action: 'POST',
        userId: (session.user as any)?.email ?? null,
        role,
        ip,
        userAgent: request.headers.get('user-agent'),
        rejected: true,
        reason: priced.code,
        requestSummary: {
          itemCount: body.items.length,
          orderSource: body.orderSource,
        },
      })
      return NextResponse.json({ error: priced.error, code: priced.code }, { status: 400 })
    }

    const staffEmail = (session.user as any)?.email ?? null
    const paymentStatus = deriveInitialPaymentStatusForCatha(body)

    const order = {
      id: body.id || `TXN${Date.now().toString().slice(-8)}`,
      table: body.table,
      orderType: body.orderType || 'INHOUSE',
      orderSource: body.orderSource || 'pos',
      items: priced.items,
      subtotal: priced.subtotal,
      vat: priced.vat,
      total: priced.total,
      paymentMethod: body.paymentMethod,
      paymentStatus,
      glovoOrderNumber: typeof body.glovoOrderNumber === 'string' ? body.glovoOrderNumber.trim() || null : null,
      cashAmount: body.cashAmount ?? null,
      cashBalance: body.cashBalance ?? null,
      cashier: staffEmail || 'System',
      waiter: body.waiter ?? null,
      customerName: body.customerName ?? null,
      customerPhone: body.customerPhone ?? null,
      timestamp: new Date(),
      status: body.status || 'pending',
      stockDeducted: false,
      stockDeductedAt: null as Date | null,
    }

    logOrderSecurityEvent({
      route: '/api/catha/orders',
      action: 'POST',
      userId: staffEmail,
      role,
      ip,
      userAgent: request.headers.get('user-agent'),
      rejected: false,
      requestSummary: {
        orderSource: order.orderSource,
        itemCount: order.items.length,
      },
      resolvedDbPrices: priced.dbPricesBySku,
      computedTotals: { subtotal: priced.subtotal, vat: priced.vat, total: priced.total },
    })

    console.log('[Orders API] CREATE (POST) request:', {
      action: 'create',
      id: order.id,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      status: order.status,
      itemCount: (order.items || []).length,
      lineSummary: (order.items || []).map((it: any) => ({
        isCustom: Boolean(it?.isCustomItem || it?.lineType === 'custom'),
        productId: it?.productId ?? null,
        name: it?.name,
        quantity: it?.quantity,
        price: it?.price,
      })),
    })

    // Primary dedup: if an order with the same id already exists, return it (idempotent upsert)
    const existingById = await db.collection('orders').findOne({ id: order.id })
    if (existingById) {
      console.log('[Orders API] CREATE skipped: order id reused (idempotent POST, no insert):', order.id)
      return noStoreJson(existingById, { status: 200 })
    }

    // Secondary duplicate detection: Check for similar orders created within the last 5 seconds
    const fiveSecondsAgo = new Date(Date.now() - 5000)
    const itemsFingerprint = JSON.stringify(orderLineFingerprintParts(order.items))
    const recentOrders = await db.collection('orders').find({
      table: order.table,
      total: order.total,
      paymentMethod: order.paymentMethod,
      timestamp: { $gte: fiveSecondsAgo },
    }).toArray()

    for (const recentOrder of recentOrders) {
      const recentItemsFingerprint = JSON.stringify(orderLineFingerprintParts(recentOrder.items))
      if (recentItemsFingerprint === itemsFingerprint) {
        console.log('[Orders API] Duplicate order detected:', { existingId: recentOrder.id, newId: order.id })
        return noStoreJson(recentOrder, { status: 200 })
      }
    }
    
    // Stock validation and deduction: inventory products only (skip custom / manual lines).
    const items = filterInventoryStockLineItems(order.items)
    const terminalStatuses = new Set(['cancelled', 'voided', 'deleted'])
    const shouldDeductOnCreate = !terminalStatuses.has(order.status) && items.length > 0
    const deducted: Array<{ productId: string; quantity: number; name?: string }> = []
    if (shouldDeductOnCreate) {
      const validation = await validateStockForItems(db, items)
      if (!validation.ok) {
        console.error('[Orders API] Stock validation failed:', validation.error, validation.productName)
        return NextResponse.json(
          { error: validation.error, productId: validation.productId, productName: validation.productName, available: validation.available },
          { status: 400 }
        )
      }

      const userId = order.cashier || 'System'
      for (const item of items) {
        const qty = Number(item.quantity)
        const res = await deductStockAtomic(db, item.productId, qty, order.id, userId, item.name)
        if (!res.success) {
          // Rollback: restore all previously deducted
          for (const d of deducted) {
            await restoreStockAtomic(db, d.productId, d.quantity, order.id, userId, d.name || 'Unknown', 'order_cancelled')
          }
          console.error('[Orders API] Stock deduction failed:', res.error)
          return NextResponse.json(
            { error: res.error },
            { status: 400 }
          )
        }
        deducted.push({ productId: item.productId, quantity: qty, name: item.name })
      }
      order.stockDeducted = true
      order.stockDeductedAt = new Date()
    }

    const insertResult = await db.collection('orders').insertOne(order)
    
    if (!insertResult.insertedId) {
      if (deducted.length > 0) {
        const userId = order.cashier || 'System'
        for (const d of deducted) {
          await restoreStockAtomic(db, d.productId, d.quantity, order.id, userId, d.name || 'Unknown', 'order_cancelled')
        }
      }
      console.error('[Orders API] Failed to insert order:', order.id)
      return NextResponse.json(
        { error: 'Failed to save order to database', message: 'Database insertion failed' },
        { status: 500 }
      )
    }
    
    // Verify the order was actually saved by fetching it back
    const savedOrder = await db.collection('orders').findOne({ id: order.id })
    if (!savedOrder) {
      if (deducted.length > 0) {
        const userId = order.cashier || 'System'
        for (const d of deducted) {
          await restoreStockAtomic(db, d.productId, d.quantity, order.id, userId, d.name || 'Unknown', 'order_cancelled')
        }
      }
      console.error('[Orders API] Order not found after insertion:', order.id)
      return NextResponse.json(
        { error: 'Order creation verification failed', message: 'Order was not found after saving' },
        { status: 500 }
      )
    }
    
    console.log('[Orders API] CREATE persisted new order document:', order.id, 'MongoDB ID:', insertResult.insertedId, 'paymentStatus:', savedOrder.paymentStatus)
    
    return noStoreJson(savedOrder, { status: 201 })
  } catch (error: any) {
    console.error('[Orders API] POST exception:', error?.message, error?.stack)
    return NextResponse.json(
      { error: 'Failed to create order', message: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = ((session.user as any).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'orders', 'edit')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  try {
    const ip = getClientIp(request)
    const rl = checkRateLimit(`catha-orders-put:${ip}`, 60, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfterMs: rl.retryAfterMs },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      )
    }

    const rawBody = await request.json()
    const parsedPut = cathaStaffOrderUpdateSchema.safeParse(rawBody)
    if (!parsedPut.success) {
      logOrderSecurityEvent({
        route: '/api/catha/orders',
        action: 'PUT',
        userId: (session.user as any)?.email ?? null,
        role,
        ip,
        userAgent: request.headers.get('user-agent'),
        rejected: true,
        reason: 'schema_validation',
        requestSummary: { details: parsedPut.error.flatten() },
      })
      return NextResponse.json(formatZodError(parsedPut.error), { status: 400 })
    }
    const db = await getDatabase('infusion_jaba')

    const { id, ...updateData } = parsedPut.data as Record<string, unknown> & { id: string }
    // Never persist client-supplied order clock
    delete updateData.timestamp
    if (Object.prototype.hasOwnProperty.call(updateData, 'mpesaLastPromptAt') && updateData.mpesaLastPromptAt) {
      updateData.mpesaLastPromptAt = new Date(updateData.mpesaLastPromptAt)
    }
    if (Object.prototype.hasOwnProperty.call(updateData, 'glovoOrderNumber')) {
      const raw = updateData.glovoOrderNumber
      updateData.glovoOrderNumber = typeof raw === 'string' ? raw.trim() || null : null
    }
    if (Object.prototype.hasOwnProperty.call(updateData, 'cardTransactionReference')) {
      const raw = updateData.cardTransactionReference
      updateData.cardTransactionReference = typeof raw === 'string' ? raw.trim() || null : null
    }
    if (Object.prototype.hasOwnProperty.call(updateData, 'paymentReference')) {
      const raw = updateData.paymentReference
      updateData.paymentReference = typeof raw === 'string' ? raw.trim() || null : null
    }
    if (Object.prototype.hasOwnProperty.call(updateData, 'reference')) {
      const raw = updateData.reference
      updateData.reference = typeof raw === 'string' ? raw.trim() || null : null
    }
    if (Object.prototype.hasOwnProperty.call(updateData, 'paidAt') && updateData.paidAt) {
      updateData.paidAt = new Date(updateData.paidAt as string | number | Date)
    }
    if (Object.prototype.hasOwnProperty.call(updateData, 'paidBy')) {
      const raw = updateData.paidBy
      updateData.paidBy = typeof raw === 'string' ? raw.trim() || null : null
    }
    if (Object.prototype.hasOwnProperty.call(updateData, 'mpesaTransactionId')) {
      const raw = updateData.mpesaTransactionId
      updateData.mpesaTransactionId = raw ? String(raw).trim() : null
    }
    if (updateData.paymentMethod && String(updateData.paymentMethod).toLowerCase() !== 'glovo' && !Object.prototype.hasOwnProperty.call(updateData, 'glovoOrderNumber')) {
      updateData.glovoOrderNumber = null
    }
    if (updateData.paymentMethod && String(updateData.paymentMethod).toLowerCase() !== 'card') {
      updateData.cardTransactionReference = null
      updateData.paymentReference = null
      updateData.reference = null
    }
    if (String(updateData.paymentMethod || '').toLowerCase() === 'card') {
      const cardRefRaw =
        updateData.cardTransactionReference ?? updateData.paymentReference ?? updateData.reference
      const cardRef = typeof cardRefRaw === 'string' ? cardRefRaw.trim() : ''
      if (!cardRef) {
        return NextResponse.json(
          { error: 'Card transaction reference is required for card payments.' },
          { status: 400 }
        )
      }
      updateData.cardTransactionReference = cardRef
      updateData.paymentReference = cardRef
      updateData.reference = cardRef
    }

    // Get existing order to check status change
    const existingOrder = await db.collection('orders').findOne({ id })
    
    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    const psUpper = String(existingOrder.paymentStatus || '').toUpperCase()
    const paidCompleted =
      existingOrder.status === 'completed' && (psUpper === 'PAID' || psUpper === 'OVERPAID')

    if (paidCompleted) {
      if (Object.prototype.hasOwnProperty.call(updateData, 'items')) {
        console.warn('[Orders API] UPDATE blocked: line items on paid+completed order', id)
        delete updateData.items
      }
      if (updateData.status != null && updateData.status !== 'completed') {
        console.warn('[Orders API] UPDATE blocked: status downgrade on paid order', id, updateData.status)
        delete updateData.status
      }
      if (updateData.paymentStatus != null) {
        const nextPs = String(updateData.paymentStatus).toUpperCase()
        if (nextPs !== 'PAID' && nextPs !== 'OVERPAID') {
          console.warn('[Orders API] UPDATE blocked: paymentStatus downgrade on paid order', id)
          delete updateData.paymentStatus
        }
      }
      delete updateData.mpesaLastPromptStatus
      delete updateData.mpesaLastPromptMessage
      delete updateData.mpesaLastPromptAt
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'items') && Array.isArray(updateData.items)) {
      const allowCustomLines =
        role === 'SUPER_ADMIN' || hasCathaPermission(perms, 'orders', 'edit')
      const priced = await resolveBarOrderLines(db, updateData.items, {
        allowCustomLines,
        rejectCustomLines: false,
      })
      if (!priced.ok) {
        logOrderSecurityEvent({
          route: '/api/catha/orders',
          action: 'PUT',
          userId: (session.user as any)?.email ?? null,
          role,
          ip,
          userAgent: request.headers.get('user-agent'),
          rejected: true,
          reason: priced.code,
          requestSummary: { id, itemCount: updateData.items.length },
        })
        return NextResponse.json({ error: priced.error, code: priced.code }, { status: 400 })
      }
      updateData.items = priced.items
      updateData.subtotal = priced.subtotal
      updateData.vat = priced.vat
      updateData.total = priced.total
      logOrderSecurityEvent({
        route: '/api/catha/orders',
        action: 'PUT_items',
        userId: (session.user as any)?.email ?? null,
        role,
        ip,
        userAgent: request.headers.get('user-agent'),
        resolvedDbPrices: priced.dbPricesBySku,
        computedTotals: { subtotal: priced.subtotal, vat: priced.vat, total: priced.total },
      })
    }

    console.log('[Orders API] UPDATE (PUT) applying:', {
      action: 'update',
      id,
      paymentMethod: updateData.paymentMethod,
      paymentStatus: updateData.paymentStatus,
      status: updateData.status,
      mpesaLastPromptStatus: updateData.mpesaLastPromptStatus,
      itemsInPayload: Array.isArray(updateData.items),
      paidCompletedOrder: paidCompleted,
      totalsRecomputedFromItems: Array.isArray(updateData.items),
    })

    if (updateData.paymentMethod && String(updateData.paymentMethod).toLowerCase() !== 'mpesa') {
      const wasMpesa = String(existingOrder.paymentMethod || '').toLowerCase() === 'mpesa'
      if (wasMpesa) {
        const linkedBefore = baseLinkedListFromOrder(existingOrder)
        await deleteAllAllocationsForOrder(db, id)
        for (const p of linkedBefore) {
          if (ObjectId.isValid(p.transactionId)) {
            await refreshMpesaTransactionLinkMetadata(db, p.transactionId)
          }
        }
      }
      updateData.mpesaTransactionId = null
      updateData.mpesaReceiptNumber = null
      updateData.linkedAt = null
      updateData.linkedBy = null
      updateData.linkedPayments = []
      updateData.totalLinkedPayments = 0
      updateData.balanceDue = null
      updateData.overpaymentAmount = 0
      updateData.changeGiven = false
      updateData.changeGivenAt = null
      updateData.changeGivenBy = null
      updateData.changeNotes = null
    }
    
    const oldStatus = existingOrder.status
    const newStatus = updateData.status ?? oldStatus
    const userId = (session.user as any)?.email || existingOrder.cashier || 'System'
    const previousItems = filterInventoryStockLineItems(existingOrder.items)
    const nextItems = filterInventoryStockLineItems(updateData.items ?? existingOrder.items ?? [])
    // Backward compatibility: legacy completed orders had stock deducted but no stockDeducted flag.
    const wasStockDeducted = existingOrder.stockDeducted === true || existingOrder.status === 'completed'
    const terminalStatuses = new Set(['cancelled', 'voided', 'deleted'])
    const isTerminalStatus = terminalStatuses.has(newStatus)

    if (wasStockDeducted && isTerminalStatus) {
      const reason = newStatus === 'deleted' ? 'order_deleted' : 'order_cancelled'
      for (const item of previousItems) {
        await restoreStockAtomic(db, item.productId, Number(item.quantity), id, userId, item.name || 'Unknown', reason)
      }
      updateData.stockDeducted = false
      updateData.stockReleasedAt = new Date()
      const linkedTerminal = baseLinkedListFromOrder(existingOrder)
      await deleteAllAllocationsForOrder(db, id)
      for (const p of linkedTerminal) {
        if (ObjectId.isValid(p.transactionId)) {
          await refreshMpesaTransactionLinkMetadata(db, p.transactionId)
        }
      }
      updateData.linkedPayments = []
      updateData.mpesaTransactionId = null
      updateData.mpesaReceiptNumber = null
      updateData.linkedAt = null
      updateData.linkedBy = null
    } else if (!wasStockDeducted && !isTerminalStatus && nextItems.length > 0) {
      const validation = await validateStockForItems(db, nextItems)
      if (!validation.ok) {
        return NextResponse.json(
          { error: validation.error, productId: validation.productId, productName: validation.productName, available: validation.available },
          { status: 400 }
        )
      }
      const deducted: Array<{ productId: string; quantity: number; name?: string }> = []
      for (const item of nextItems) {
        const qty = Number(item.quantity)
        const res = await deductStockAtomic(db, item.productId, qty, id, userId, item.name)
        if (!res.success) {
          for (const d of deducted) {
            await restoreStockAtomic(db, d.productId, d.quantity, id, userId, d.name || 'Unknown', 'order_cancelled')
          }
          return NextResponse.json({ error: res.error }, { status: 400 })
        }
        deducted.push({ productId: item.productId, quantity: qty, name: item.name })
      }
      updateData.stockDeducted = true
      updateData.stockDeductedAt = existingOrder.stockDeductedAt || new Date()
      updateData.stockReleasedAt = null
    } else if (wasStockDeducted && !isTerminalStatus && updateData.items && Array.isArray(updateData.items)) {
      const oldItems = previousItems.map((i: any) => ({ productId: i.productId, quantity: Number(i.quantity), name: i.name }))
      const newItemsMapped = nextItems.map((i: any) => ({ productId: i.productId, quantity: Number(i.quantity), name: i.name }))
      const { toRestore, toDeduct } = diffOrderItems(oldItems, newItemsMapped)

      if (toDeduct.length > 0) {
        const validation = await validateStockForItems(db, toDeduct)
        if (!validation.ok) {
          return NextResponse.json(
            { error: validation.error, productId: validation.productId, productName: validation.productName, available: validation.available },
            { status: 400 }
          )
        }
      }

      for (const item of toRestore) {
        await restoreStockAtomic(db, item.productId, item.quantity, id, userId, item.name || 'Unknown', 'quantity_reduced')
      }
      if (toDeduct.length > 0) {
        const deducted: Array<{ productId: string; quantity: number; name?: string }> = []
        for (const item of toDeduct) {
          const res = await deductStockAtomic(db, item.productId, item.quantity, id, userId, item.name)
          if (!res.success) {
            for (const d of deducted) {
              await restoreStockAtomic(db, d.productId, d.quantity, id, userId, d.name || 'Unknown', 'order_cancelled')
            }
            for (const r of toRestore) {
              await deductStockAtomic(db, r.productId, r.quantity, id, userId, r.name)
            }
            return NextResponse.json({ error: res.error }, { status: 400 })
          }
          deducted.push(item)
        }
      }
      updateData.stockDeducted = true
    }

    const result = await db.collection('orders').updateOne(
      { id },
      { $set: updateData as Record<string, unknown> }
    )

    console.log('[Orders API] UPDATE persisted:', { id, modified: result.modifiedCount === 1 })
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // ── Sync back to menu_orders so the customer's tracking screen updates ──
    // The order's `id` is the same as `orderId` in menu_orders (set by alertBar)
    if (newStatus === 'completed') {
      await db.collection('menu_orders').updateOne(
        { orderId: id },
        { $set: {
            status: 'paid',
            paymentStatus: 'PAID',
            paymentMethod: updateData.paymentMethod || existingOrder.paymentMethod || 'cash',
            updatedAt: new Date(),
          }
        }
      )
    } else if (newStatus === 'cancelled') {
      await db.collection('menu_orders').updateOne(
        { orderId: id },
        { $set: { status: 'cancelled', updatedAt: new Date() } }
      )
    }

    if (newStatus === 'completed') {
      try {
        await maybeSendCathaPaymentReceiptSms(db, id)
      } catch (smsError) {
        console.error('[Orders API] Failed to send payment receipt SMS:', smsError)
      }
    }
    
    return noStoreJson({ success: true })
  } catch (error: any) {
    console.error('Error updating order:', error)
    return NextResponse.json(
      { error: 'Failed to update order', message: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = ((session.user as any).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'orders', 'delete')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }
    
    const db = await getDatabase('infusion_jaba')
    
    // Get order before deleting to restore inventory if stock was deducted
    const order = await db.collection('orders').findOne({ id })
    
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }
    
    const wasStockDeducted = order.stockDeducted === true || order.status === 'completed'
    if (wasStockDeducted && order.items && order.items.length > 0) {
      const userId = order.cashier || 'System'
      for (const item of filterInventoryStockLineItems(order.items)) {
        const qty = Number(item.quantity)
        await restoreStockAtomic(db, item.productId, qty, id, userId, item.name || 'Unknown', 'order_deleted')
      }
    }

    const linkedDelete = baseLinkedListFromOrder(order)
    await deleteAllAllocationsForOrder(db, id)
    for (const p of linkedDelete) {
      if (ObjectId.isValid(p.transactionId)) {
        await refreshMpesaTransactionLinkMetadata(db, p.transactionId)
      }
    }

    // Delete the order
    const result = await db.collection('orders').deleteOne({ id })
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Cancel the customer-facing menu_orders entry so it disappears from their screen
    await db.collection('menu_orders').updateOne(
      { orderId: id },
      { $set: { status: 'cancelled', updatedAt: new Date() } }
    )
    
    return noStoreJson({ success: true })
  } catch (error: any) {
    console.error('Error deleting order:', error)
    return NextResponse.json(
      { error: 'Failed to delete order', message: error.message },
      { status: 500 }
    )
  }
}

