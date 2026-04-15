import type { Filter } from 'mongodb'

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export type OrdersListQuery = {
  q: string
  paymentMethod: 'all' | 'glovo' | 'mpesa' | 'card'
  paymentStatus: 'all' | 'PAID' | 'PARTIALLY_PAID' | 'NOT_PAID'
  lifecycle: 'all' | 'cancelled'
}

/**
 * Mongo filter for Catha orders list (search + toolbar filters). Used with count + find + sort + skip/limit.
 */
export function buildOrdersListMongoFilter(query: OrdersListQuery): Filter<Record<string, unknown>> {
  const parts: Filter<Record<string, unknown>>[] = []

  const t = query.q.trim()
  if (t) {
    const esc = escapeRegex(t)
    const searchOr: Filter<Record<string, unknown>>[] = [
      { id: { $regex: esc, $options: 'i' } },
      { customerName: { $regex: esc, $options: 'i' } },
      { customerPhone: { $regex: esc, $options: 'i' } },
      { cashier: { $regex: esc, $options: 'i' } },
      { waiter: { $regex: esc, $options: 'i' } },
      { glovoOrderNumber: { $regex: esc, $options: 'i' } },
      { mpesaReceiptNumber: { $regex: esc, $options: 'i' } },
      { 'items.name': { $regex: esc, $options: 'i' } },
    ]
    if (/^\d+$/.test(t)) {
      const n = Number(t)
      if (Number.isFinite(n)) searchOr.push({ table: n })
    }
    parts.push({ $or: searchOr })
  }

  if (query.lifecycle === 'cancelled') {
    parts.push({ status: { $in: ['cancelled', 'voided'] } })
  }

  if (query.paymentMethod !== 'all') {
    parts.push({
      paymentMethod: { $regex: new RegExp(`^${escapeRegex(query.paymentMethod)}$`, 'i') },
    })
  }

  if (query.paymentStatus !== 'all') {
    if (query.paymentStatus === 'PARTIALLY_PAID') {
      parts.push({ paymentStatus: 'PARTIALLY_PAID' })
    } else if (query.paymentStatus === 'PAID') {
      parts.push({
        $or: [
          { paymentStatus: { $in: ['PAID', 'COMPLETED', 'OVERPAID'] } },
          {
            $and: [{ status: 'completed' }, { paymentStatus: { $ne: 'PARTIALLY_PAID' } }],
          },
        ],
      })
    } else if (query.paymentStatus === 'NOT_PAID') {
      parts.push({
        $nor: [
          { paymentStatus: 'PARTIALLY_PAID' },
          { paymentStatus: 'PAID' },
          { paymentStatus: 'OVERPAID' },
          { paymentStatus: 'COMPLETED' },
          { status: 'completed' },
        ],
      })
    }
  }

  if (parts.length === 0) return {}
  if (parts.length === 1) return parts[0]!
  return { $and: parts }
}
