/**
 * Spend-based promotions — discount when order subtotal exceeds a threshold.
 */

import type { Db } from 'mongodb'
import {
  parseOptionalDate,
  validateDiscountInput,
  isDiscountEligibleForCustomer,
  type PosDiscountType,
  type PosDiscountStatus,
  type PosDiscountEligibilityScope,
} from '@/lib/pos-product-discounts'
import { isCampaignAllowingDiscount, type PosDiscountCampaignDoc } from '@/lib/pos-discount-campaigns'

export const POS_SPEND_PROMOTIONS_COLLECTION = 'pos_spend_promotions'

export interface PosSpendPromotionDoc {
  _id?: unknown
  name: string
  status: PosDiscountStatus
  startAt?: Date | null
  endAt?: Date | null
  /** Minimum order subtotal (after line discounts) */
  threshold: number
  discountType: PosDiscountType
  discountValue: number
  priority: number
  campaignId?: string | null
  eligibilityScope?: PosDiscountEligibilityScope
  eligibleCustomers?: string[]
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function isSpendPromotionEffectivelyActive(
  doc: Pick<PosSpendPromotionDoc, 'status' | 'startAt' | 'endAt'>,
  now: Date = new Date()
): boolean {
  if (doc.status !== 'active') return false
  const start = parseOptionalDate(doc.startAt)
  const end = parseOptionalDate(doc.endAt)
  if (start && now < start) return false
  if (end && now > end) return false
  return true
}

export function mapSpendPromotionRow(row: Record<string, unknown>): PosSpendPromotionDoc {
  return {
    _id: row._id,
    name: String(row.name ?? '').trim(),
    status: (row.status as PosDiscountStatus) || 'inactive',
    startAt: parseOptionalDate(row.startAt),
    endAt: parseOptionalDate(row.endAt),
    threshold: Number(row.threshold ?? 0),
    discountType: row.discountType as PosDiscountType,
    discountValue: Number(row.discountValue ?? 0),
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

export function serializeSpendPromotion(doc: Record<string, unknown>) {
  const m = mapSpendPromotionRow(doc)
  return {
    id: String(doc._id),
    name: m.name,
    status: m.status,
    startAt: m.startAt?.toISOString() ?? null,
    endAt: m.endAt?.toISOString() ?? null,
    threshold: m.threshold,
    discountType: m.discountType,
    discountValue: m.discountValue,
    priority: m.priority,
    campaignId: m.campaignId,
    eligibilityScope: m.eligibilityScope ?? 'everyone',
    eligibleCustomers: m.eligibleCustomers ?? [],
    createdBy: m.createdBy,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }
}

export interface SpendPromotionResult {
  promotionId: string
  name: string
  discountAmount: number
}

/** Pick best qualifying spend promotion (highest priority, then highest savings) */
export function resolveSpendPromotion(
  subtotal: number,
  promotions: PosSpendPromotionDoc[],
  opts: {
    customerId?: string | null
    campaigns: Map<string, PosDiscountCampaignDoc>
    disabledCampaignIds?: Set<string>
    now?: Date
  }
): SpendPromotionResult | null {
  const now = opts.now ?? new Date()
  let best: SpendPromotionResult | null = null
  let bestPriority = -Infinity

  for (const promo of promotions) {
    if (!isSpendPromotionEffectivelyActive(promo, now)) continue
    if (subtotal < promo.threshold) continue

    if (promo.campaignId) {
      if (
        !isCampaignAllowingDiscount(
          promo.campaignId,
          opts.campaigns,
          now,
          opts.disabledCampaignIds
        )
      ) {
        continue
      }
    }

    if (
      !isDiscountEligibleForCustomer(
        { eligibilityScope: promo.eligibilityScope, eligibleCustomers: promo.eligibleCustomers },
        opts.customerId
      )
    ) {
      continue
    }

    const validated = validateDiscountInput(promo.discountType, promo.discountValue, subtotal)
    if (!validated.ok) continue
    const discountAmount = roundMoney(subtotal - validated.discountedPrice)
    if (discountAmount <= 0) continue

    if (promo.priority > bestPriority || (promo.priority === bestPriority && !best)) {
      bestPriority = promo.priority
      best = {
        promotionId: String(promo._id),
        name: promo.name,
        discountAmount,
      }
    } else if (!best || discountAmount > best.discountAmount) {
      if (promo.priority >= bestPriority) {
        best = {
          promotionId: String(promo._id),
          name: promo.name,
          discountAmount,
        }
      }
    }
  }

  return best
}

export async function loadSpendPromotions(db: Db): Promise<PosSpendPromotionDoc[]> {
  const rows = await db.collection(POS_SPEND_PROMOTIONS_COLLECTION).find({}).toArray()
  return rows.map((r) => mapSpendPromotionRow(r))
}

export async function ensureSpendPromotionIndexes(db: Db): Promise<void> {
  try {
    await db.collection(POS_SPEND_PROMOTIONS_COLLECTION).createIndex({ status: 1, threshold: 1 })
    await db.collection(POS_SPEND_PROMOTIONS_COLLECTION).createIndex({ priority: -1 })
  } catch {
    /* exists */
  }
}
