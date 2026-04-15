/**
 * Structured audit logs for order-pricing and suspicious request handling.
 */

export type OrderSecurityAuditPayload = {
  route: string
  action: string
  userId?: string | null
  role?: string | null
  ip?: string
  userAgent?: string | null
  rejected?: boolean
  reason?: string
  requestSummary?: Record<string, unknown>
  resolvedDbPrices?: Record<string, number>
  computedTotals?: { subtotal: number; vat: number; total: number }
}

export function logOrderSecurityEvent(payload: OrderSecurityAuditPayload) {
  const line = {
    ts: new Date().toISOString(),
    channel: 'order-security',
    ...payload,
  }
  if (payload.rejected) {
    console.warn('[order-security] REJECTED', JSON.stringify(line))
  } else {
    console.info('[order-security]', JSON.stringify(line))
  }
}
