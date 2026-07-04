/**
 * Server-side order totals from line items (VAT-inclusive prices; vat line kept 0 for POS parity).
 *
 * @deprecated Prefer {@link resolveBarOrderLines} in `lib/secure-bar-order-lines.ts` — that uses
 * official `bar_inventory` prices instead of trusting client `price` fields.
 */
export function computeOrderLineTotalsFromItems(items: unknown): {
  subtotal: number
  vat: number
  total: number
} {
  const list = Array.isArray(items) ? items : []
  let subtotal = 0
  for (const raw of list) {
    const it = raw as { quantity?: unknown; price?: unknown }
    const q = Number(it.quantity)
    const p = Number(it.price)
    const qq = Number.isFinite(q) ? q : 0
    const pp = Number.isFinite(p) ? p : 0
    subtotal += qq * pp
  }
  const rounded = Math.round(subtotal * 100) / 100
  return { subtotal: rounded, vat: 0, total: rounded }
}
