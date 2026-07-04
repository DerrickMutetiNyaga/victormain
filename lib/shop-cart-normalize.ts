/**
 * Strips client cart payloads down to intent-only fields before strict Zod validation.
 * Full CartItem objects from the UI include name/price/image — those must never be trusted,
 * but they must not cause .strict() to reject otherwise valid add-to-cart requests.
 */

export function pickCartLineIntent(raw: unknown): {
  id: string
  productId: string
  quantity: number
  size?: string
} | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const idRaw = o.id ?? o.productId
  const pidRaw = o.productId ?? o.id
  const idStr = idRaw != null && String(idRaw).trim() !== '' ? String(idRaw).trim() : ''
  const pidStr = pidRaw != null && String(pidRaw).trim() !== '' ? String(pidRaw).trim() : ''
  const sku = idStr || pidStr
  if (!sku) return null
  const q = Number(o.quantity)
  if (!Number.isFinite(q)) return null
  const quantity = Math.trunc(q)
  if (quantity < 1 || quantity > 999) return null
  const size = typeof o.size === 'string' && o.size.trim() ? o.size.trim() : undefined
  return {
    id: sku,
    productId: sku,
    quantity,
    size,
  }
}

/** POST /api/ecommerce/cart — { items: CartItem[] } from client */
export function normalizeCartReplaceBody(body: unknown): { items: ReturnType<typeof pickCartLineIntent>[] } | null {
  if (!body || typeof body !== 'object') return null
  const items = (body as { items?: unknown }).items
  if (!Array.isArray(items)) return null
  const picked = items.map(pickCartLineIntent).filter((x): x is NonNullable<typeof x> => x != null)
  return { items: picked }
}

/** POST /api/ecommerce/cart/items — { item } or { items } */
export function normalizeCartAddBody(body: unknown): {
  item?: ReturnType<typeof pickCartLineIntent>
  items?: ReturnType<typeof pickCartLineIntent>[]
} | null {
  if (!body || typeof body !== 'object') return null
  const b = body as { item?: unknown; items?: unknown }
  const out: {
    item?: ReturnType<typeof pickCartLineIntent>
    items?: ReturnType<typeof pickCartLineIntent>[]
  } = {}
  if (b.item != null) {
    const one = pickCartLineIntent(b.item)
    if (one) out.item = one
  }
  if (Array.isArray(b.items)) {
    const arr = b.items.map(pickCartLineIntent).filter((x): x is NonNullable<typeof x> => x != null)
    if (arr.length) out.items = arr
  }
  if (!out.item && !out.items?.length) return null
  return out
}
