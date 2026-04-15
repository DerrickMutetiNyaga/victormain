import { ObjectId, type Db } from 'mongodb'
import { normalizeMpesaStatus } from '@/lib/mpesa-status'
import { summarizeCathaOrderPayments, type LinkedMpesaPayment } from '@/lib/catha-order-payments'
import { normalizeMpesaReceiptCode } from '@/lib/mpesa-receipt-normalize'
import { escapeRegex } from '@/lib/catha-orders-list-filter'

export type AppendMpesaResult =
  | {
      ok: true
      orderId: string
      transactionId: string
      summary: ReturnType<typeof summarizeCathaOrderPayments>
      linkedPayments: LinkedMpesaPayment[]
      mpesaReceiptNumber: string | null
      linkedAt: Date
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

export async function appendMpesaPaymentToOrder(
  db: Db,
  params: { orderId: string; transactionId: string; linkedBy: string }
): Promise<AppendMpesaResult> {
  const { orderId, transactionId, linkedBy } = params
  if (!orderId || !transactionId || !ObjectId.isValid(transactionId)) {
    return { ok: false, error: 'Invalid order or transaction', status: 400 }
  }

  const order = await db.collection('orders').findOne({ id: orderId })
  if (!order) return { ok: false, error: 'Order not found', status: 404 }

  const tx = await db.collection('mpesa_transactions').findOne({ _id: new ObjectId(transactionId) })
  if (!tx) return { ok: false, error: 'M-Pesa transaction not found', status: 404 }

  const txStatus = normalizeMpesaStatus(tx.status)
  if (txStatus !== 'COMPLETED') {
    return { ok: false, error: 'Only completed M-Pesa transactions can be linked', status: 400 }
  }

  const txAmt = Number(tx.amount || 0)
  const phone = tx.phone_number != null ? String(tx.phone_number) : null
  const mpesaReceiptNumber =
    tx.mpesa_receipt_number || tx.transaction_id || tx.checkout_request_id || null

  const linkedAt = new Date()
  const receiptNorm = normalizeMpesaReceiptCode(
    mpesaReceiptNumber != null ? String(mpesaReceiptNumber) : tx.transaction_id != null ? String(tx.transaction_id) : ''
  )

  // —— Global duplicate: transaction already tied to another order ——
  const otherOrder = await db.collection('orders').findOne({
    id: { $ne: orderId },
    $or: [{ mpesaTransactionId: transactionId }, { 'linkedPayments.transactionId': transactionId }],
  })
  if (otherOrder) {
    return {
      ok: false,
      error: `This M-Pesa payment is already linked to order ${otherOrder.id}. Each payment can only be attached to one order.`,
      status: 409,
    }
  }

  const existingGlobal = await db.collection('mpesa_transactions').findOne({ _id: new ObjectId(transactionId) })
  const glo = existingGlobal?.linked_order_id
  if (glo && String(glo) !== orderId) {
    return {
      ok: false,
      error: `This M-Pesa payment is already linked to order ${String(glo)}. Each payment can only be attached to one order.`,
      status: 409,
    }
  }

  // —— Same M-Pesa receipt / code cannot be used on two orders ——
  if (receiptNorm.length >= 3) {
    const rx = new RegExp(`^${escapeRegex(receiptNorm)}$`, 'i')
    const orderReceiptDup = await db.collection('orders').findOne({
      id: { $ne: orderId },
      $or: [{ mpesaReceiptNumber: rx }, { linkedPayments: { $elemMatch: { receiptNumber: rx } } }],
    })
    if (orderReceiptDup) {
      return {
        ok: false,
        error: `This M-Pesa receipt/code is already attached to order ${orderReceiptDup.id}.`,
        status: 409,
      }
    }
    const txReceiptDup = await db.collection('mpesa_transactions').findOne({
      _id: { $ne: new ObjectId(transactionId) },
      linked_order_id: { $exists: true, $nin: [null, ''] },
      $or: [{ mpesa_receipt_number: rx }, { transaction_id: rx }],
    })
    if (txReceiptDup && String(txReceiptDup.linked_order_id) !== orderId) {
      return {
        ok: false,
        error: `This M-Pesa receipt/code is already linked to order ${String(txReceiptDup.linked_order_id)}.`,
        status: 409,
      }
    }
  }

  let list = baseLinkedListFromOrder(order)
  if (list.some((p) => p.transactionId === transactionId)) {
    return { ok: false, error: 'This transaction is already linked to this order', status: 409 }
  }

  if (receiptNorm.length >= 3) {
    const dupReceiptOnOrder = list.some((p) => {
      const pr = normalizeMpesaReceiptCode(p.receiptNumber || '')
      return pr === receiptNorm && p.transactionId !== transactionId
    })
    if (dupReceiptOnOrder) {
      return {
        ok: false,
        error: 'This M-Pesa receipt/code is already attached to this order.',
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

  list.push({
    method: 'mpesa',
    transactionId,
    receiptNumber: mpesaReceiptNumber != null ? String(mpesaReceiptNumber) : null,
    amount: txAmt,
    phone,
    payerName,
    mpesaStatus: txStatus,
    transactionDate: transactionDateRaw,
    linkedAt,
    linkedBy,
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

  await db.collection('mpesa_transactions').updateOne(
    { _id: new ObjectId(transactionId) },
    {
      $set: {
        linked_order_id: orderId,
        linked_at: linkedAt,
        linked_by: linkedBy,
        updatedAt: linkedAt,
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
          paymentMethod: 'mpesa',
          updatedAt: linkedAt,
        },
      }
    )
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
