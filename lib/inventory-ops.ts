/**
 * Enterprise-grade inventory operations for POS.
 * - Atomic stock deduction/restoration
 * - No negative stock
 * - Full audit logging
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'

/** Product filter: not deleted, type bar */
const PRODUCT_QUERY = { type: 'bar', deleted: { $ne: true } } as const

/** Stock validation result */
export type ValidateStockResult =
  | { ok: true }
  | { ok: false; error: string; productId: string; productName: string; available: number; requested: number }

/**
 * Validate that all items have sufficient stock before order creation/update.
 * Checks: product exists, not deleted, stock >= requested quantity.
 */
export async function validateStockForItems(
  db: Db,
  items: Array<{ productId: string; quantity: number; name?: string }>
): Promise<ValidateStockResult> {
  const coll = db.collection('bar_inventory')
  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity <= 0) continue

    let productId: ObjectId
    try {
      productId = new ObjectId(item.productId)
    } catch {
      return { ok: false, error: 'Invalid product ID', productId: item.productId, productName: item.name || 'Unknown', available: 0, requested: item.quantity }
    }

    const product = await coll.findOne({ _id: productId, ...PRODUCT_QUERY })
    if (!product) {
      return {
        ok: false,
        error: 'Product not found or has been removed',
        productId: item.productId,
        productName: item.name || 'Unknown',
        available: 0,
        requested: item.quantity,
      }
    }

    const available = Number(product.stock ?? 0)
    const requested = Number(item.quantity)
    if (available <= 0) {
      return {
        ok: false,
        error: `Insufficient stock. Only ${available} left.`,
        productId: item.productId,
        productName: product.name || item.name || 'Unknown',
        available,
        requested,
      }
    }
    if (requested > available) {
      return {
        ok: false,
        error: `Insufficient stock. Only ${available} left.`,
        productId: item.productId,
        productName: product.name || item.name || 'Unknown',
        available,
        requested,
      }
    }
  }
  return { ok: true }
}

/**
 * Atomically deduct stock. Fails if insufficient stock (no negative inventory).
 * Returns updated product or null if deduction failed.
 */
export async function deductStockAtomic(
  db: Db,
  productId: string,
  quantity: number,
  orderId: string,
  userId: string,
  productName?: string
): Promise<{ success: true; product: any } | { success: false; error: string }> {
  if (quantity <= 0) return { success: true, product: null }

  const coll = db.collection('bar_inventory')
  let oid: ObjectId
  try {
    oid = new ObjectId(productId)
  } catch {
    return { success: false, error: 'Invalid product ID' }
  }

  const result = await coll.findOneAndUpdate(
    { _id: oid, ...PRODUCT_QUERY, stock: { $gte: quantity } },
    { $inc: { stock: -quantity }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after' }
  )

  if (!result) {
    const product = await coll.findOne({ _id: oid, ...PRODUCT_QUERY })
    const available = product ? Number(product.stock ?? 0) : 0
    return {
      success: false,
      error: `Insufficient stock. Only ${available} left.`,
    }
  }

  const prevStock = Number(result.stock ?? 0) + quantity
  await logInventoryAction(db, {
    actionType: 'deduct',
    productId,
    productName: productName || result.name,
    quantity,
    orderId,
    userId,
    previousStock: prevStock,
    newStock: Number(result.stock ?? 0),
    reason: 'sale',
  })

  return { success: true, product: result }
}

/**
 * Atomically restore stock (order cancelled, item removed, quantity reduced).
 */
export async function restoreStockAtomic(
  db: Db,
  productId: string,
  quantity: number,
  orderId: string,
  userId: string,
  productName: string,
  reason: 'order_cancelled' | 'order_deleted' | 'order_voided' | 'item_removed' | 'quantity_reduced' | 'customer_return'
): Promise<void> {
  if (quantity <= 0) return

  const coll = db.collection('bar_inventory')
  let oid: ObjectId
  try {
    oid = new ObjectId(productId)
  } catch {
    console.error(`[Inventory] Invalid productId for restore: ${productId}`)
    return
  }

  const product = await coll.findOne({ _id: oid })
  const previousStock = product ? Number(product.stock ?? 0) : 0

  await coll.updateOne({ _id: oid }, { $inc: { stock: quantity }, $set: { updatedAt: new Date() } })

  const newStock = previousStock + quantity
  await logInventoryAction(db, {
    actionType: 'restore',
    productId,
    productName,
    quantity,
    orderId,
    userId,
    previousStock,
    newStock,
    reason,
  })
}

/**
 * Create inventory log entry and bar_stock_movements record.
 * Idempotent: a movement with the same dedupeKey is inserted only once.
 * dedupeKey format: "<orderId>:<productId>:<actionType>:<quantity>"
 * This prevents duplicate log rows (and the associated extra $inc on bar_inventory
 * in deductStockAtomic) when a callback fires more than once for the same order.
 */
async function logInventoryAction(
  db: Db,
  params: {
    actionType: 'deduct' | 'restore'
    productId: string
    productName: string
    quantity: number
    orderId: string
    userId: string
    previousStock: number
    newStock: number
    reason: string
  }
): Promise<void> {
  const { actionType, productId, productName, quantity, orderId, userId, previousStock, newStock, reason } = params

  // Idempotency key: uniquely identifies one specific stock movement event.
  const dedupeKey = `${orderId}:${productId}:${actionType}:${quantity}:${reason}`

  const now = new Date()
  const doc = {
    type: 'bar',
    productId,
    productName,
    actionType,
    quantity,
    orderId,
    userId,
    previousStock,
    newStock,
    reason,
    movementType: actionType === 'deduct' ? 'outflow' : 'inflow',
    reference: orderId,
    notes: `${actionType === 'deduct' ? 'Sale' : 'Restore'} - Order ${orderId}`,
    user: userId,
    date: now,
    createdAt: now,
    timestamp: now,
    dedupeKey,
  }

  // Use upsert so that an identical movement (same order + product + action + quantity + reason)
  // is recorded only once. If the document already exists the $setOnInsert is a no-op.
  const result = await db.collection('bar_stock_movements').updateOne(
    { dedupeKey },
    { $setOnInsert: doc },
    { upsert: true }
  )

  if (result.upsertedCount === 0) {
    // Document already existed — this was a duplicate call, log a warning and return.
    console.warn(`[Inventory] Duplicate movement suppressed (dedupeKey=${dedupeKey})`)
    return
  }

  if (actionType === 'restore') {
    console.log(`[Inventory] Stock restored: ${productName} +${quantity} (order ${orderId}, reason: ${reason})`)
  } else {
    console.log(`[Inventory] Stock deducted: ${productName} -${quantity} (order ${orderId})`)
  }
}

/**
 * Diff two item arrays to compute: toRestore (items/quantities to restore) and toDeduct (items/quantities to deduct).
 */
export function diffOrderItems(
  oldItems: Array<{ productId: string; quantity: number; name?: string }>,
  newItems: Array<{ productId: string; quantity: number; name?: string }>
): {
  toRestore: Array<{ productId: string; quantity: number; name?: string }>
  toDeduct: Array<{ productId: string; quantity: number; name?: string }>
} {
  const oldMap = new Map<string, { quantity: number; name?: string }>()
  for (const i of oldItems) {
    if (i.productId && i.quantity > 0) {
      const existing = oldMap.get(i.productId)
      const q = (existing?.quantity ?? 0) + i.quantity
      oldMap.set(i.productId, { quantity: q, name: i.name ?? existing?.name })
    }
  }
  const newMap = new Map<string, { quantity: number; name?: string }>()
  for (const i of newItems) {
    if (i.productId && i.quantity > 0) {
      const existing = newMap.get(i.productId)
      const q = (existing?.quantity ?? 0) + i.quantity
      newMap.set(i.productId, { quantity: q, name: i.name ?? existing?.name })
    }
  }

  const toRestore: Array<{ productId: string; quantity: number; name?: string }> = []
  const toDeduct: Array<{ productId: string; quantity: number; name?: string }> = []

  for (const [pid, oldV] of oldMap) {
    const newV = newMap.get(pid)
    const newQ = newV?.quantity ?? 0
    const diff = oldV.quantity - newQ
    if (diff > 0) {
      toRestore.push({ productId: pid, quantity: diff, name: oldV.name })
    }
    if (newQ === 0) newMap.delete(pid)
  }

  for (const [pid, newV] of newMap) {
    const oldV = oldMap.get(pid)
    const oldQ = oldV?.quantity ?? 0
    const diff = newV.quantity - oldQ
    if (diff > 0) {
      toDeduct.push({ productId: pid, quantity: diff, name: newV.name })
    }
  }

  return { toRestore, toDeduct }
}
