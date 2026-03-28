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
      .find({})
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
    const body = await request.json()
    const db = await getDatabase('infusion_jaba')
    
    const order = {
      id: body.id || `TXN${Date.now().toString().slice(-8)}`,
      table: body.table,
      orderType: body.orderType || 'INHOUSE',
      orderSource: body.orderSource || 'pos',
      items: body.items || [],
      subtotal: body.subtotal,
      vat: body.vat,
      total: body.total,
      paymentMethod: body.paymentMethod,
      // Derive paymentStatus: use explicit value if given, otherwise infer from status
      paymentStatus: body.paymentStatus || (body.status === 'completed' ? 'PAID' : 'PENDING'),
      glovoOrderNumber: typeof body.glovoOrderNumber === 'string' ? body.glovoOrderNumber.trim() || null : null,
      cashAmount: body.cashAmount || null,
      cashBalance: body.cashBalance || null,
      cashier: body.cashier,
      waiter: body.waiter,
      customerName: body.customerName || null,
      customerPhone: body.customerPhone || null,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      status: body.status || 'pending',
      stockDeducted: false,
      stockDeductedAt: null as Date | null,
    }
    
    console.log('[Orders API] Creating order:', {
      id: order.id,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      status: order.status,
      receivedPaymentStatus: body.paymentStatus,
    })

    // Primary dedup: if an order with the same id already exists, return it (idempotent upsert)
    const existingById = await db.collection('orders').findOne({ id: order.id })
    if (existingById) {
      console.log('[Orders API] Order already exists, returning existing:', order.id)
      return noStoreJson(existingById, { status: 200 })
    }

    // Secondary duplicate detection: Check for similar orders created within the last 5 seconds
    const fiveSecondsAgo = new Date(Date.now() - 5000)
    const itemsFingerprint = JSON.stringify(
      order.items
        .map((item: any) => ({ productId: item.productId, quantity: item.quantity }))
        .sort((a: any, b: any) => (a.productId || '').localeCompare(b.productId || ''))
    )
    const recentOrders = await db.collection('orders').find({
      table: order.table,
      total: order.total,
      paymentMethod: order.paymentMethod,
      timestamp: { $gte: fiveSecondsAgo },
    }).toArray()

    for (const recentOrder of recentOrders) {
      const recentItemsFingerprint = JSON.stringify(
        (recentOrder.items || [])
          .map((item: any) => ({ productId: item.productId, quantity: item.quantity }))
          .sort((a: any, b: any) => (a.productId || '').localeCompare(b.productId || ''))
      )
      if (recentItemsFingerprint === itemsFingerprint) {
        console.log('[Orders API] Duplicate order detected:', { existingId: recentOrder.id, newId: order.id })
        return noStoreJson(recentOrder, { status: 200 })
      }
    }
    
    // Stock validation and deduction happen on order creation, regardless of payment status.
    const items = (order.items || []).filter((i: any) => i.productId && i.quantity > 0)
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
    
    console.log('[Orders API] Order saved and verified successfully:', order.id, 'MongoDB ID:', insertResult.insertedId, 'paymentStatus:', savedOrder.paymentStatus)
    
    return noStoreJson(savedOrder, { status: 201 })
  } catch (error: any) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Failed to create order', message: error.message },
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
    const body = await request.json()
    const db = await getDatabase('infusion_jaba')
    
    const { id, ...updateData } = body
    
    if (updateData.timestamp) {
      updateData.timestamp = new Date(updateData.timestamp)
    }
    if (Object.prototype.hasOwnProperty.call(updateData, 'glovoOrderNumber')) {
      const raw = updateData.glovoOrderNumber
      updateData.glovoOrderNumber = typeof raw === 'string' ? raw.trim() || null : null
    }
    if (Object.prototype.hasOwnProperty.call(updateData, 'mpesaTransactionId')) {
      const raw = updateData.mpesaTransactionId
      updateData.mpesaTransactionId = raw ? String(raw).trim() : null
    }
    if (updateData.paymentMethod && String(updateData.paymentMethod).toLowerCase() !== 'glovo' && !Object.prototype.hasOwnProperty.call(updateData, 'glovoOrderNumber')) {
      updateData.glovoOrderNumber = null
    }
    
    console.log('[Orders API] Updating order:', {
      id,
      paymentMethod: updateData.paymentMethod,
      paymentStatus: updateData.paymentStatus,
      status: updateData.status,
      receivedPaymentStatus: body.paymentStatus,
    })
    
    // Get existing order to check status change
    const existingOrder = await db.collection('orders').findOne({ id })
    
    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    if (updateData.paymentMethod && String(updateData.paymentMethod).toLowerCase() !== 'mpesa') {
      const wasMpesa = String(existingOrder.paymentMethod || '').toLowerCase() === 'mpesa'
      if (wasMpesa) {
        for (const p of baseLinkedListFromOrder(existingOrder)) {
          if (ObjectId.isValid(p.transactionId)) {
            await db.collection('mpesa_transactions').updateOne(
              { _id: new ObjectId(p.transactionId) },
              { $unset: { linked_order_id: '', linked_at: '', linked_by: '' }, $set: { updatedAt: new Date() } }
            )
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
    const userId = updateData.cashier || existingOrder.cashier || 'System'
    const previousItems = (existingOrder.items || []).filter((i: any) => i.productId && Number(i.quantity) > 0)
    const nextItems = (updateData.items ?? existingOrder.items ?? []).filter((i: any) => i.productId && Number(i.quantity) > 0)
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
      for (const p of baseLinkedListFromOrder(existingOrder)) {
        if (ObjectId.isValid(p.transactionId)) {
          await db.collection('mpesa_transactions').updateOne(
            { _id: new ObjectId(p.transactionId) },
            { $unset: { linked_order_id: '', linked_at: '', linked_by: '' }, $set: { updatedAt: new Date() } }
          )
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
      { $set: updateData }
    )
    
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
      for (const item of order.items) {
        if (!item.productId || !item.quantity) continue
        const qty = Number(item.quantity)
        await restoreStockAtomic(db, item.productId, qty, id, userId, item.name || 'Unknown', 'order_deleted')
      }
    }

    for (const p of baseLinkedListFromOrder(order)) {
      if (ObjectId.isValid(p.transactionId)) {
        await db.collection('mpesa_transactions').updateOne(
          { _id: new ObjectId(p.transactionId) },
          { $unset: { linked_order_id: '', linked_at: '', linked_by: '' }, $set: { updatedAt: new Date() } }
        )
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

