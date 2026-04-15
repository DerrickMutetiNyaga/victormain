/**
 * Picks only ecommerce order-create allowlist fields before strict Zod validation.
 * Strips display-only line fields (name, price, image) and forbidden top-level keys
 * (client totals, payment state, timestamp, customerPhone — phone comes from session).
 */

import { pickCartLineIntent } from '@/lib/shop-cart-normalize'

function pickMinimalLine(raw: unknown): Record<string, unknown> | null {
  const base = pickCartLineIntent(raw)
  if (!base) return null
  const out: Record<string, unknown> = {
    productId: base.productId,
    id: base.id,
    quantity: base.quantity,
  }
  if (base.size) out.size = base.size
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (typeof o.selectedSize === 'string' && o.selectedSize.trim()) {
      out.selectedSize = o.selectedSize.trim()
    }
  }
  return out
}

/** POST /api/ecommerce/orders — aligns fat client bodies with ecommerceOrderCreateSchema */
export function normalizeEcommerceOrderCreateBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body
  const b = body as Record<string, unknown>
  const itemsRaw = b.items
  if (!Array.isArray(itemsRaw)) return body

  const items = itemsRaw.map(pickMinimalLine)
  if (items.some((x) => x === null)) return body

  const out: Record<string, unknown> = {
    items: items as unknown[],
  }

  if (typeof b.id === 'string') out.id = b.id
  if (typeof b.customerName === 'string') out.customerName = b.customerName
  if (typeof b.customerEmail === 'string') out.customerEmail = b.customerEmail
  if (typeof b.deliveryAddress === 'string') out.deliveryAddress = b.deliveryAddress
  if (typeof b.city === 'string') out.city = b.city
  if (typeof b.postalCode === 'string') out.postalCode = b.postalCode
  if (typeof b.deliveryNotes === 'string') out.deliveryNotes = b.deliveryNotes
  if (typeof b.deliveryOption === 'string') out.deliveryOption = b.deliveryOption

  if (b.deliveryFee !== undefined && b.deliveryFee !== null) {
    const n = Number(b.deliveryFee)
    if (Number.isFinite(n)) out.deliveryFee = n
  }

  return out
}
