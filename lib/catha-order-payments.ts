/**
 * Catha POS order payment math: multiple M-Pesa links, partial pay, overpay.
 * Used by API routes and client UI — keep logic identical.
 */

export type CathaPaymentStatus = "NOT_PAID" | "PARTIALLY_PAID" | "PAID"

export interface LinkedMpesaPayment {
  method: "mpesa"
  transactionId: string
  receiptNumber: string | null
  amount: number
  phone: string | null
  linkedAt: string | Date
  linkedBy: string
}

export interface OrderPaymentSummary {
  orderTotal: number
  totalLinkedPayments: number
  balanceDue: number
  overpaymentAmount: number
  paymentStatus: CathaPaymentStatus
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Normalize legacy single mpesaTransactionId into a synthetic linked row for display/math only */
export function getEffectiveLinkedPayments(order: {
  linkedPayments?: LinkedMpesaPayment[] | null
  mpesaTransactionId?: string | null
  mpesaReceiptNumber?: string | null
  total?: number
  linkedAt?: Date | string | null
  linkedBy?: string | null
}): LinkedMpesaPayment[] {
  const raw = Array.isArray(order.linkedPayments) ? order.linkedPayments : []
  const cleaned = raw
    .filter((p) => p && p.method === "mpesa" && String(p.transactionId || "").trim())
    .map((p) => ({
      method: "mpesa" as const,
      transactionId: String(p.transactionId).trim(),
      receiptNumber: p.receiptNumber != null ? String(p.receiptNumber) : null,
      amount: num(p.amount),
      phone: p.phone != null ? String(p.phone) : null,
      linkedAt: p.linkedAt ?? new Date().toISOString(),
      linkedBy: String(p.linkedBy || "System"),
    }))

  if (cleaned.length > 0) return cleaned

  const legacyId = order.mpesaTransactionId ? String(order.mpesaTransactionId).trim() : ""
  if (!legacyId) return []

  return [
    {
      method: "mpesa",
      transactionId: legacyId,
      receiptNumber: order.mpesaReceiptNumber != null ? String(order.mpesaReceiptNumber) : null,
      amount: num(order.total),
      phone: null,
      linkedAt: order.linkedAt ?? new Date().toISOString(),
      linkedBy: String(order.linkedBy || "System"),
    },
  ]
}

export function summarizeCathaOrderPayments(order: {
  total?: number
  linkedPayments?: LinkedMpesaPayment[] | null
  mpesaTransactionId?: string | null
  mpesaReceiptNumber?: string | null
  linkedAt?: Date | string | null
  linkedBy?: string | null
  /** Non-M-Pesa cash received (legacy) — counts toward total received */
  cashAmount?: number | null
}): OrderPaymentSummary {
  const orderTotal = Math.max(0, num(order.total))
  const fromLinks = getEffectiveLinkedPayments(order).reduce((s, p) => s + num(p.amount), 0)
  const cashExtra = num(order.cashAmount)
  const totalLinkedPayments = fromLinks + cashExtra

  const balanceDue = Math.max(0, orderTotal - totalLinkedPayments)
  const overpaymentAmount = Math.max(0, totalLinkedPayments - orderTotal)

  let paymentStatus: CathaPaymentStatus
  if (totalLinkedPayments <= 0) paymentStatus = "NOT_PAID"
  else if (totalLinkedPayments < orderTotal) paymentStatus = "PARTIALLY_PAID"
  else paymentStatus = "PAID"

  return {
    orderTotal,
    totalLinkedPayments,
    balanceDue,
    overpaymentAmount,
    paymentStatus,
  }
}

/** API/FE payload: consistent payment fields + ISO dates for linked payments */
export function formatCathaOrderForApi(order: Record<string, any>) {
  const summary = summarizeCathaOrderPayments(order)
  const linked = getEffectiveLinkedPayments(order).map((p) => ({
    ...p,
    linkedAt:
      typeof p.linkedAt === 'string'
        ? p.linkedAt
        : p.linkedAt instanceof Date
          ? p.linkedAt.toISOString()
          : new Date(p.linkedAt as string).toISOString(),
  }))

  const psDb = String(order.paymentStatus || '').toUpperCase()
  const paymentStatusOut =
    summary.paymentStatus === 'PAID'
      ? 'PAID'
      : summary.paymentStatus === 'PARTIALLY_PAID'
        ? 'PARTIALLY_PAID'
        : psDb === 'PAID'
          ? 'PAID'
          : psDb === 'PARTIALLY_PAID'
            ? 'PARTIALLY_PAID'
            : 'NOT_PAID'

  return {
    linkedPayments: linked,
    totalLinkedPayments: summary.totalLinkedPayments,
    balanceDue: summary.balanceDue,
    overpaymentAmount: summary.overpaymentAmount,
    paymentStatus: paymentStatusOut,
  }
}
