/**
 * Coupon & promo codes for POS checkout.
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import {
  parseOptionalDate,
  validateDiscountInput,
  normalizeEligibleCustomerIds,
  normalizeCustomerIdForEligibility,
  isDiscountEligibleForCustomer,
  type PosDiscountType,
  type PosDiscountStatus,
  type PosDiscountEligibilityScope,
} from '@/lib/pos-product-discounts'
import { isCampaignAllowingDiscount, type PosDiscountCampaignDoc } from '@/lib/pos-discount-campaigns'

export const POS_PROMO_CODES_COLLECTION = 'pos_promo_codes'
export const POS_PROMO_REDEMPTIONS_COLLECTION = 'pos_promo_redemptions'

export interface PosPromoCodeDoc {
  _id?: unknown
  code: string
  label?: string | null
  discountType: PosDiscountType
  discountValue: number
  status: PosDiscountStatus
  startAt?: Date | null
  endAt?: Date | null
  minSpend?: number
  maxRedemptions?: number | null
  redemptionCount: number
  singleUsePerCustomer: boolean
  eligibilityScope?: PosDiscountEligibilityScope
  eligibleCustomers?: string[]
  eligibleProductIds?: string[]
  eligibleCategories?: string[]
  campaignId?: string | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PromoCodeValidationLine {
  productId: string
  category: string
  quantity: number
  unitPrice: number
  catalogPrice: number
}

export type PromoCodeValidationResult =
  | {
      ok: true
      code: string
      label: string | null
      discountType: PosDiscountType
      discountValue: number
      /** Order-level discount amount to apply */
      orderDiscount: number
      promoCodeId: string
    }
  | { ok: false; error: string }

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function normalizePromoCode(code: string): string {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

export function isPromoCodeEffectivelyActive(
  doc: Pick<PosPromoCodeDoc, 'status' | 'startAt' | 'endAt'>,
  now: Date = new Date()
): boolean {
  if (doc.status !== 'active') return false
  const start = parseOptionalDate(doc.startAt)
  const end = parseOptionalDate(doc.endAt)
  if (start && now < start) return false
  if (end && now > end) return false
  return true
}

export function mapPromoCodeRow(row: Record<string, unknown>): PosPromoCodeDoc {
  return {
    _id: row._id,
    code: normalizePromoCode(String(row.code)),
    label: row.label != null ? String(row.label) : null,
    discountType: row.discountType as PosDiscountType,
    discountValue: Number(row.discountValue ?? 0),
    status: (row.status as PosDiscountStatus) || 'inactive',
    startAt: parseOptionalDate(row.startAt),
    endAt: parseOptionalDate(row.endAt),
    minSpend: row.minSpend != null ? Number(row.minSpend) : 0,
    maxRedemptions: row.maxRedemptions != null ? Number(row.maxRedemptions) : null,
    redemptionCount: Number(row.redemptionCount ?? 0),
    singleUsePerCustomer: row.singleUsePerCustomer === true,
    eligibilityScope: (row.eligibilityScope as PosDiscountEligibilityScope) || 'everyone',
    eligibleCustomers: normalizeEligibleCustomerIds(row.eligibleCustomers),
    eligibleProductIds: Array.isArray(row.eligibleProductIds)
      ? row.eligibleProductIds.map(String)
      : [],
    eligibleCategories: Array.isArray(row.eligibleCategories)
      ? row.eligibleCategories.map((c) => String(c).toLowerCase())
      : [],
    campaignId: row.campaignId != null ? String(row.campaignId) : null,
    createdBy: row.createdBy != null ? String(row.createdBy) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(),
  }
}

export function serializePromoCode(doc: Record<string, unknown>) {
  const mapped = mapPromoCodeRow(doc)
  return {
    id: String(doc._id),
    code: mapped.code,
    label: mapped.label,
    discountType: mapped.discountType,
    discountValue: mapped.discountValue,
    status: mapped.status,
    startAt: mapped.startAt?.toISOString() ?? null,
    endAt: mapped.endAt?.toISOString() ?? null,
    minSpend: mapped.minSpend ?? 0,
    maxRedemptions: mapped.maxRedemptions,
    redemptionCount: mapped.redemptionCount,
    singleUsePerCustomer: mapped.singleUsePerCustomer,
    eligibilityScope: mapped.eligibilityScope ?? 'everyone',
    eligibleCustomers: mapped.eligibleCustomers ?? [],
    eligibleProductIds: mapped.eligibleProductIds ?? [],
    eligibleCategories: mapped.eligibleCategories ?? [],
    campaignId: mapped.campaignId,
    createdBy: mapped.createdBy,
    createdAt: mapped.createdAt.toISOString(),
    updatedAt: mapped.updatedAt.toISOString(),
  }
}

function eligibleSubtotal(
  lines: PromoCodeValidationLine[],
  doc: PosPromoCodeDoc
): number {
  const productSet = new Set(doc.eligibleProductIds ?? [])
  const catSet = new Set((doc.eligibleCategories ?? []).map((c) => c.toLowerCase()))
  const hasScope = productSet.size > 0 || catSet.size > 0

  let total = 0
  for (const line of lines) {
    if (!hasScope) {
      total += line.unitPrice * line.quantity
      continue
    }
    if (productSet.has(line.productId) || catSet.has(line.category.toLowerCase())) {
      total += line.unitPrice * line.quantity
    }
  }
  return roundMoney(total)
}

export async function validatePromoCode(
  db: Db,
  rawCode: string,
  opts: {
    customerId?: string | null
    lines: PromoCodeValidationLine[]
    subtotal: number
    campaigns: Map<string, PosDiscountCampaignDoc>
    disabledCampaignIds?: Set<string>
    now?: Date
  }
): Promise<PromoCodeValidationResult> {
  const code = normalizePromoCode(rawCode)
  if (!code) return { ok: false, error: 'Enter a promo code' }

  const now = opts.now ?? new Date()
  const row = await db.collection(POS_PROMO_CODES_COLLECTION).findOne({ code })
  if (!row) return { ok: false, error: 'Invalid promo code' }

  const doc = mapPromoCodeRow(row)
  if (!isPromoCodeEffectivelyActive(doc, now)) {
    return { ok: false, error: 'This promo code is not active' }
  }

  if (doc.campaignId) {
    if (
      !isCampaignAllowingDiscount(
        doc.campaignId,
        opts.campaigns,
        now,
        opts.disabledCampaignIds
      )
    ) {
      return { ok: false, error: 'Linked campaign is not active' }
    }
  }

  if (
    !isDiscountEligibleForCustomer(
      { eligibilityScope: doc.eligibilityScope, eligibleCustomers: doc.eligibleCustomers },
      opts.customerId
    )
  ) {
    return { ok: false, error: 'This code is not available for this customer' }
  }

  const minSpend = Number(doc.minSpend ?? 0)
  const scopeSubtotal = eligibleSubtotal(opts.lines, doc)
  if (minSpend > 0 && scopeSubtotal < minSpend) {
    return {
      ok: false,
      error: `Minimum spend KSh ${minSpend.toLocaleString('en-KE')} required`,
    }
  }

  if (doc.maxRedemptions != null && doc.redemptionCount >= doc.maxRedemptions) {
    return { ok: false, error: 'This promo code has reached its redemption limit' }
  }

  if (doc.singleUsePerCustomer && opts.customerId) {
    const prior = await db.collection(POS_PROMO_REDEMPTIONS_COLLECTION).findOne({
      code,
      customerId: opts.customerId,
    })
    if (prior) return { ok: false, error: 'You have already used this code' }
  }

  const base = scopeSubtotal > 0 ? scopeSubtotal : opts.subtotal
  const validated = validateDiscountInput(doc.discountType, doc.discountValue, base)
  if (!validated.ok) return { ok: false, error: validated.error }

  const orderDiscount = roundMoney(base - validated.discountedPrice)
  if (orderDiscount <= 0) return { ok: false, error: 'Code provides no discount' }

  return {
    ok: true,
    code: doc.code,
    label: doc.label ?? doc.code,
    discountType: doc.discountType,
    discountValue: doc.discountValue,
    orderDiscount,
    promoCodeId: String(row._id),
  }
}

export async function recordPromoRedemption(
  db: Db,
  opts: {
    promoCodeId: string
    code: string
    orderId: string
    customerId?: string | null
    discountAmount: number
  }
): Promise<void> {
  await db.collection(POS_PROMO_REDEMPTIONS_COLLECTION).insertOne({
    promoCodeId: opts.promoCodeId,
    code: normalizePromoCode(opts.code),
    orderId: opts.orderId,
    customerId: opts.customerId ? normalizeCustomerIdForEligibility(opts.customerId) : null,
    discountAmount: opts.discountAmount,
    createdAt: new Date(),
  })
  const oid = ObjectId.isValid(opts.promoCodeId) ? new ObjectId(opts.promoCodeId) : opts.promoCodeId
  await db.collection(POS_PROMO_CODES_COLLECTION).updateOne(
    { _id: oid },
    { $inc: { redemptionCount: 1 }, $set: { updatedAt: new Date() } }
  )
}

export async function ensurePromoCodeIndexes(db: Db): Promise<void> {
  try {
    await db.collection(POS_PROMO_CODES_COLLECTION).createIndex({ code: 1 }, { unique: true })
    await db.collection(POS_PROMO_REDEMPTIONS_COLLECTION).createIndex({ code: 1, customerId: 1 })
    await db.collection(POS_PROMO_REDEMPTIONS_COLLECTION).createIndex({ orderId: 1 })
  } catch {
    /* exists */
  }
}
