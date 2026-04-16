/**
 * Server-only rules for staff marking an ecommerce order completed via PUT /api/ecommerce/orders.
 * Payment state is never taken from the request body — only from the persisted order document.
 */

export function assertPaidForStaffEcommerceCompletion(order: {
  paymentStatus?: unknown
}): { ok: true } | { ok: false; message: string } {
  const ps = String(order.paymentStatus ?? '').toUpperCase()
  if (ps === 'PAID' || ps === 'OVERPAID' || ps === 'PARTIALLY_PAID') {
    return { ok: true }
  }
  return {
    ok: false,
    message: 'Only paid ecommerce orders can be marked completed from this endpoint.',
  }
}
