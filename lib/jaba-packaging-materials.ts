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

/** Trim and normalize flavour text for comparisons (does not lowercase — regex handles case). */
export function normalizeFlavourLabel(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Regex that matches a multi-word flavour inside a raw material `name`, e.g. "Passion Fruit".
 */
export function flavourInNameRegex(flavourLabel: string): RegExp | null {
  const n = normalizeFlavourLabel(flavourLabel)
  if (!n) return null
  const escaped = escapeRegExp(n).replace(/\s+/g, '\\s+')
  return new RegExp(`\\b${escaped}\\b`, 'i')
}

export type FindStickerOpts = {
  size: string
  customSize?: string
  /** Batch or flavour-line name — when set, match sticker rows tagged for this flavour or with flavour in the name. */
  flavourName?: string
  /**
   * When true, do not fall back to generic stickers (size-only or unlabeled size).
   * Use for flavour-line packaging and whenever the product flavour is known.
   */
  requireFlavorSpecific?: boolean
  session?: import('mongodb').ClientSession
}

export async function findPrimaryStickerMaterialForSize(
  rawMaterialsCollection: Collection<Document>,
  opts: FindStickerOpts
): Promise<Document | null> {
  const token = packagingSizeTokenRegex(opts.size, opts.customSize)
  const flavour = normalizeFlavourLabel(opts.flavourName)
  const requireSpecific = Boolean(opts.requireFlavorSpecific)
  const findOpts = opts.session ? { session: opts.session } : undefined

  const stickerBase: Record<string, unknown> = { name: { $regex: STICKER_NAME_REGEX } }
  const andClauses: Record<string, unknown>[] = [stickerBase]

  if (token) {
    andClauses.push({ name: { $regex: token } })
  }

  if (flavour) {
    const word = flavourInNameRegex(flavour)
    andClauses.push({
      $or: [
        { packagingStickerFlavor: { $regex: new RegExp(`^${escapeRegExp(flavour)}$`, 'i') } },
        ...(word ? [{ name: { $regex: word } }] : []),
      ],
    })
  }

  const flavouredQuery = { $and: andClauses }

  const flavoured = await rawMaterialsCollection
    .find(flavouredQuery, findOpts)
    .sort(PRIMARY_SORT)
    .limit(1)
    .next()

  if (flavoured) return flavoured

  if (requireSpecific || flavour) {
    // Known flavour but no matching SKU — never deduct the wrong sticker row.
    return null
  }

  // Legacy: size-specific sticker without flavour constraint
  const sizeSpecificQuery: Record<string, unknown> | null = token
    ? { $and: [{ name: { $regex: STICKER_NAME_REGEX } }, { name: { $regex: token } }] }
    : null

  const sizeSpecific = sizeSpecificQuery
    ? await rawMaterialsCollection.find(sizeSpecificQuery, findOpts).sort(PRIMARY_SORT).limit(1).next()
    : null

  if (sizeSpecific) return sizeSpecific

  const generic = await rawMaterialsCollection
    .find({ name: { $regex: STICKER_NAME_REGEX } }, findOpts)
    .sort(PRIMARY_SORT)
    .limit(1)
    .next()

  return generic ?? null
}

