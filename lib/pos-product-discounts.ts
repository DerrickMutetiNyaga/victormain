/**
 * POS-only product & category discounts — server entry + re-exports.
 * Client components must import from `@/lib/pos-discount-client` instead.
 */

import type { Db } from 'mongodb'
import type {
  PosCategoryDiscountDoc,
  PosDiscountAuditAction,
  PosDiscountContext,
  PosDiscountEligibilityScope,
  PosDiscountStatus,
  PosDiscountType,
  PosProductDiscountDoc,
} from '@/lib/pos-discount-types'

export * from '@/lib/pos-discount-types'
export * from '@/lib/pos-discount-rules'
export * from '@/lib/pos-discount-campaign-ui'
export * from '@/lib/pos-discount-pricing'

import {
  isDiscountEffectivelyActive,
  normalizeDiscountEligibility,
  parseOptionalDate,
} from '@/lib/pos-discount-rules'

export type DiscountInputPayload = {
  productId: string
  discountType: PosDiscountType
  discountValue: number
  status?: PosDiscountStatus
  startAt?: string | null
  endAt?: string | null
  promotionName?: string | null
  eligibilityScope?: PosDiscountEligibilityScope
  eligibleCustomers?: string[]
  campaignId?: string | null
}

export type CategoryDiscountInputPayload = {
  category: string
  discountType: PosDiscountType
  discountValue: number
  status?: PosDiscountStatus
  startAt?: string | null
  endAt?: string | null
  promotionName?: string | null
  eligibilityScope?: PosDiscountEligibilityScope
  eligibleCustomers?: string[]
  campaignId?: string | null
}

export interface PosDiscountAuditEntry {
  action: PosDiscountAuditAction
  targetType:
    | 'product'
    | 'category'
    | 'campaign'
    | 'settings'
    | 'coupon'
    | 'bundle'
    | 'spend_promotion'
    | 'campaign_override'
  targetId: string
  targetName: string
  actorEmail: string | null
  actorName: string | null
  details?: Record<string, unknown>
}

function mapProductDiscountRow(row: Record<string, unknown>): PosProductDiscountDoc {
  const eligibility = normalizeDiscountEligibility({
    eligibilityScope: row.eligibilityScope as PosDiscountEligibilityScope | undefined,
    eligibleCustomers: row.eligibleCustomers,
  })
  return {
    _id: row._id,
    productId: String(row.productId),
    discountType: row.discountType as PosDiscountType,
    discountValue: Number(row.discountValue ?? 0),
    status: (row.status as PosDiscountStatus) || 'inactive',
    startAt: parseOptionalDate(row.startAt),
    endAt: parseOptionalDate(row.endAt),
    promotionName: row.promotionName != null ? String(row.promotionName) : null,
    eligibilityScope: eligibility.scope,
    eligibleCustomers: eligibility.eligibleCustomers,
    campaignId: row.campaignId != null ? String(row.campaignId) : null,
    createdBy: row.createdBy != null ? String(row.createdBy) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(),
  }
}

function mapCategoryDiscountRow(row: Record<string, unknown>): PosCategoryDiscountDoc {
  const eligibility = normalizeDiscountEligibility({
    eligibilityScope: row.eligibilityScope as PosDiscountEligibilityScope | undefined,
    eligibleCustomers: row.eligibleCustomers,
  })
  return {
    _id: row._id,
    category: String(row.category).toLowerCase(),
    discountType: row.discountType as PosDiscountType,
    discountValue: Number(row.discountValue ?? 0),
    status: (row.status as PosDiscountStatus) || 'inactive',
    startAt: parseOptionalDate(row.startAt),
    endAt: parseOptionalDate(row.endAt),
    promotionName: row.promotionName != null ? String(row.promotionName) : null,
    eligibilityScope: eligibility.scope,
    eligibleCustomers: eligibility.eligibleCustomers,
    campaignId: row.campaignId != null ? String(row.campaignId) : null,
    createdBy: row.createdBy != null ? String(row.createdBy) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(),
  }
}

export async function ensurePosDiscountIndexes(db: Db): Promise<void> {
  const { POS_DISCOUNTS_COLLECTION, POS_CATEGORY_DISCOUNTS_COLLECTION, POS_DISCOUNT_AUDIT_COLLECTION } =
    await import('@/lib/pos-discount-types')
  try {
    await db.collection(POS_DISCOUNTS_COLLECTION).createIndex({ productId: 1 }, { unique: true })
    await db.collection(POS_DISCOUNTS_COLLECTION).createIndex({ status: 1, startAt: 1, endAt: 1 })
    await db.collection(POS_CATEGORY_DISCOUNTS_COLLECTION).createIndex({ category: 1 }, { unique: true })
    await db.collection(POS_DISCOUNT_AUDIT_COLLECTION).createIndex({ createdAt: -1 })
  } catch {
    /* exists */
  }
}

export async function loadPosDiscountContext(db: Db, now: Date = new Date()): Promise<PosDiscountContext> {
  const { loadCampaignsMap } = await import('@/lib/pos-discount-campaigns')
  const { loadPromotionSettings } = await import('@/lib/pos-promotion-settings')
  const { loadDisabledCampaignIdsForDate, dateKeyForNow } = await import('@/lib/pos-campaign-overrides')
  const { POS_DISCOUNTS_COLLECTION, POS_CATEGORY_DISCOUNTS_COLLECTION } = await import('@/lib/pos-discount-types')
  const dateKey = dateKeyForNow(now)

  const [productRows, categoryRows, campaigns, conflictMode, disabledCampaignIds] = await Promise.all([
    db.collection(POS_DISCOUNTS_COLLECTION).find({}).toArray(),
    db.collection(POS_CATEGORY_DISCOUNTS_COLLECTION).find({}).toArray(),
    loadCampaignsMap(db),
    loadPromotionSettings(db),
    loadDisabledCampaignIdsForDate(db, dateKey),
  ])

  const productDiscounts = new Map<string, PosProductDiscountDoc>()
  for (const row of productRows) {
    const mapped = mapProductDiscountRow(row)
    if (mapped.productId) productDiscounts.set(mapped.productId, mapped)
  }

  const categoryDiscounts = new Map<string, PosCategoryDiscountDoc>()
  for (const row of categoryRows) {
    const mapped = mapCategoryDiscountRow(row)
    if (mapped.category) categoryDiscounts.set(mapped.category, mapped)
  }

  return { productDiscounts, categoryDiscounts, campaigns, now, conflictMode, disabledCampaignIds }
}

/** @deprecated Use loadPosDiscountContext + resolvePosPrice */
export async function fetchActivePosDiscountsMap(db: Db): Promise<Map<string, PosProductDiscountDoc>> {
  const ctx = await loadPosDiscountContext(db)
  const active = new Map<string, PosProductDiscountDoc>()
  for (const [id, rule] of ctx.productDiscounts) {
    if (isDiscountEffectivelyActive(rule, ctx.now)) active.set(id, rule)
  }
  return active
}

export async function logPosDiscountAudit(db: Db, entry: PosDiscountAuditEntry): Promise<void> {
  const { POS_DISCOUNT_AUDIT_COLLECTION } = await import('@/lib/pos-discount-types')
  await db.collection(POS_DISCOUNT_AUDIT_COLLECTION).insertOne({
    ...entry,
    createdAt: new Date(),
  })
}
