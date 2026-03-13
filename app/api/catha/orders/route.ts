import { NextResponse } from 'next/server'
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
import { requireCathaPermission } from '@/lib/auth-catha'

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
      
      const formattedOrder = {
        id: order.id || order._id?.toString(),
        table: order.table,
        orderType: order.orderType || 'INHOUSE',
        orderSource: order.orderSource || null,
        items: order.items || [],
        subtotal: order.subtotal,
        vat: order.vat,
        total: order.total,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus || (order.status === 'completed' ? 'PAID' : 'PENDING'),
        mpesaReceiptNumber: order.mpesaReceiptNumber || null,
        cashAmount: order.cashAmount || null,
        cashBalance: order.cashBalance || null,
        cashier: order.cashier,
        waiter: order.waiter,
        customerName: order.customerName || null,
        customerPhone: order.customerPhone || null,
        timestamp: order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp),
        status: order.status,
      }
      
      return NextResponse.json(formattedOrder)
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
    const formattedOrders = orders.map((order: any) => ({
      id: order.id || order._id?.toString(),
      table: order.table,
      orderType: order.orderType || 'INHOUSE',
      orderSource: order.orderSource || null,
      items: order.items || [],
      subtotal: order.subtotal,
      vat: order.vat,
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus || (order.status === 'completed' ? 'PAID' : 'PENDING'),
      mpesaReceiptNumber: order.mpesaReceiptNumber || null,
      cashAmount: order.cashAmount || null,
      cashBalance: order.cashBalance || null,
      cashier: order.cashier,
      waiter: order.waiter,
      customerName: order.customerName || null,
      customerPhone: order.customerPhone || null,
      timestamp: order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp),
      status: order.status,
    }))
    
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
      cashAmount: body.cashAmount || null,
      cashBalance: body.cashBalance || null,
      cashier: body.cashier,
      waiter: body.waiter,
      customerName: body.customerName || null,
      customerPhone: body.customerPhone || null,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      status: body.status || 'pending',
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
    
    // Stock validation and deduction for completed orders (backend decides - no frontend trust)
    const items = (order.items || []).filter((i: any) => i.productId && i.quantity > 0)
    if (order.status === 'completed' && items.length > 0) {
      const validation = await validateStockForItems(db, items)
      if (!validation.ok) {
        console.error('[Orders API] Stock validation failed:', validation.error, validation.productName)
        return NextResponse.json(
          { error: validation.error, productId: validation.productId, productName: validation.productName, available: validation.available },
          { status: 400 }
        )
      }

      const userId = order.cashier || 'System'
      const deducted: Array<{ productId: string; quantity: number; name?: string }> = []
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
    }

    const insertResult = await db.collection('orders').insertOne(order)
    
    if (!insertResult.insertedId) {
      console.error('[Orders API] Failed to insert order:', order.id)
      return NextResponse.json(
        { error: 'Failed to save order to database', message: 'Database insertion failed' },
        { status: 500 }
      )
    }
    
    // Verify the order was actually saved by fetching it back
    const savedOrder = await db.collection('orders').findOne({ id: order.id })
    if (!savedOrder) {
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
    
    const oldStatus = existingOrder.status
    const newStatus = updateData.status
    const userId = updateData.cashier || existingOrder.cashier || 'System'
    const newItems = updateData.items ?? existingOrder.items ?? []

    // Determine items to use for stock ops (use new items for completed/cancelled flows)
    const itemsForCompleted = (newStatus === 'completed' ? newItems : existingOrder.items) || []
    const itemsForRestore = (existingOrder.items || []).filter((i: any) => i.productId && i.quantity > 0)

    // Handle status change: pending -> completed (validate + deduct atomically)
    if (oldStatus === 'pending' && newStatus === 'completed' && itemsForCompleted.length > 0) {
      const validation = await validateStockForItems(db, itemsForCompleted)
      if (!validation.ok) {
        console.error('[Orders API] Stock validation failed (PUT):', validation.error)
        return NextResponse.json(
          { error: validation.error, productId: validation.productId, productName: validation.productName, available: validation.available },
          { status: 400 }
        )
      }
      const deducted: Array<{ productId: string; quantity: number; name?: string }> = []
      for (const item of itemsForCompleted) {
        if (!item.productId || !item.quantity) continue
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
    }

    // Handle status change: completed -> pending, cancelled, voided (restore inventory)
    const cancelStatuses = ['pending', 'cancelled', 'voided', 'deleted']
    if (oldStatus === 'completed' && cancelStatuses.includes(newStatus) && itemsForRestore.length > 0) {
      const reason = newStatus === 'cancelled' || newStatus === 'voided' ? 'order_cancelled' : newStatus === 'deleted' ? 'order_deleted' : 'order_cancelled'
      for (const item of itemsForRestore) {
        const qty = Number(item.quantity)
        await restoreStockAtomic(db, item.productId, qty, id, userId, item.name || 'Unknown', reason)
      }
    }

    // Handle order edit: items changed on a completed order
    if (oldStatus === 'completed' && newStatus === 'completed' && updateData.items && Array.isArray(updateData.items)) {
      const oldItems = (existingOrder.items || []).map((i: any) => ({ productId: i.productId, quantity: Number(i.quantity), name: i.name }))
      const newItemsMapped = updateData.items.map((i: any) => ({ productId: i.productId, quantity: Number(i.quantity), name: i.name }))
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
    
    // Get order before deleting to restore inventory if it was completed
    const order = await db.collection('orders').findOne({ id })
    
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }
    
    // If order was completed, restore inventory (atomic $inc)
    if (order.status === 'completed' && order.items && order.items.length > 0) {
      const userId = order.cashier || 'System'
      for (const item of order.items) {
        if (!item.productId || !item.quantity) continue
        const qty = Number(item.quantity)
        await restoreStockAtomic(db, item.productId, qty, id, userId, item.name || 'Unknown', 'order_deleted')
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

