import { ObjectId, type Db } from 'mongodb'

export const MPESA_ORDER_ALLOCATIONS = 'mpesa_order_allocations'

export const MONEY_EPS = 0.005

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

let indexesEnsured = false

export async function ensureMpesaOrderAllocationsIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return
  try {
    await db.collection(MPESA_ORDER_ALLOCATIONS).createIndex(
      { mpesaTransactionId: 1, orderId: 1 },
      { unique: true, name: 'uniq_mpesa_alloc_tx_order' }
    )
    await db.collection(MPESA_ORDER_ALLOCATIONS).createIndex(
      { mpesaTransactionId: 1 },
      { name: 'idx_mpesa_alloc_tx' }
    )
    await db.collection(MPESA_ORDER_ALLOCATIONS).createIndex({ orderId: 1 }, { name: 'idx_mpesa_alloc_order' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes('already exists') && !msg.includes('same name')) {
      console.warn('[M-Pesa allocations] Index ensure:', msg)
    }
  }
  indexesEnsured = true
}

/** Linked M-Pesa rows from an order document (mirrors baseLinkedListFromOrder shape, avoids import cycles). */
export function linkedMpesaRowsFromOrderDoc(order: any): Array<{
  transactionId: string
  amount: number
  linkedBy: string
  receiptNumber: string | null
  phone: string | null
  payerName: string | null
  mpesaStatus: string | null
  transactionDate: unknown
  linkedAt: Date | string
}> {
  const arr = Array.isArray(order?.linkedPayments) ? [...order.linkedPayments] : []
  const out: Array<{
    transactionId: string
    amount: number
    linkedBy: string
    receiptNumber: string | null
    phone: string | null
    payerName: string | null
    mpesaStatus: string | null
    transactionDate: unknown
    linkedAt: Date | string
  }> = []
  for (const p of arr) {
    if (!p || String(p.transactionId || '').trim() === '') continue
    out.push({
      transactionId: String(p.transactionId).trim(),
      amount: Number(p.amount) || 0,
      linkedBy: String(p.linkedBy || 'System'),
      receiptNumber: p.receiptNumber != null ? String(p.receiptNumber) : null,
      phone: p.phone != null ? String(p.phone) : null,
      payerName: p.payerName != null ? String(p.payerName) : null,
      mpesaStatus: p.mpesaStatus != null ? String(p.mpesaStatus) : null,
      transactionDate: p.transactionDate ?? null,
      linkedAt: p.linkedAt ?? new Date(),
    })
  }
  if (out.length > 0) return out
  const legacy = order?.mpesaTransactionId ? String(order.mpesaTransactionId).trim() : ''
  if (!legacy) return []
  return [
    {
      transactionId: legacy,
      amount: Number(order.total) || 0,
      linkedBy: String(order.linkedBy || 'System'),
      receiptNumber: order.mpesaReceiptNumber != null ? String(order.mpesaReceiptNumber) : null,
      phone: null,
      payerName: null,
      mpesaStatus: null,
      transactionDate: null,
      linkedAt: order.linkedAt ?? new Date(),
    },
  ]
}

/**
 * Backfill allocation docs from existing order.linkedPayments so totals stay correct
 * before applying new multi-order rules.
 */
export async function materializeAllocationsFromOrders(db: Db, transactionId: string): Promise<void> {
  if (!ObjectId.isValid(transactionId)) return
  const orders = await db
    .collection('orders')
    .find({
      $or: [{ mpesaTransactionId: transactionId }, { 'linkedPayments.transactionId': transactionId }],
    })
    .project({ id: 1, linkedPayments: 1, mpesaTransactionId: 1, total: 1, linkedBy: 1, linkedAt: 1 })
    .toArray()

  const now = new Date()
  for (const ord of orders) {
    const row = linkedMpesaRowsFromOrderDoc(ord).find((r) => r.transactionId === transactionId)
    if (!row || !ord.id) continue
    const amt = roundMoney(Number(row.amount) || 0)
    if (amt <= 0) continue
    await db.collection(MPESA_ORDER_ALLOCATIONS).updateOne(
      { mpesaTransactionId: transactionId, orderId: String(ord.id) },
      {
        $set: {
          allocatedAmount: amt,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt:
            row.linkedAt instanceof Date
              ? row.linkedAt
              : typeof row.linkedAt === 'string'
                ? new Date(row.linkedAt)
                : now,
          createdBy: row.linkedBy || 'migration',
          notes: null,
        },
      },
      { upsert: true }
    )
  }
}

export async function sumAllocationsForTransaction(db: Db, transactionId: string): Promise<number> {
  const agg = await db
    .collection(MPESA_ORDER_ALLOCATIONS)
    .aggregate<{ s: number }>([
      { $match: { mpesaTransactionId: transactionId } },
      { $group: { _id: null, s: { $sum: '$allocatedAmount' } } },
    ])
    .toArray()
  const n = agg[0]?.s
  return roundMoney(Number(n) || 0)
}

export async function getAllocationAmountForPair(db: Db, orderId: string, transactionId: string): Promise<number> {
  const doc = await db.collection(MPESA_ORDER_ALLOCATIONS).findOne({ mpesaTransactionId: transactionId, orderId })
  return roundMoney(Number(doc?.allocatedAmount) || 0)
}

export async function upsertMpesaOrderAllocation(
  db: Db,
  params: {
    orderId: string
    transactionId: string
    allocatedAmount: number
    linkedBy: string
    notes?: string | null
  }
): Promise<void> {
  const { orderId, transactionId, linkedBy, notes } = params
  const allocatedAmount = roundMoney(params.allocatedAmount)
  const now = new Date()
  await db.collection(MPESA_ORDER_ALLOCATIONS).updateOne(
    { mpesaTransactionId: transactionId, orderId },
    {
      $set: {
        allocatedAmount,
        updatedAt: now,
        createdBy: linkedBy,
        notes: notes != null && String(notes).trim() !== '' ? String(notes).trim() : null,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  )
}

export async function deleteMpesaOrderAllocation(db: Db, orderId: string, transactionId: string): Promise<void> {
  await db.collection(MPESA_ORDER_ALLOCATIONS).deleteOne({ mpesaTransactionId: transactionId, orderId })
}

export async function deleteAllAllocationsForOrder(db: Db, orderId: string): Promise<void> {
  await db.collection(MPESA_ORDER_ALLOCATIONS).deleteMany({ orderId })
}

export async function listOrderIdsForTransaction(db: Db, transactionId: string): Promise<string[]> {
  const rows = await db
    .collection(MPESA_ORDER_ALLOCATIONS)
    .find({ mpesaTransactionId: transactionId })
    .project({ orderId: 1 })
    .toArray()
  return Array.from(new Set(rows.map((r) => String(r.orderId)).filter(Boolean)))
}

/**
 * Denormalize link metadata on mpesa_transactions for legacy readers and dashboards.
 * When multiple orders share a txn, linked_order_id is cleared (callers should use mpesa_linked_order_ids).
 */
export async function refreshMpesaTransactionLinkMetadata(db: Db, transactionId: string): Promise<void> {
  if (!ObjectId.isValid(transactionId)) return
  const oid = new ObjectId(transactionId)
  const total = await sumAllocationsForTransaction(db, transactionId)
  const orderIds = await listOrderIdsForTransaction(db, transactionId)
  const now = new Date()

  if (orderIds.length === 0) {
    await db.collection('mpesa_transactions').updateOne(
      { _id: oid },
      {
        $unset: {
          linked_order_id: '',
          linked_at: '',
          linked_by: '',
          mpesa_allocation_total: '',
          mpesa_linked_order_ids: '',
        },
        $set: { updatedAt: now },
      }
    )
    return
  }

  const last = await db
    .collection(MPESA_ORDER_ALLOCATIONS)
    .find({ mpesaTransactionId: transactionId })
    .sort({ updatedAt: -1 })
    .limit(1)
    .toArray()
  const lastBy = String(last[0]?.createdBy || 'System')
  const lastAt = (last[0]?.updatedAt as Date) || (last[0]?.createdAt as Date) || now

  await db.collection('mpesa_transactions').updateOne(
    { _id: oid },
    {
      $set: {
        mpesa_allocation_total: roundMoney(total),
        mpesa_linked_order_ids: orderIds,
        linked_order_id: orderIds.length === 1 ? orderIds[0] : null,
        linked_at: lastAt instanceof Date ? lastAt : now,
        linked_by: lastBy,
        updatedAt: now,
      },
    }
  )
}

export type AllocationTotalsForApi = {
  allocatedTotal: number
  transactionAmount: number
  remainingUnallocated: number
  allocationStatus: 'none' | 'partial' | 'full'
  linkedOrderIds: string[]
}

export function buildAllocationTotalsForApi(txAmount: number, allocatedTotal: number, linkedOrderIds: string[]): AllocationTotalsForApi {
  const ta = roundMoney(txAmount)
  const at = roundMoney(allocatedTotal)
  const rem = roundMoney(Math.max(0, ta - at))
  let allocationStatus: AllocationTotalsForApi['allocationStatus'] = 'none'
  if (at > MONEY_EPS && rem > MONEY_EPS) allocationStatus = 'partial'
  else if (at > MONEY_EPS && rem <= MONEY_EPS) allocationStatus = 'full'
  return {
    allocatedTotal: at,
    transactionAmount: ta,
    remainingUnallocated: rem,
    allocationStatus,
    linkedOrderIds,
  }
}
