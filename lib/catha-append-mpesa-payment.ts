import { ObjectId, type Db } from 'mongodb'
import { normalizeMpesaStatus } from '@/lib/mpesa-status'
import { summarizeCathaOrderPayments, type LinkedMpesaPayment } from '@/lib/catha-order-payments'
import { normalizeMpesaReceiptCode } from '@/lib/mpesa-receipt-normalize'
import { escapeRegex } from '@/lib/catha-orders-list-filter'
import {
  ensureMpesaOrderAllocationsIndexes,
  materializeAllocationsFromOrders,
  sumAllocationsForTransaction,
  getAllocationAmountForPair,
  upsertMpesaOrderAllocation,
  refreshMpesaTransactionLinkMetadata,
  MONEY_EPS,
  roundMoney,
  type AllocationTotalsForApi,
  buildAllocationTotalsForApi,
  listOrderIdsForTransaction,
} from '@/lib/catha-mpesa-order-allocations'
import { maybeSendCathaPaymentReceiptSms } from '@/lib/catha-payment-sms'

export type AppendMpesaPaymentParams = {
  orderId: string
  transactionId: string
  linkedBy: string
  /** When set, this amount is applied to the order (must fit remaining transaction balance). */
  allocatedAmount?: number | null
  notes?: string | null
  linkSource?: 'automatic' | 'staff_link' | 'manual'
  verifiedAt?: Date | null
  /**
   * When allocatedAmount is omitted:
   * - full_transaction — min(remaining, full tx amount) for STK / reconcile flows
   * - order_balance_then_tx — min(remaining, order balance due), else min(remaining, tx amount) when already settled
   */
  allocationMode?: 'full_transaction' | 'order_balance_then_tx'
}

export type AppendMpesaResult =
  | {
      ok: true
      orderId: string
      transactionId: string
      summary: ReturnType<typeof summarizeCathaOrderPayments>
      linkedPayments: LinkedMpesaPayment[]
      mpesaReceiptNumber: string | null
      linkedAt: Date
      transactionAllocation: AllocationTotalsForApi
    }
  | { ok: false; error: string; status: number }

function toIso(d: Date | string | undefined): string {
  if (!d) return new Date().toISOString()
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString()
}

/** Build stored linkedPayments from DB order + ensure legacy row is merged once */
export function baseLinkedListFromOrder(order: any): LinkedMpesaPayment[] {
  const arr = Array.isArray(order.linkedPayments) ? [...order.linkedPayments] : []
  if (arr.length > 0) {
    return arr
      .filter((p: any) => p && String(p.transactionId || '').trim())
      .map((p: any) => ({
        method: 'mpesa' as const,
        transactionId: String(p.transactionId).trim(),
        receiptNumber: p.receiptNumber != null ? String(p.receiptNumber) : null,
        amount: Number(p.amount) || 0,
        phone: p.phone != null ? String(p.phone) : null,
        payerName: p.payerName != null ? String(p.payerName) : null,
        mpesaStatus: p.mpesaStatus != null ? String(p.mpesaStatus) : null,
        transactionDate: p.transactionDate ?? null,
        linkedAt: p.linkedAt ?? new Date(),
        linkedBy: String(p.linkedBy || 'System'),
        linkSource: p.linkSource ?? null,
        notes: p.notes != null ? String(p.notes) : null,
        verifiedAt: p.verifiedAt ?? null,
      }))
  }
  const legacy = order.mpesaTransactionId ? String(order.mpesaTransactionId).trim() : ''
  if (!legacy) return []
  return [
    {
      method: 'mpesa',
      transactionId: legacy,
      receiptNumber: order.mpesaReceiptNumber != null ? String(order.mpesaReceiptNumber) : null,
      amount: Number(order.total) || 0,
      phone: null,
      payerName: null,
      mpesaStatus: null,
      transactionDate: null,
      linkedAt: order.linkedAt ?? new Date(),
      linkedBy: String(order.linkedBy || 'System'),
    },
  ]
}

export async function appendMpesaPaymentToOrder(db: Db, params: AppendMpesaPaymentParams): Promise<AppendMpesaResult> {
  const { orderId, transactionId, linkedBy, notes } = params
  const allocationMode = params.allocationMode ?? 'order_balance_then_tx'

  if (!orderId || !transactionId || !ObjectId.isValid(transactionId)) {
    return { ok: false, error: 'Invalid order or transaction', status: 400 }
  }

  await ensureMpesaOrderAllocationsIndexes(db)

  const order = await db.collection('orders').findOne({ id: orderId })
  if (!order) return { ok: false, error: 'Order not found', status: 404 }

  const tx = await db.collection('mpesa_transactions').findOne({ _id: new ObjectId(transactionId) })
  if (!tx) return { ok: false, error: 'M-Pesa transaction not found', status: 404 }

  const txStatus = normalizeMpesaStatus(tx.status)
  if (txStatus !== 'COMPLETED') {
    return { ok: false, error: 'Only completed M-Pesa transactions can be linked', status: 400 }
  }

  const txAmt = roundMoney(Number(tx.amount || 0))
  if (txAmt <= 0) {
    return { ok: false, error: 'M-Pesa transaction has no positive amount', status: 400 }
  }

  const phone = tx.phone_number != null ? String(tx.phone_number) : null
  const mpesaReceiptNumber =
    tx.mpesa_receipt_number || tx.transaction_id || tx.checkout_request_id || null

  const linkedAt = new Date()
  const receiptNorm = normalizeMpesaReceiptCode(
    mpesaReceiptNumber != null ? String(mpesaReceiptNumber) : tx.transaction_id != null ? String(tx.transaction_id) : ''
  )

  await materializeAllocationsFromOrders(db, transactionId)
  const totalAllocatedBefore = await sumAllocationsForTransaction(db, transactionId)
  const thisPairBefore = await getAllocationAmountForPair(db, orderId, transactionId)
  const othersAllocated = roundMoney(totalAllocatedBefore - thisPairBefore)
  const room = roundMoney(txAmt - othersAllocated)

  const listSansThis = baseLinkedListFromOrder(order).filter((p) => p.transactionId !== transactionId)
  const orderSansThisTx = { ...order, linkedPayments: listSansThis, mpesaTransactionId: null }
  const preSummary = summarizeCathaOrderPayments(orderSansThisTx)
  const balanceDue = roundMoney(preSummary.balanceDue)

  let requested: number
  if (params.allocatedAmount != null && !Number.isNaN(Number(params.allocatedAmount))) {
    requested = roundMoney(Number(params.allocatedAmount))
  } else if (allocationMode === 'full_transaction') {
    requested = roundMoney(Math.min(room, txAmt))
  } else {
    if (balanceDue > MONEY_EPS) {
      requested = roundMoney(Math.min(room, balanceDue))
    } else {
      requested = roundMoney(Math.min(room, txAmt))
    }
  }

  if (requested <= MONEY_EPS) {
    return {
      ok: false,
      error:
        room <= MONEY_EPS
          ? 'This M-Pesa transaction has no remaining balance to allocate (fully used on other orders).'
          : 'Allocation amount must be greater than zero.',
      status: 400,
    }
  }

  if (requested > room + MONEY_EPS) {
    return {
      ok: false,
      error: `Allocation KSh ${requested.toFixed(2)} exceeds remaining transaction balance KSh ${room.toFixed(2)}.`,
      status: 400,
    }
  }

  // —— Same receipt on a different M-Pesa transaction record already in use ——
  if (receiptNorm.length >= 3) {
    const rx = new RegExp(`^${escapeRegex(receiptNorm)}$`, 'i')
    const otherTx = await db.collection('mpesa_transactions').findOne({
      _id: { $ne: new ObjectId(transactionId) },
      $or: [{ mpesa_receipt_number: rx }, { transaction_id: rx }],
    })
    if (otherTx) {
      const otherId = String(otherTx._id)
      const otherAlloc = await sumAllocationsForTransaction(db, otherId)
      const legacyOther = otherTx.linked_order_id != null && String(otherTx.linked_order_id).trim() !== ''
      if (otherAlloc > MONEY_EPS || legacyOther) {
        return {
          ok: false,
          error: 'Another M-Pesa record with the same receipt is already linked. Resolve the duplicate record first.',
          status: 409,
        }
      }
    }
  }

  // —— Same receipt string already on this order via a different transaction id ——
  if (receiptNorm.length >= 3) {
    const dupReceiptOnOrder = listSansThis.some((p) => {
      const pr = normalizeMpesaReceiptCode(p.receiptNumber || '')
      return pr === receiptNorm && p.transactionId !== transactionId
    })
    if (dupReceiptOnOrder) {
      return {
        ok: false,
        error: 'This M-Pesa receipt/code is already attached to this order on a different transaction.',
        status: 409,
      }
    }
  }

  // —— Another order: same receipt on a different transaction id ——
  if (receiptNorm.length >= 3) {
    const rx = new RegExp(`^${escapeRegex(receiptNorm)}$`, 'i')
    const orderReceiptDup = await db.collection('orders').findOne({
      id: { $ne: orderId },
      $or: [
        {
          mpesaReceiptNumber: rx,
          mpesaTransactionId: { $exists: true, $nin: [null, '', transactionId] },
        },
        {
          linkedPayments: {
            $elemMatch: {
              receiptNumber: rx,
              transactionId: { $exists: true, $ne: transactionId },
            },
          },
        },
      ],
    })
    if (orderReceiptDup) {
      return {
        ok: false,
        error: `This M-Pesa receipt/code is already attached to order ${orderReceiptDup.id} (different transaction).`,
        status: 409,
      }
    }
  }

  let payerName: string | null = null
  if (tx.customer_name != null && String(tx.customer_name).trim()) {
    payerName = String(tx.customer_name).trim()
  } else {
    const parts = [tx.customer_first_name, tx.customer_middle_name, tx.customer_last_name].filter(
      (x: unknown) => x != null && String(x).trim() !== ''
    )
    payerName = parts.length ? parts.map((x: unknown) => String(x).trim()).join(' ') : null
  }
  const transactionDateRaw = tx.transaction_date ?? tx.createdAt ?? linkedAt
  const linkSource = params.linkSource ?? 'staff_link'
  const paymentNotes = notes ?? null
  const verifiedAt = params.verifiedAt ?? (linkSource === 'manual' ? linkedAt : null)

  const list = [...listSansThis]
  list.push({
    method: 'mpesa',
    transactionId,
    receiptNumber: mpesaReceiptNumber != null ? String(mpesaReceiptNumber) : null,
    amount: requested,
    phone,
    payerName,
    mpesaStatus: txStatus,
    transactionDate: transactionDateRaw,
    linkedAt,
    linkedBy,
    linkSource,
    notes: paymentNotes,
    verifiedAt,
  })

  await upsertMpesaOrderAllocation(db, {
    orderId,
    transactionId,
    allocatedAmount: requested,
    linkedBy,
    notes: notes ?? null,
  })

  const summary = summarizeCathaOrderPayments({
    ...order,
    linkedPayments: list,
    mpesaTransactionId: null,
  })

  const paymentStatus =
    summary.paymentStatus === 'PAID'
      ? 'PAID'
      : summary.paymentStatus === 'OVERPAID'
        ? 'OVERPAID'
        : summary.paymentStatus === 'PARTIALLY_PAID'
          ? 'PARTIALLY_PAID'
          : 'NOT_PAID'

  const orderCompleted = summary.paymentStatus === 'PAID' || summary.paymentStatus === 'OVERPAID'

  const overpaymentAmount = summary.overpaymentAmount
  const changePatch: Record<string, unknown> =
    overpaymentAmount > 0
      ? {
          changeGiven: false,
          changeGivenAt: null,
          changeGivenBy: null,
          changeNotes: null,
        }
      : {
          changeGiven: false,
          changeGivenAt: null,
          changeGivenBy: null,
          changeNotes: null,
        }

  await db.collection('orders').updateOne(
    { id: orderId },
    {
      $set: {
        paymentMethod: 'mpesa',
        linkedPayments: list,
        mpesaTransactionId: transactionId,
        mpesaReceiptNumber: mpesaReceiptNumber != null ? String(mpesaReceiptNumber) : null,
        linkedAt,
        linkedBy,
        totalLinkedPayments: summary.totalLinkedPayments,
        balanceDue: summary.balanceDue,
        overpaymentAmount: summary.overpaymentAmount,
        paymentStatus,
        status: orderCompleted ? 'completed' : 'pending',
        updatedAt: linkedAt,
        ...changePatch,
      },
    }
  )

  await refreshMpesaTransactionLinkMetadata(db, transactionId)

  const linkedIds = await listOrderIdsForTransaction(db, transactionId)
  const totalAfter = await sumAllocationsForTransaction(db, transactionId)
  const transactionAllocation = buildAllocationTotalsForApi(txAmt, totalAfter, linkedIds)

  if (orderCompleted) {
    await db.collection('menu_orders').updateOne(
      { orderId },
      {
        $set: {
          status: 'paid',
          paymentStatus: 'PAID',
          paymentMethod: 'mpesa',
          updatedAt: linkedAt,
        },
      }
    )
    try {
      await maybeSendCathaPaymentReceiptSms(db, orderId)
    } catch (smsError) {
      console.error('[appendMpesaPaymentToOrder] Failed to send payment receipt SMS:', smsError)
    }
  } else {
    await db.collection('menu_orders').updateOne(
      { orderId },
      {
        $set: {
          paymentStatus: summary.paymentStatus === 'PARTIALLY_PAID' ? 'PARTIALLY_PAID' : 'UNPAID',
          updatedAt: linkedAt,
        },
      }
    )
  }

  return {
    ok: true,
    orderId,
    transactionId,
    summary,
    linkedPayments: list.map((p) => ({
      ...p,
      linkedAt: toIso(p.linkedAt as Date),
    })),
    mpesaReceiptNumber: mpesaReceiptNumber != null ? String(mpesaReceiptNumber) : null,
    linkedAt,
    transactionAllocation,
  }
}

/** Recompute order payment fields from linkedPayments only (after unlink) */
export async function recalculateOrderPaymentsAfterLinks(db: Db, orderId: string): Promise<void> {
  const order = await db.collection('orders').findOne({ id: orderId })
  if (!order) return

  const list = baseLinkedListFromOrder(order).filter((p) => p.method === 'mpesa')
  const summary = summarizeCathaOrderPayments({
    ...order,
    linkedPayments: list,
    mpesaTransactionId: null,
  })

  const paymentStatus =
    summary.paymentStatus === 'PAID'
      ? 'PAID'
      : summary.paymentStatus === 'OVERPAID'
        ? 'OVERPAID'
        : summary.paymentStatus === 'PARTIALLY_PAID'
          ? 'PARTIALLY_PAID'
          : 'NOT_PAID'

  const orderCompleted = summary.paymentStatus === 'PAID' || summary.paymentStatus === 'OVERPAID'
  const now = new Date()

  const overpaymentAmount = summary.overpaymentAmount
  const changePatch: Record<string, unknown> =
    overpaymentAmount > 0
      ? {}
      : {
          changeGiven: false,
          changeGivenAt: null,
          changeGivenBy: null,
          changeNotes: null,
        }

  const last = list[list.length - 1]

  if (list.length === 0) {
    await db.collection('orders').updateOne(
      { id: orderId },
      {
        $set: {
          linkedPayments: [],
          totalLinkedPayments: 0,
          balanceDue: summary.orderTotal,
          overpaymentAmount: 0,
          paymentStatus: 'NOT_PAID',
          status: 'pending',
          mpesaTransactionId: null,
          mpesaReceiptNumber: null,
          linkedAt: null,
          linkedBy: null,
          updatedAt: now,
          ...changePatch,
        },
      }
    )
    await db.collection('menu_orders').updateOne(
      { orderId },
      { $set: { paymentStatus: 'UNPAID', updatedAt: now } }
    )
    return
  }

  await db.collection('orders').updateOne(
    { id: orderId },
    {
      $set: {
        linkedPayments: list,
        totalLinkedPayments: summary.totalLinkedPayments,
        balanceDue: summary.balanceDue,
        overpaymentAmount: summary.overpaymentAmount,
        paymentStatus,
        status: orderCompleted ? 'completed' : 'pending',
        mpesaTransactionId: last ? last.transactionId : null,
        mpesaReceiptNumber: last ? last.receiptNumber : null,
        linkedAt: last ? last.linkedAt : null,
        linkedBy: last ? last.linkedBy : null,
        updatedAt: now,
        ...changePatch,
      },
    }
  )

  if (orderCompleted) {
    await db.collection('menu_orders').updateOne(
      { orderId },
      {
        $set: {
          status: 'paid',
          paymentStatus: 'PAID',
          paymentMethod: order.paymentMethod || 'mpesa',
          updatedAt: now,
        },
      }
    )
  } else {
    await db.collection('menu_orders').updateOne(
      { orderId },
      {
        $set: {
          paymentStatus: summary.paymentStatus === 'PARTIALLY_PAID' ? 'PARTIALLY_PAID' : 'UNPAID',
          updatedAt: now,
        },
      }
    )
  }
}
