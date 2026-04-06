import type { Collection, Document } from 'mongodb'

/** Matches raw material names used for packaging (same rules as packaging-output API). */
export const BOTTLE_NAME_REGEX = /\bbott?l?e?s?\b/i
export const STICKER_NAME_REGEX = /\b(stickers?|labels?)\b/i

const PRIMARY_SORT = { currentStock: -1, updatedAt: -1, createdAt: -1 } as const

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Builds a "size token" regex that can be matched against raw material `name`,
 * e.g. `250ml`, `500ml`, `1L`, `2L`, and also custom ml/l values.
 *
 * This is how we know which bottle/sticker record to deduct for a container size.
 */
export function packagingSizeTokenRegex(size: string, customSize?: string): RegExp | null {
  const s = String(size || '').trim()

  if (s === '250ml') return /\b250\s*ml\b/i
  if (s === '500ml') return /\b500\s*ml\b/i
  if (s === '1L') return /\b1\s*l\b/i
  if (s === '2L') return /\b2\s*l\b/i

  if (s !== 'custom') return null
  const ml = parseFloat(String(customSize ?? ''))
  if (!Number.isFinite(ml) || ml <= 0) return null

  // For custom sizes, try matching the raw name by both "Xml" and "Y L" forms.
  const mlStr = String(ml).replace(/\.0+$/g, '')
  const liters = ml / 1000
  const litersStr = String(liters).replace(/\.0+$/g, '')

  // Example: 750 -> /\b750\s*ml\b/i; 1500 -> (/\b1500\s*ml\b/ OR /\b1.5\s*l\b/)
  if (ml < 1000) {
    return new RegExp(`\\b${escapeRegExp(mlStr)}\\s*ml\\b`, 'i')
  }

  const lEsc = escapeRegExp(litersStr)
  return new RegExp(`(?:\\b${escapeRegExp(mlStr)}\\s*ml\\b|\\b${lEsc}\\s*l\\b)`, 'i')
}

/**
 * Resolves the same bottle + sticker documents the packaging POST handler uses
 * (highest currentStock first), so UI stock previews match server deduction.
 */
export async function findPrimaryPackagingMaterials(
  rawMaterialsCollection: Collection<Document>,
  options?: { session?: import('mongodb').ClientSession }
): Promise<{ bottleMaterial: Document | null; stickerMaterial: Document | null }> {
  const opts = options?.session ? { session: options.session } : {}
  const [bottleMaterial, stickerMaterial] = await Promise.all([
    rawMaterialsCollection
      .find({ name: { $regex: BOTTLE_NAME_REGEX } }, opts)
      .sort(PRIMARY_SORT)
      .limit(1)
      .next(),
    rawMaterialsCollection
      .find({ name: { $regex: STICKER_NAME_REGEX } }, opts)
      .sort(PRIMARY_SORT)
      .limit(1)
      .next(),
  ])
  return { bottleMaterial, stickerMaterial }
}

export async function findPrimaryBottleMaterialForSize(
  rawMaterialsCollection: Collection<Document>,
  opts: { size: string; customSize?: string; session?: import('mongodb').ClientSession }
): Promise<Document | null> {
  const token = packagingSizeTokenRegex(opts.size, opts.customSize)
  const query: any = token
    ? { $and: [{ name: { $regex: BOTTLE_NAME_REGEX } }, { name: { $regex: token } }] }
    : { name: { $regex: BOTTLE_NAME_REGEX } }

  const mat = await rawMaterialsCollection
    .find(query, opts.session ? { session: opts.session } : undefined)
    .sort(PRIMARY_SORT)
    .limit(1)
    .next()

  return mat ?? null
}

export async function findPrimaryStickerMaterialForSize(
  rawMaterialsCollection: Collection<Document>,
  opts: { size: string; customSize?: string; session?: import('mongodb').ClientSession }
): Promise<Document | null> {
  const token = packagingSizeTokenRegex(opts.size, opts.customSize)
  const sizeSpecificQuery: any = token
    ? { $and: [{ name: { $regex: STICKER_NAME_REGEX } }, { name: { $regex: token } }] }
    : null

  // Prefer size-specific sticker/label item (if naming includes size).
  const sizeSpecific = sizeSpecificQuery
    ? await rawMaterialsCollection
        .find(sizeSpecificQuery, opts.session ? { session: opts.session } : undefined)
        .sort(PRIMARY_SORT)
        .limit(1)
        .next()
    : null

  if (sizeSpecific) return sizeSpecific

  // Backward compatible fallback: if you only have "Labels" (no size in name),
  // we use it for every container size.
  const generic = await rawMaterialsCollection
    .find({ name: { $regex: STICKER_NAME_REGEX } }, opts.session ? { session: opts.session } : undefined)
    .sort(PRIMARY_SORT)
    .limit(1)
    .next()

  return generic ?? null
}

