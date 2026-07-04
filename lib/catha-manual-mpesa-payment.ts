import { ObjectId, type Db } from 'mongodb'
import { normalizeMpesaReceiptCode } from '@/lib/mpesa-receipt-normalize'
import { escapeRegex } from '@/lib/catha-orders-list-filter'
import { normalizeMpesaStatus } from '@/lib/mpesa-status'
import { normalizeKenyaPhone, isValidKenyaPhone } from '@/lib/phone-utils'
import { summarizeCathaOrderPayments } from '@/lib/catha-order-payments'
import {
  appendMpesaPaymentToOrder,
  type AppendMpesaResult,
} from '@/lib/catha-append-mpesa-payment'
import {
  ensureMpesaOrderAllocationsIndexes,
  sumAllocationsForTransaction,
  roundMoney,
  MONEY_EPS,
} from '@/lib/catha-mpesa-order-allocations'

export type ManualMpesaPaymentParams = {
  orderId: string
  transactionCode: string
  amount: number
  phone?: string | null
  paymentDate?: string | Date | null
  notes?: string | null
  linkedBy: string
  enteredBy: string
  clientIp?: string | null
}

export type ManualMpesaPaymentResult =
  | (AppendMpesaResult & { ok: true; linkMode: 'created_manual' | 'linked_existing' })
  | {
      ok: false
      error: string
      status: number
      code?: 'ALREADY_LINKED' | 'VALIDATION' | 'SUGGEST_LINK'
      suggestLink?: {
        transactionId: string
        receiptNumber: string | null
        amount: number
        remainingUnallocated: number
        phone: string | null
      }
    }

function parsePaymentDate(raw: string | Date | null | undefined): Date {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const d = new Date(raw.trim())
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

export type ManualTxLookupResult =
  | { status: 'invalid'; transactionCode: string }
  | {
      status: 'already_linked'
      transactionCode: string
      orderId: string
      amount: number
      linkedBy: string
      linkedAt: string
      linkSource?: string | null
      orderTable?: number | null
      customerName?: string | null
    }
  | {
      status: 'exists_unlinked'
      transactionCode: string
      transactionId: string
      amount: number
      phoneMasked: string | null
      receivedAt: string
      remainingUnallocated: number
      allocatedTotal: number
      transactionType?: string | null
      importedFromSafaricom: boolean
    }
  | { status: 'not_found'; transactionCode: string }

function maskKenyaPhoneForDisplay(phone: string | null | undefined): string | null {
  if (phone == null || !String(phone).trim()) return null
  const raw = String(phone).replace(/[\s\-().]/g, '')
  if (raw.length < 6) return '******'
  const prefix = raw.startsWith('+') ? raw.slice(0, 5) : raw.slice(0, 4)
  return `${prefix}******`
}

async function findLinkedPaymentContext(
  db: Db,
  receiptNorm: string
): Promise<{
  orderId: string
  amount: number
  linkedBy: string
  linkedAt: Date | string
  linkSource?: string | null
  orderTable?: number | null
  customerName?: string | null
} | null> {
  if (!receiptNorm || receiptNorm.length < 3) return null
  const rx = new RegExp(`^${escapeRegex(receiptNorm)}$`, 'i')
  const order = await db.collection('orders').findOne({
    $or: [
      { mpesaReceiptNumber: rx },
      { linkedPayments: { $elemMatch: { receiptNumber: rx } } },
    ],
  })
  if (!order) return null

  const links = Array.isArray(order.linkedPayments) ? order.linkedPayments : []
  const match = links.find((p: any) => {
    const pr = normalizeMpesaReceiptCode(p?.receiptNumber || '')
    return pr === receiptNorm
  })

  if (match) {
    return {
      orderId: String(order.id),
      amount: roundMoney(Number(match.amount || 0)),
      linkedBy: String(match.linkedBy || order.linkedBy || '—'),
      linkedAt: match.linkedAt ?? order.linkedAt ?? new Date(),
      linkSource: match.linkSource ?? null,
      orderTable: order.table != null ? Number(order.table) : null,
      customerName: order.customerName != null ? String(order.customerName) : null,
    }
  }

  const legacyReceipt = normalizeMpesaReceiptCode(order.mpesaReceiptNumber)
  if (legacyReceipt === receiptNorm && order.mpesaTransactionId) {
    return {
      orderId: String(order.id),
      amount: roundMoney(Number(order.total || 0)),
      linkedBy: String(order.linkedBy || '—'),
      linkedAt: order.linkedAt ?? new Date(),
      linkSource: null,
      orderTable: order.table != null ? Number(order.table) : null,
      customerName: order.customerName != null ? String(order.customerName) : null,
    }
  }

  return null
}

/** Pre-submit lookup: linked payments, mpesa_transactions, and allocation state. */
export async function lookupMpesaTransactionCode(
  db: Db,
  transactionCode: string,
  _currentOrderId?: string | null
): Promise<ManualTxLookupResult> {
  const norm = normalizeMpesaReceiptCode(transactionCode)
  if (!norm || norm.length < 3) {
    return { status: 'invalid', transactionCode: norm || '' }
  }

  const linkedCtx = await findLinkedPaymentContext(db, norm)
  if (linkedCtx) {
    const linkedAt =
      linkedCtx.linkedAt instanceof Date
        ? linkedCtx.linkedAt.toISOString()
        : new Date(linkedCtx.linkedAt).toISOString()
    return {
      status: 'already_linked',
      transactionCode: norm,
      orderId: linkedCtx.orderId,
      amount: linkedCtx.amount,
      linkedBy: linkedCtx.linkedBy,
      linkedAt,
      linkSource: linkedCtx.linkSource,
      orderTable: linkedCtx.orderTable ?? null,
      customerName: linkedCtx.customerName ?? null,
    }
  }

  const existingTx = await findMpesaTransactionByReceiptCode(db, norm)
  if (existingTx) {
    const txId = String(existingTx._id)
    const txStatus = normalizeMpesaStatus(existingTx.status)
    const txAmt = roundMoney(Number(existingTx.amount || 0))

    await ensureMpesaOrderAllocationsIndexes(db)
    const allocated = await sumAllocationsForTransaction(db, txId)
    const remaining = roundMoney(Math.max(0, txAmt - allocated))

    if (txStatus === 'COMPLETED' && remaining > MONEY_EPS) {
      const receivedRaw =
        existingTx.transaction_date ?? existingTx.createdAt ?? existingTx.updatedAt ?? new Date()
      const receivedAt =
        receivedRaw instanceof Date
          ? receivedRaw.toISOString()
          : new Date(receivedRaw).toISOString()
      return {
        status: 'exists_unlinked',
        transactionCode: norm,
        transactionId: txId,
        amount: txAmt,
        phoneMasked: maskKenyaPhoneForDisplay(
          existingTx.phone_number != null ? String(existingTx.phone_number) : null
        ),
        receivedAt,
        remainingUnallocated: remaining,
        allocatedTotal: roundMoney(allocated),
        transactionType:
          existingTx.transaction_type != null ? String(existingTx.transaction_type) : null,
        importedFromSafaricom:
          String(existingTx.source || '').toUpperCase() !== 'MANUAL' &&
          String(existingTx.transaction_type || '').toUpperCase() !== 'MANUAL',
      }
    }

    if (txStatus === 'COMPLETED' && remaining <= MONEY_EPS) {
      const fallbackOrderId =
        existingTx.linked_order_id != null ? String(existingTx.linked_order_id).trim() : ''
      return {
        status: 'already_linked',
        transactionCode: norm,
        orderId: fallbackOrderId || '—',
        amount: txAmt,
        linkedBy: String(existingTx.linked_by || existingTx.entered_by || '—'),
        linkedAt: (existingTx.linked_at ?? existingTx.updatedAt ?? new Date()).toString(),
        linkSource: existingTx.source === 'MANUAL' ? 'manual' : 'automatic',
      }
    }
  }

  return { status: 'not_found', transactionCode: norm }
}

export async function findMpesaTransactionByReceiptCode(db: Db, transactionCode: string) {
  const norm = normalizeMpesaReceiptCode(transactionCode)
  if (!norm || norm.length < 3) return null
  const rx = new RegExp(`^${escapeRegex(norm)}$`, 'i')
  return db.collection('mpesa_transactions').findOne({
    $or: [{ mpesa_receipt_number: rx }, { transaction_id: rx }],
  })
}

/** True when this receipt/code appears on any order's linked payments. */
export async function isMpesaReceiptOnAnyOrder(db: Db, receiptNorm: string): Promise<boolean> {
  if (!receiptNorm || receiptNorm.length < 3) return false
  const rx = new RegExp(`^${escapeRegex(receiptNorm)}$`, 'i')
  const linkedOrder = await db.collection('orders').findOne({
    $or: [{ mpesaReceiptNumber: rx }, { 'linkedPayments.receiptNumber': rx }],
  })
  return Boolean(linkedOrder)
}

async function createManualMpesaTransactionRecord(
  db: Db,
  params: {
    transactionCode: string
    amount: number
    phone: string | null
    orderId: string
    enteredBy: string
    notes: string | null
    paymentDate: Date
    clientIp: string | null
  }
): Promise<{ transactionId: string }> {
  const norm = normalizeMpesaReceiptCode(params.transactionCode)
  const now = new Date()
  const doc = {
    transaction_type: 'MANUAL',
    source: 'MANUAL',
    payment_method: 'MPESA',
    status: 'COMPLETED',
    mpesa_receipt_number: norm,
    transaction_id: norm,
    amount: roundMoney(params.amount),
    phone_number: params.phone,
    account_reference: params.orderId,
    entered_by: params.enteredBy,
    verified_at: now,
    manual_notes: params.notes,
    manual_entry_ip: params.clientIp,
    createdAt: params.paymentDate,
    updatedAt: now,
  }
  const res = await db.collection('mpesa_transactions').insertOne(doc)
  return { transactionId: String(res.insertedId) }
}

export async function verifyAndLinkManualMpesaPayment(
  db: Db,
  params: ManualMpesaPaymentParams
): Promise<ManualMpesaPaymentResult> {
  const orderId = String(params.orderId || '').trim()
  const transactionCode = normalizeMpesaReceiptCode(params.transactionCode)
  const amount = roundMoney(Number(params.amount))
  const notes = params.notes != null ? String(params.notes).trim().slice(0, 2000) : null
  const paymentDate = parsePaymentDate(params.paymentDate ?? null)

  if (!orderId) {
    return { ok: false, error: 'Order ID is required.', status: 400, code: 'VALIDATION' }
  }
  if (!transactionCode || transactionCode.length < 3) {
    return { ok: false, error: 'Transaction code is required.', status: 400, code: 'VALIDATION' }
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Amount must be greater than zero.', status: 400, code: 'VALIDATION' }
  }
  if (amount < 0) {
    return { ok: false, error: 'Amount cannot be negative.', status: 400, code: 'VALIDATION' }
  }

  let phone: string | null = null
  if (params.phone != null && String(params.phone).trim() !== '') {
    if (!isValidKenyaPhone(params.phone)) {
      return {
        ok: false,
        error: 'Invalid Kenyan phone number. Use 07XXXXXXXX, 01XXXXXXXX, or +254…',
        status: 400,
        code: 'VALIDATION',
      }
    }
    phone = normalizeKenyaPhone(params.phone)
  }

  const order = await db.collection('orders').findOne({ id: orderId })
  if (!order) {
    return { ok: false, error: 'Order not found', status: 404, code: 'VALIDATION' }
  }

  const summary = summarizeCathaOrderPayments(order as any)
  if (amount > summary.balanceDue + MONEY_EPS) {
    return {
      ok: false,
      error: `Amount KSh ${amount.toFixed(2)} exceeds remaining order balance KSh ${summary.balanceDue.toFixed(2)}.`,
      status: 400,
      code: 'VALIDATION',
    }
  }

  const existingTx = await findMpesaTransactionByReceiptCode(db, transactionCode)

  if (existingTx) {
    const txId = String(existingTx._id)
    const txStatus = normalizeMpesaStatus(existingTx.status)
    const txAmt = roundMoney(Number(existingTx.amount || 0))
    await ensureMpesaOrderAllocationsIndexes(db)
    const allocated = await sumAllocationsForTransaction(db, txId)
    const remaining = roundMoney(Math.max(0, txAmt - allocated))
    const alreadyOnOrder = (order.linkedPayments || []).some(
      (p: any) => String(p?.transactionId || '') === txId
    )

    if (alreadyOnOrder) {
      return {
        ok: false,
        error: 'This transaction has already been linked.',
        status: 409,
        code: 'ALREADY_LINKED',
      }
    }

    const receiptLinkedElsewhere = await isMpesaReceiptOnAnyOrder(db, transactionCode)
    if (receiptLinkedElsewhere) {
      return {
        ok: false,
        error: 'This transaction has already been linked.',
        status: 409,
        code: 'ALREADY_LINKED',
      }
    }

    if (txStatus === 'COMPLETED' && remaining > MONEY_EPS) {
      return {
        ok: false,
        error:
          'This M-Pesa transaction already exists in the system. Use Link Existing Transaction instead.',
        status: 409,
        code: 'SUGGEST_LINK',
        suggestLink: {
          transactionId: txId,
          receiptNumber:
            existingTx.mpesa_receipt_number != null
              ? String(existingTx.mpesa_receipt_number)
              : existingTx.transaction_id != null
                ? String(existingTx.transaction_id)
                : transactionCode,
          amount: txAmt,
          remainingUnallocated: remaining,
          phone:
            existingTx.phone_number != null ? String(existingTx.phone_number) : phone,
        },
      }
    }

    if (txStatus === 'COMPLETED' && remaining <= MONEY_EPS) {
      return {
        ok: false,
        error: 'This transaction has already been linked.',
        status: 409,
        code: 'ALREADY_LINKED',
      }
    }
  } else {
    const receiptTaken = await isMpesaReceiptOnAnyOrder(db, transactionCode)
    if (receiptTaken) {
      return {
        ok: false,
        error: 'This transaction has already been linked.',
        status: 409,
        code: 'ALREADY_LINKED',
      }
    }
  }

  const { transactionId } = await createManualMpesaTransactionRecord(db, {
    transactionCode,
    amount,
    phone,
    orderId,
    enteredBy: params.enteredBy,
    notes,
    paymentDate,
    clientIp: params.clientIp ?? null,
  })

  const verifiedAt = new Date()
  const linkResult = await appendMpesaPaymentToOrder(db, {
    orderId,
    transactionId,
    linkedBy: params.linkedBy,
    allocatedAmount: amount,
    notes,
    linkSource: 'manual',
    verifiedAt,
    allocationMode: 'order_balance_then_tx',
  })

  if (!linkResult.ok) {
    await db.collection('mpesa_transactions').deleteOne({ _id: new ObjectId(transactionId) })
    return linkResult
  }

  return { ...linkResult, linkMode: 'created_manual' }
}
