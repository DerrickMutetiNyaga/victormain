import { type Db } from 'mongodb'
import { normalizeMpesaReceiptCode } from '@/lib/mpesa-receipt-normalize'
import { normalizeKenyaPhone, isValidKenyaPhone } from '@/lib/phone-utils'
import { summarizeCathaOrderPayments } from '@/lib/catha-order-payments'
import {
  lookupMpesaTransactionCode,
  verifyAndLinkManualMpesaPayment,
  type ManualMpesaPaymentParams,
} from '@/lib/catha-manual-mpesa-payment'
import { roundMoney, MONEY_EPS } from '@/lib/catha-mpesa-order-allocations'

export const MANUAL_MPESA_VERIFICATIONS = 'catha_manual_mpesa_verifications'

export type ManualMpesaVerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type ManualMpesaVerificationDoc = {
  id: string
  orderId: string
  transactionCode: string
  amount: number
  phone: string | null
  paymentDate: Date
  notes: string | null
  status: ManualMpesaVerificationStatus
  enteredBy: string
  enteredByUserId: string | null
  enteredAt: Date
  clientIp: string | null
  reviewedBy: string | null
  reviewedByUserId: string | null
  reviewedAt: Date | null
  rejectionReason: string | null
  linkedTransactionId: string | null
  updatedAt: Date
}

export type ManualMpesaVerificationForApi = Omit<
  ManualMpesaVerificationDoc,
  'paymentDate' | 'enteredAt' | 'reviewedAt' | 'updatedAt'
> & {
  paymentDate: string
  enteredAt: string
  reviewedAt: string | null
  updatedAt: string
  orderTable?: number | null
  customerName?: string | null
}

let ensureIndexesPromise: Promise<void> | null = null

export async function ensureManualMpesaVerificationIndexes(db: Db): Promise<void> {
  if (!ensureIndexesPromise) {
    ensureIndexesPromise = (async () => {
      const col = db.collection(MANUAL_MPESA_VERIFICATIONS)
      await Promise.all([
        col.createIndex({ status: 1, enteredAt: -1 }, { name: 'mmv_status_entered_idx' }),
        col.createIndex({ transactionCode: 1, status: 1 }, { name: 'mmv_code_status_idx' }),
        col.createIndex({ orderId: 1, status: 1 }, { name: 'mmv_order_status_idx' }),
        col.createIndex({ id: 1 }, { unique: true, name: 'mmv_id_unique' }),
      ])
    })().catch((err) => {
      console.error('[manual-mpesa-verification] index error:', err)
      ensureIndexesPromise = null
    })
  }
  await ensureIndexesPromise
}

function newVerificationId(): string {
  const t = Date.now().toString(36).toUpperCase()
  const r = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `MMV-${t}${r}`
}

function parsePaymentDate(raw: string | Date | null | undefined): Date {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const d = new Date(raw.trim())
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

function docToApi(doc: ManualMpesaVerificationDoc, order?: any): ManualMpesaVerificationForApi {
  return {
    id: doc.id,
    orderId: doc.orderId,
    transactionCode: doc.transactionCode,
    amount: doc.amount,
    phone: doc.phone,
    paymentDate: doc.paymentDate.toISOString(),
    notes: doc.notes,
    status: doc.status,
    enteredBy: doc.enteredBy,
    enteredByUserId: doc.enteredByUserId,
    enteredAt: doc.enteredAt.toISOString(),
    clientIp: doc.clientIp,
    reviewedBy: doc.reviewedBy,
    reviewedByUserId: doc.reviewedByUserId,
    reviewedAt: doc.reviewedAt ? doc.reviewedAt.toISOString() : null,
    rejectionReason: doc.rejectionReason,
    linkedTransactionId: doc.linkedTransactionId,
    updatedAt: doc.updatedAt.toISOString(),
    orderTable: order?.table != null ? Number(order.table) : null,
    customerName: order?.customerName != null ? String(order.customerName) : null,
  }
}

export type SubmitManualMpesaVerificationParams = {
  orderId: string
  transactionCode: string
  amount: number
  phone?: string | null
  paymentDate?: string | Date | null
  notes?: string | null
  enteredBy: string
  enteredByUserId?: string | null
  clientIp?: string | null
}

export type SubmitManualMpesaVerificationResult =
  | { ok: true; verification: ManualMpesaVerificationForApi }
  | { ok: false; error: string; status: number; code?: string }

export async function submitManualMpesaVerification(
  db: Db,
  params: SubmitManualMpesaVerificationParams
): Promise<SubmitManualMpesaVerificationResult> {
  await ensureManualMpesaVerificationIndexes(db)

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

  const lookup = await lookupMpesaTransactionCode(db, transactionCode, orderId)
  if (lookup.status === 'already_linked') {
    return {
      ok: false,
      error: 'This transaction has already been linked.',
      status: 409,
      code: 'ALREADY_LINKED',
    }
  }
  if (lookup.status === 'exists_unlinked') {
    return {
      ok: false,
      error:
        'This M-Pesa transaction already exists in the system. Use Link Existing Transaction instead.',
      status: 409,
      code: 'SUGGEST_LINK',
    }
  }
  if (lookup.status !== 'not_found') {
    return {
      ok: false,
      error: 'Transaction code could not be submitted for manual review.',
      status: 400,
      code: 'VALIDATION',
    }
  }

  const dupPending = await db.collection(MANUAL_MPESA_VERIFICATIONS).findOne({
    transactionCode,
    status: 'PENDING',
  })
  if (dupPending) {
    return {
      ok: false,
      error: 'This transaction code is already pending manager review.',
      status: 409,
      code: 'PENDING_DUPLICATE',
    }
  }

  const now = new Date()
  const doc: ManualMpesaVerificationDoc = {
    id: newVerificationId(),
    orderId,
    transactionCode,
    amount,
    phone,
    paymentDate,
    notes,
    status: 'PENDING',
    enteredBy: params.enteredBy,
    enteredByUserId: params.enteredByUserId ?? null,
    enteredAt: now,
    clientIp: params.clientIp ?? null,
    reviewedBy: null,
    reviewedByUserId: null,
    reviewedAt: null,
    rejectionReason: null,
    linkedTransactionId: null,
    updatedAt: now,
  }

  await db.collection(MANUAL_MPESA_VERIFICATIONS).insertOne(doc)

  return { ok: true, verification: docToApi(doc, order) }
}

export async function listPendingManualMpesaVerifications(
  db: Db,
  limit = 50
): Promise<ManualMpesaVerificationForApi[]> {
  await ensureManualMpesaVerificationIndexes(db)
  const rows = await db
    .collection<ManualMpesaVerificationDoc>(MANUAL_MPESA_VERIFICATIONS)
    .find({ status: 'PENDING' })
    .sort({ enteredAt: 1 })
    .limit(Math.min(limit, 100))
    .toArray()

  const orderIds = [...new Set(rows.map((r) => r.orderId))]
  const orders = await db
    .collection('orders')
    .find({ id: { $in: orderIds } })
    .project({ id: 1, table: 1, customerName: 1 })
    .toArray()
  const orderById = new Map(orders.map((o) => [String(o.id), o]))

  return rows.map((r) => docToApi(r, orderById.get(r.orderId)))
}

export async function countPendingManualMpesaVerifications(db: Db): Promise<number> {
  await ensureManualMpesaVerificationIndexes(db)
  return db.collection(MANUAL_MPESA_VERIFICATIONS).countDocuments({ status: 'PENDING' })
}

export type ReviewManualMpesaVerificationResult =
  | {
      ok: true
      verification: ManualMpesaVerificationForApi
      linkResult: Awaited<ReturnType<typeof verifyAndLinkManualMpesaPayment>> & { ok: true }
    }
  | { ok: false; error: string; status: number; code?: string }

export async function approveManualMpesaVerification(
  db: Db,
  verificationId: string,
  reviewedBy: string,
  reviewedByUserId?: string | null
): Promise<ReviewManualMpesaVerificationResult> {
  await ensureManualMpesaVerificationIndexes(db)

  const doc = await db
    .collection<ManualMpesaVerificationDoc>(MANUAL_MPESA_VERIFICATIONS)
    .findOne({ id: verificationId, status: 'PENDING' })
  if (!doc) {
    return { ok: false, error: 'Pending verification not found.', status: 404 }
  }

  const lookup = await lookupMpesaTransactionCode(db, doc.transactionCode, doc.orderId)
  if (lookup.status === 'already_linked') {
    return {
      ok: false,
      error: 'This transaction has already been linked since submission.',
      status: 409,
      code: 'ALREADY_LINKED',
    }
  }
  if (lookup.status === 'exists_unlinked') {
    return {
      ok: false,
      error:
        'This transaction now exists in M-Pesa records. Link it via Link Existing Transaction instead.',
      status: 409,
      code: 'SUGGEST_LINK',
    }
  }

  const linkParams: ManualMpesaPaymentParams = {
    orderId: doc.orderId,
    transactionCode: doc.transactionCode,
    amount: doc.amount,
    phone: doc.phone,
    paymentDate: doc.paymentDate,
    notes: doc.notes,
    linkedBy: reviewedBy,
    enteredBy: doc.enteredBy,
    clientIp: doc.clientIp,
  }

  const linkResult = await verifyAndLinkManualMpesaPayment(db, linkParams)
  if (!linkResult.ok) {
    return { ok: false, error: linkResult.error, status: linkResult.status, code: linkResult.code }
  }

  const now = new Date()
  await db.collection(MANUAL_MPESA_VERIFICATIONS).updateOne(
    { id: verificationId },
    {
      $set: {
        status: 'APPROVED',
        reviewedBy,
        reviewedByUserId: reviewedByUserId ?? null,
        reviewedAt: now,
        linkedTransactionId: linkResult.transactionId,
        updatedAt: now,
      },
    }
  )

  const updated = await db
    .collection<ManualMpesaVerificationDoc>(MANUAL_MPESA_VERIFICATIONS)
    .findOne({ id: verificationId })
  const order = await db.collection('orders').findOne({ id: doc.orderId })

  return {
    ok: true,
    verification: docToApi(updated!, order),
    linkResult,
  }
}

export async function rejectManualMpesaVerification(
  db: Db,
  verificationId: string,
  reviewedBy: string,
  rejectionReason: string | null,
  reviewedByUserId?: string | null
): Promise<{ ok: true; verification: ManualMpesaVerificationForApi } | { ok: false; error: string; status: number }> {
  await ensureManualMpesaVerificationIndexes(db)

  const doc = await db
    .collection<ManualMpesaVerificationDoc>(MANUAL_MPESA_VERIFICATIONS)
    .findOne({ id: verificationId, status: 'PENDING' })
  if (!doc) {
    return { ok: false, error: 'Pending verification not found.', status: 404 }
  }

  const now = new Date()
  const reason =
    rejectionReason != null ? String(rejectionReason).trim().slice(0, 2000) : null

  await db.collection(MANUAL_MPESA_VERIFICATIONS).updateOne(
    { id: verificationId },
    {
      $set: {
        status: 'REJECTED',
        reviewedBy,
        reviewedByUserId: reviewedByUserId ?? null,
        reviewedAt: now,
        rejectionReason: reason,
        updatedAt: now,
      },
    }
  )

  const updated = await db
    .collection<ManualMpesaVerificationDoc>(MANUAL_MPESA_VERIFICATIONS)
    .findOne({ id: verificationId })
  const order = await db.collection('orders').findOne({ id: doc.orderId })

  return { ok: true, verification: docToApi(updated!, order) }
}
