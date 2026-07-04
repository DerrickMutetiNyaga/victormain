/**
 * Bundle promotions — fixed price for a qualifying product combination.
 */

import type { Db } from 'mongodb'
import {
  parseOptionalDate,
  isDiscountEligibleForCustomer,
  type PosDiscountStatus,
  type PosDiscountEligibilityScope,
} from '@/lib/pos-product-discounts'
import { isCampaignAllowingDiscount, type PosDiscountCampaignDoc } from '@/lib/pos-discount-campaigns'

export const POS_BUNDLE_PROMOTIONS_COLLECTION = 'pos_bundle_promotions'

export interface PosBundlePromotionDoc {
  _id?: unknown
  name: string
  status: PosDiscountStatus
  startAt?: Date | null
  endAt?: Date | null
  /** Product IDs required (one unit each per bundle set) */
  productIds: string[]
  bundlePrice: number
  priority: number
  campaignId?: string | null
  eligibilityScope?: PosDiscountEligibilityScope
  eligibleCustomers?: string[]
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface BundleResolutionLine {
  index: number
  productId: string
  quantity: number
  unitPrice: number
  catalogPrice: number
  originalPrice?: number
  posDiscountAmount?: number
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function isBundleEffectivelyActive(
  doc: Pick<PosBundlePromotionDoc, 'status' | 'startAt' | 'endAt'>,
  now: Date = new Date()
): boolean {
  if (doc.status !== 'active') return false
  const start = parseOptionalDate(doc.startAt)
  const end = parseOptionalDate(doc.endAt)
  if (start && now < start) return false
  if (end && now > end) return false
  return true
}

export function mapBundleRow(row: Record<string, unknown>): PosBundlePromotionDoc {
  return {
    _id: row._id,
    name: String(row.name ?? '').trim(),
    status: (row.status as PosDiscountStatus) || 'inactive',
    startAt: parseOptionalDate(row.startAt),
    endAt: parseOptionalDate(row.endAt),
    productIds: Array.isArray(row.productIds) ? row.productIds.map(String).filter(Boolean) : [],
    bundlePrice: Number(row.bundlePrice ?? 0),
    priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : 0,
    campaignId: row.campaignId != null ? String(row.campaignId) : null,
    eligibilityScope: (row.eligibilityScope as PosDiscountEligibilityScope) || 'everyone',
    eligibleCustomers: Array.isArray(row.eligibleCustomers)
      ? row.eligibleCustomers.map(String)
      : [],
    createdBy: row.createdBy != null ? String(row.createdBy) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(),
  }
}

export function serializeBundlePromotion(doc: Record<string, unknown>) {
  const m = mapBundleRow(doc)
  return {
    id: String(doc._id),
    name: m.name,
    status: m.status,
    startAt: m.startAt?.toISOString() ?? null,
    endAt: m.endAt?.toISOString() ?? null,
    productIds: m.productIds,
    bundlePrice: m.bundlePrice,
    priority: m.priority,
    campaignId: m.campaignId,
    eligibilityScope: m.eligibilityScope ?? 'everyone',
    eligibleCustomers: m.eligibleCustomers ?? [],
    createdBy: m.createdBy,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }
}

/**
 * Apply bundle pricing as an order-level discount (greedy by priority).
 */
export function computeBundleOrderDiscount(
  lines: BundleResolutionLine[],
  bundles: PosBundlePromotionDoc[],
  opts: {
    customerId?: string | null
    campaigns: Map<string, PosDiscountCampaignDoc>
    disabledCampaignIds?: Set<string>
    now?: Date
  }
): { discount: number; appliedBundles: string[] } {
  const now = opts.now ?? new Date()
  const active = bundles
    .filter((b) => {
      if (!isBundleEffectivelyActive(b, now)) return false
      if (b.productIds.length < 2) return false
      if (
        b.campaignId &&
        !isCampaignAllowingDiscount(
          b.campaignId,
          opts.campaigns,
          now,
          opts.disabledCampaignIds
        )
      ) {
        return false
      }
      if (
        !isDiscountEligibleForCustomer(
          { eligibilityScope: b.eligibilityScope, eligibleCustomers: b.eligibleCustomers },
          opts.customerId
        )
      ) {
        return false
      }
      return true
    })
    .sort((a, b) => b.priority - a.priority)

  const remaining = new Map<string, number>()
  for (const line of lines) {
    remaining.set(line.productId, (remaining.get(line.productId) ?? 0) + line.quantity)
  }

  const catalogByProduct = new Map<string, number>()
  for (const line of lines) {
    if (!catalogByProduct.has(line.productId)) {
      catalogByProduct.set(line.productId, line.catalogPrice ?? line.unitPrice)
    }
  }

  let totalDiscount = 0
  const appliedBundles: string[] = []

  for (const bundle of active) {
    let sets = Infinity
    for (const pid of bundle.productIds) {
      sets = Math.min(sets, remaining.get(pid) ?? 0)
    }
    if (!Number.isFinite(sets) || sets <= 0) continue

    const catalogSum = bundle.productIds.reduce(
      (sum, pid) => sum + (catalogByProduct.get(pid) ?? 0),
      0
    )
    const savingsPerSet = roundMoney(catalogSum - bundle.bundlePrice)
    if (savingsPerSet <= 0) continue

    totalDiscount += sets * savingsPerSet
    appliedBundles.push(bundle.name)

    for (const pid of bundle.productIds) {
      remaining.set(pid, (remaining.get(pid) ?? 0) - sets)
    }
  }

  return { discount: roundMoney(totalDiscount), appliedBundles }
}

/** @deprecated Use computeBundleOrderDiscount */
export function applyBundlePromotionsToLines(
  lines: BundleResolutionLine[],
  bundles: PosBundlePromotionDoc[],
  opts: Parameters<typeof computeBundleOrderDiscount>[2]
): { savings: number; appliedBundles: string[] } {
  const result = computeBundleOrderDiscount(lines, bundles, opts)
  return { savings: result.discount, appliedBundles: result.appliedBundles }
}

export async function loadBundlePromotions(db: Db): Promise<PosBundlePromotionDoc[]> {
  const rows = await db.collection(POS_BUNDLE_PROMOTIONS_COLLECTION).find({}).toArray()
  return rows.map((r) => mapBundleRow(r))
}

export async function ensureBundleIndexes(db: Db): Promise<void> {
  try {
    await db.collection(POS_BUNDLE_PROMOTIONS_COLLECTION).createIndex({ status: 1 })
    await db.collection(POS_BUNDLE_PROMOTIONS_COLLECTION).createIndex({ priority: -1 })
  } catch {
    /* exists */
  }
}
