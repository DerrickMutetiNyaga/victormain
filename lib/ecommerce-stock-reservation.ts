import type { Db } from 'mongodb'
import { deductStockAtomic, restoreStockAtomic } from '@/lib/inventory-ops'
import { filterInventoryStockLineItems } from '@/lib/catha-order-inventory-lines'
import { ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION } from '@/lib/ecommerce-checkout-session-constants'

/** Hold window for checkout payment (M-Pesa STK). */
export const ECOMMERCE_RESERVATION_TTL_MS = 15 * 60 * 1000

export type CheckoutSessionReservationFields = {
  id: string
  customerPhone: string
  status?: string
  reservationHoldActive?: boolean
  reservationExpiresAt?: Date | null
  snapshot?: { items?: unknown[] }
}

/**
 * Atomically reserve inventory for a checkout session: either every line deducts or none (rollback).
 * Physical `bar_inventory.stock` is reduced immediately so POS and other checkouts cannot oversell.
 */
export async function reserveStockForCheckoutSessionAtomic(
  db: Db,
  sessionId: string,
  customerPhone: string,
  pricedItems: unknown[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const lines = filterInventoryStockLineItems(pricedItems)
  if (lines.length === 0) return { ok: true }

  const held: Array<{ productId: string; quantity: number; name?: string }> = []
  const userId = `ecommerce_reserve:${customerPhone}`

  for (const item of lines) {
    const qty = Number(item.quantity)
    if (!Number.isFinite(qty) || qty <= 0) continue
    const res = await deductStockAtomic(
      db,
      item.productId,
      qty,
      sessionId,
      userId,
      item.name,
      'ecommerce_checkout_reserve'
    )
    if (!res.success) {
      for (const h of [...held].reverse()) {
        await restoreStockAtomic(
          db,
          h.productId,
          h.quantity,
          sessionId,
          userId,
          h.name || 'Unknown',
          'ecommerce_reserve_rollback'
        )
      }
      return { ok: false, error: res.error }
    }
    held.push({ productId: item.productId, quantity: qty, name: item.name })
  }
  return { ok: true }
}

/** Restore shelf stock for an active checkout hold (abandon / fail / expire). */
export async function releaseCheckoutSessionReservation(
  db: Db,
  session: CheckoutSessionReservationFields
): Promise<void> {
  if (!session.reservationHoldActive) return
  const lines = filterInventoryStockLineItems(session.snapshot?.items ?? [])
  if (lines.length === 0) return

  const userId = `ecommerce_reserve:${session.customerPhone}`
  for (const item of lines) {
    const qty = Number(item.quantity)
    if (!Number.isFinite(qty) || qty <= 0) continue
    await restoreStockAtomic(
      db,
      item.productId,
      qty,
      session.id,
      userId,
      item.name || 'Unknown',
      'ecommerce_reserve_release'
    )
  }
  console.log('[ecommerce-checkout] reservation_released', { sessionId: session.id })
}

/** Release shelf stock and persist session terminal status (caller picks abandoned/failed/expired). */
export async function releaseHoldAndUpdateSessionStatus(
  db: Db,
  session: CheckoutSessionReservationFields,
  nextStatus: 'abandoned' | 'failed' | 'expired'
): Promise<void> {
  await releaseCheckoutSessionReservation(db, session)
  await db.collection(ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION).updateOne(
    { id: session.id },
    {
      $set: {
        status: nextStatus,
        reservationHoldActive: false,
        reservationReleasedAt: new Date(),
        updatedAt: new Date(),
      },
    }
  )
}

/**
 * If session is unpaid and past reservation expiry, release stock and mark `expired`.
 * @returns true if expiry was applied
 */
export async function expireCheckoutSessionIfNeeded(db: Db, sessionId: string): Promise<boolean> {
  const coll = db.collection(ECOMMERCE_CHECKOUT_SESSIONS_COLLECTION)
  const doc = await coll.findOne({ id: sessionId })
  if (!doc || doc.status !== 'pending_payment') return false

  const exp = doc.reservationExpiresAt ? new Date(doc.reservationExpiresAt).getTime() : 0
  if (!exp || Date.now() < exp) return false

  if (doc.reservationHoldActive === true) {
    await releaseHoldAndUpdateSessionStatus(db, doc as CheckoutSessionReservationFields, 'expired')
    console.warn('[ecommerce-checkout] session_expired_reservation_released', { sessionId })
  } else {
    await coll.updateOne(
      { id: sessionId },
      { $set: { status: 'expired', updatedAt: new Date() } }
    )
    console.warn('[ecommerce-checkout] session_expired_no_stock_hold', { sessionId })
  }
  return true
}

export function logEcommerceRecoveryCritical(payload: Record<string, unknown>) {
  console.error('[EcommerceCritical]', JSON.stringify({ ts: new Date().toISOString(), ...payload }))
}
