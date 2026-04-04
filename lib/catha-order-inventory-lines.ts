import { ObjectId } from 'mongodb'

/**
 * Order line items that reference bar_inventory (Mongo ObjectId).
 * Excludes custom/manual lines and any non-ObjectId productId (e.g. legacy "custom-*" ids).
 */
export function filterInventoryStockLineItems(
  items: unknown
): Array<{ productId: string; quantity: number; name?: string }> {
  if (!Array.isArray(items)) return []
  const out: Array<{ productId: string; quantity: number; name?: string }> = []
  for (const raw of items) {
    const i = raw as Record<string, unknown>
    if (!i) continue
    if (i.isCustomItem === true) continue
    if (i.lineType === 'custom') continue
    const pid = i.productId
    if (pid == null || typeof pid !== 'string' || !pid.trim()) continue
    const qty = Number(i.quantity)
    if (!Number.isFinite(qty) || qty <= 0) continue
    if (!ObjectId.isValid(pid)) continue
    out.push({ productId: pid.trim(), quantity: qty, name: typeof i.name === 'string' ? i.name : undefined })
  }
  return out
}

/** Dedup fingerprint: inventory by productId; custom lines by stable name key */
export function orderLineFingerprintParts(items: unknown): Array<{ key: string; quantity: number }> {
  if (!Array.isArray(items)) return []
  const parts: Array<{ key: string; quantity: number }> = []
  for (const raw of items) {
    const i = raw as Record<string, unknown>
    if (!i) continue
    const qty = Number(i.quantity) || 0
    if (qty <= 0) continue
    if (i.isCustomItem === true || i.lineType === 'custom') {
      const name = String(i.name || '').toLowerCase().trim()
      parts.push({ key: `custom:${name}`, quantity: qty })
      continue
    }
    const pid = i.productId
    parts.push({
      key: typeof pid === 'string' && pid.trim() ? pid.trim() : `nonpid:${String(i.name)}`,
      quantity: qty,
    })
  }
  parts.sort((a, b) => a.key.localeCompare(b.key))
  return parts
}
