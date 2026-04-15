/**
 * Server-side resolution of bar/POS/e-commerce order lines against `bar_inventory`.
 * Never trust client-supplied unit prices for inventory SKUs.
 *
 * Custom/manual lines (POS): optional; clamped and flagged; requires allowCustomLines.
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'

/** Same family as inventory-ops (stock); archived items excluded from new sales. */
const PRODUCT_QUERY_SALE = {
  type: 'bar',
  deleted: { $ne: true },
  status: { $ne: 'archived' },
} as const

export const MAX_QTY_PER_LINE = 999
export const MAX_ORDER_TOTAL_KES = 50_000_000
export const MAX_CUSTOM_UNIT_KES = 5_000_000

export type ResolvedOrderLine = {
  productId: string | null
  name: string
  quantity: number
  price: number
  isCustomItem?: boolean
  lineType?: 'custom'
  /** Original DB _id string for inventory rows */
  skuId?: string
  size?: string
}

export type ResolveBarOrderLinesContext = {
  /** POS staff flows may include custom-priced lines */
  allowCustomLines: boolean
  /** When true, reject custom lines entirely (public menu / e-commerce) */
  rejectCustomLines: boolean
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function parseQty(raw: unknown): number | null {
  const q = Number(raw)
  if (!Number.isFinite(q)) return null
  const i = Math.floor(q)
  if (i !== q) return null
  if (i < 1 || i > MAX_QTY_PER_LINE) return null
  return i
}

async function findInventoryProduct(
  db: Db,
  productId: string,
  sizeHint?: string | null
): Promise<{ doc: any; skuId: string } | null> {
  let oid: ObjectId
  try {
    oid = new ObjectId(productId)
  } catch {
    return null
  }
  let doc = await db.collection('bar_inventory').findOne({ _id: oid, ...PRODUCT_QUERY_SALE })
  if (!doc) return null

  const hint = sizeHint != null && String(sizeHint).trim() !== '' ? String(sizeHint).trim() : null
  if (hint && String(doc.size || 'Standard') !== hint) {
    const byNameSize = await db.collection('bar_inventory').findOne({
      name: doc.name,
      size: hint,
      ...PRODUCT_QUERY_SALE,
    })
    if (byNameSize) {
      doc = byNameSize
    }
  }
  return { doc, skuId: doc._id.toString() }
}

export type ResolveBarOrderLinesResult =
  | {
      ok: true
      items: ResolvedOrderLine[]
      subtotal: number
      vat: number
      total: number
      dbPricesBySku: Record<string, number>
    }
  | { ok: false; code: string; error: string }

/**
 * Resolve incoming line items to official DB prices and names.
 */
export async function resolveBarOrderLines(
  db: Db,
  rawItems: unknown,
  ctx: ResolveBarOrderLinesContext
): Promise<ResolveBarOrderLinesResult> {
  if (!Array.isArray(rawItems)) {
    return { ok: false, code: 'INVALID_ITEMS', error: 'items must be an array' }
  }
  if (rawItems.length === 0) {
    return { ok: false, code: 'EMPTY_ITEMS', error: 'items cannot be empty' }
  }
  if (rawItems.length > 200) {
    return { ok: false, code: 'TOO_MANY_LINES', error: 'too many line items' }
  }

  const out: ResolvedOrderLine[] = []
  const dbPricesBySku: Record<string, number> = {}
  let subtotal = 0

  for (const raw of rawItems) {
    const row = raw as Record<string, unknown>
    if (!row) continue

    const isCustom = row.isCustomItem === true || row.lineType === 'custom'
    if (isCustom) {
      if (ctx.rejectCustomLines || !ctx.allowCustomLines) {
        return { ok: false, code: 'CUSTOM_NOT_ALLOWED', error: 'Custom line items are not allowed for this request' }
      }
      const name = String(row.name || '').trim()
      if (!name) {
        return { ok: false, code: 'CUSTOM_NAME', error: 'Custom line requires a name' }
      }
      const qty = parseQty(row.quantity)
      if (qty == null) {
        return { ok: false, code: 'CUSTOM_QTY', error: 'Invalid quantity on custom line' }
      }
      let unit = Number(row.price)
      if (!Number.isFinite(unit) || unit <= 0) {
        return { ok: false, code: 'CUSTOM_PRICE', error: 'Invalid unit price on custom line' }
      }
      if (unit > MAX_CUSTOM_UNIT_KES) {
        return { ok: false, code: 'CUSTOM_PRICE_CAP', error: `Custom unit price exceeds maximum (${MAX_CUSTOM_UNIT_KES} KES)` }
      }
      unit = roundMoney(unit)
      const lineTotal = roundMoney(unit * qty)
      subtotal += lineTotal
      out.push({
        productId: null,
        name,
        quantity: qty,
        price: unit,
        isCustomItem: true,
        lineType: 'custom',
      })
      continue
    }

    const pid =
      (typeof row.productId === 'string' && row.productId.trim()) ||
      (typeof row.id === 'string' && row.id.trim()) ||
      ''
    if (!pid) {
      return { ok: false, code: 'MISSING_PRODUCT_ID', error: 'Each line must include productId' }
    }

    const qty = parseQty(row.quantity)
    if (qty == null) {
      return { ok: false, code: 'BAD_QUANTITY', error: 'Invalid quantity' }
    }

    let sizeHint: string | null = null
    if (typeof row.size === 'string' && row.size.trim()) {
      sizeHint = row.size.trim()
    } else {
      const sel = (row as { selectedSize?: unknown }).selectedSize
      if (typeof sel === 'string' && sel.trim()) sizeHint = sel.trim()
    }

    const found = await findInventoryProduct(db, pid, sizeHint)
    if (!found) {
      return {
        ok: false,
        code: 'UNKNOWN_PRODUCT',
        error: `Unknown or unavailable product: ${pid}`,
      }
    }

    const { doc, skuId } = found
    const unit = roundMoney(Number(doc.price ?? 0))
    if (!Number.isFinite(unit) || unit <= 0) {
      return { ok: false, code: 'BAD_DB_PRICE', error: `Invalid database price for product ${doc.name}` }
    }

    dbPricesBySku[skuId] = unit
    const name = String(doc.name || 'Product').trim() || 'Product'
    subtotal += roundMoney(unit * qty)
    out.push({
      productId: skuId,
      skuId,
      name,
      quantity: qty,
      price: unit,
      size: doc.size ? String(doc.size) : undefined,
    })
  }

  subtotal = roundMoney(subtotal)
  if (subtotal > MAX_ORDER_TOTAL_KES) {
    return { ok: false, code: 'TOTAL_CAP', error: `Order subtotal exceeds maximum (${MAX_ORDER_TOTAL_KES} KES)` }
  }

  return {
    ok: true,
    items: out,
    subtotal,
    vat: 0,
    total: subtotal,
    dbPricesBySku,
  }
}

/**
 * Derive payment status for newly created Catha orders — do not trust client `paymentStatus`.
 */
export type ShopCartResolvedLine = {
  id: string
  name: string
  price: number
  image: string
  quantity: number
  size?: string
}

/**
 * E-commerce session cart: derive display rows from bar_inventory only (no client prices/names).
 */
export async function resolveShopCartLines(
  db: Db,
  lines: Array<{ productId: string; quantity: number; size?: string }>
): Promise<
  | { ok: true; items: ShopCartResolvedLine[] }
  | { ok: false; code: string; error: string }
> {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, code: 'EMPTY', error: 'Cart has no lines' }
  }
  if (lines.length > 200) {
    return { ok: false, code: 'TOO_MANY', error: 'Too many cart lines' }
  }
  const out: ShopCartResolvedLine[] = []
  for (const line of lines) {
    const qty = parseQty(line.quantity)
    if (qty == null) {
      return { ok: false, code: 'BAD_QTY', error: 'Invalid quantity' }
    }
    const found = await findInventoryProduct(db, line.productId, line.size ?? null)
    if (!found) {
      return { ok: false, code: 'UNKNOWN_PRODUCT', error: `Unknown product: ${line.productId}` }
    }
    const { doc, skuId } = found
    const unit = roundMoney(Number(doc.price ?? 0))
    if (!Number.isFinite(unit) || unit <= 0) {
      return { ok: false, code: 'BAD_DB_PRICE', error: 'Invalid product price in catalog' }
    }
    const img = typeof doc.image === 'string' && doc.image.trim() ? doc.image.trim() : '/placeholder.svg'
    out.push({
      id: skuId,
      name: String(doc.name || 'Product').trim() || 'Product',
      price: unit,
      image: img,
      quantity: qty,
      size: doc.size ? String(doc.size) : undefined,
    })
  }
  return { ok: true, items: out }
}

export function deriveInitialPaymentStatusForCatha(body: {
  status?: string
  paymentMethod?: string
}): 'PENDING' | 'PAID' | 'NOT_PAID' | 'PARTIALLY_PAID' {
  const st = String(body.status || 'pending').toLowerCase()
  const pm = String(body.paymentMethod || '').toLowerCase()

  if (st === 'completed') {
    if (pm === 'mpesa') {
      return 'PENDING'
    }
    if (pm === 'cash' || pm === 'card' || pm === 'glovo') {
      return 'PAID'
    }
    return 'PAID'
  }
  return 'PENDING'
}
