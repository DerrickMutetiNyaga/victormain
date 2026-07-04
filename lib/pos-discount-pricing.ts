/**
 * POS price resolution — no MongoDB (client + server safe).
 */

import type { PromotionConflictMode } from '@/lib/pos-promotion-settings'
import type {
  AppliedPosDiscount,
  PosCategoryDiscountDoc,
  PosDiscountCampaignDoc,
  PosDiscountContext,
  PosDiscountEligibilityScope,
  PosDiscountRule,
  PosDiscountStatus,
  PosDiscountType,
  PosProductDiscountDoc,
} from '@/lib/pos-discount-types'
import {
  applyDiscountRule,
  isDiscountEffectivelyActive,
  isDiscountEligibleForCustomer,
  normalizeDiscountEligibility,
  normalizeCustomerIdForEligibility,
  parseOptionalDate,
  posDiscountBadgeLabel,
  roundMoney,
} from '@/lib/pos-discount-rules'
import { isCampaignAllowingDiscount } from '@/lib/pos-discount-campaign-ui'

function getRulePriority(
  ctx: PosDiscountContext,
  rule: PosDiscountRule & { campaignId?: string | null },
  source: 'product' | 'category'
): number {
  const campaign = rule.campaignId ? ctx.campaigns.get(rule.campaignId) : undefined
  const base = campaign?.priority ?? 0
  return source === 'product' ? base + 1000 : base
}

function resolveRuleApplication(
  catalog: number,
  rule: PosDiscountRule & { campaignId?: string | null },
  ctx: PosDiscountContext,
  customerId: string | null | undefined,
  source: 'product' | 'category'
): (AppliedPosDiscount & { priority: number }) | null {
  if (
    rule.campaignId &&
    !isCampaignAllowingDiscount(rule.campaignId, ctx.campaigns, ctx.now, ctx.disabledCampaignIds)
  ) {
    return null
  }
  if (!isDiscountEffectivelyActive(rule, ctx.now)) return null
  if (!isDiscountEligibleForCustomer(rule, customerId)) return null
  const applied = applyDiscountRule(catalog, rule)
  if (!applied) return null

  const campaign = rule.campaignId ? ctx.campaigns.get(rule.campaignId) : undefined
  const campaignName = campaign?.name ?? null
  const displayName = campaignName ?? rule.promotionName ?? null

  return {
    unit: applied.discountedPrice,
    originalPrice: catalog,
    posDiscountAmount: applied.discountAmount,
    posDiscountType: rule.discountType,
    discountValue: rule.discountValue,
    promotionName: displayName,
    campaignId: rule.campaignId ?? null,
    campaignName,
    source,
    badgeLabel: posDiscountBadgeLabel(rule.discountType, rule.discountValue),
    priority: getRulePriority(ctx, rule, source),
  }
}

function pickLineDiscount(
  candidates: Array<AppliedPosDiscount & { priority: number }>,
  catalog: number,
  mode: PromotionConflictMode,
  ctx: PosDiscountContext,
  productRule?: PosProductDiscountDoc,
  categoryRule?: PosCategoryDiscountDoc,
  customerId?: string | null
): AppliedPosDiscount | null {
  if (candidates.length === 0) return null

  if (mode === 'allow_stacking' && productRule && categoryRule) {
    let price = catalog
    let totalDiscount = 0
    let meta: AppliedPosDiscount | null = null

    const productApplied = resolveRuleApplication(catalog, productRule, ctx, customerId, 'product')
    if (productApplied) {
      totalDiscount += productApplied.posDiscountAmount
      price = productApplied.unit
      meta = productApplied
    }

    const catApplied = resolveRuleApplication(price, categoryRule, ctx, customerId, 'category')
    if (catApplied) {
      totalDiscount += catApplied.posDiscountAmount
      price = catApplied.unit
      meta = catApplied
    }

    if (!meta || totalDiscount <= 0) return candidates[0] ?? null
    return {
      ...meta,
      unit: roundMoney(price),
      originalPrice: catalog,
      posDiscountAmount: roundMoney(totalDiscount),
      badgeLabel: totalDiscount > 0 ? 'Stacked Offer' : meta.badgeLabel,
    }
  }

  if (mode === 'best_discount') {
    return candidates.reduce((best, c) =>
      c.posDiscountAmount > best.posDiscountAmount ? c : best
    )
  }

  if (mode === 'highest_priority') {
    return candidates.reduce((best, c) => (c.priority > best.priority ? c : best))
  }

  return candidates[0]
}

export function resolvePosPrice(
  catalogPrice: number,
  productId: string,
  category: string,
  ctx: PosDiscountContext,
  customerId?: string | null
): AppliedPosDiscount | null {
  const catalog = roundMoney(Number(catalogPrice))
  if (!Number.isFinite(catalog) || catalog <= 0) return null

  const mode = ctx.conflictMode ?? 'never_stack'
  const candidates: Array<AppliedPosDiscount & { priority: number }> = []

  const productRule = ctx.productDiscounts.get(productId)
  const catKey = String(category || '').trim().toLowerCase()
  const categoryRule = catKey ? ctx.categoryDiscounts.get(catKey) : undefined

  if (productRule) {
    const resolved = resolveRuleApplication(catalog, productRule, ctx, customerId, 'product')
    if (resolved) candidates.push(resolved)
  }

  if (categoryRule) {
    const resolved = resolveRuleApplication(catalog, categoryRule, ctx, customerId, 'category')
    if (resolved) candidates.push(resolved)
  }

  if (candidates.length === 0) return null

  if (mode === 'never_stack' && candidates.length > 1) {
    const productFirst = candidates.find((c) => c.source === 'product')
    return productFirst ?? candidates[0]
  }

  return pickLineDiscount(
    candidates,
    catalog,
    mode,
    ctx,
    productRule,
    categoryRule,
    customerId
  )
}

export function buildPosDiscountContextFromApi(
  productRules: Array<{
    productId: string
    discountType: PosDiscountType
    discountValue: number
    status: PosDiscountStatus
    startAt?: string | null
    endAt?: string | null
    promotionName?: string | null
    eligibilityScope?: PosDiscountEligibilityScope
    eligibleCustomers?: string[]
    campaignId?: string | null
  }>,
  categoryRules: Array<{
    category: string
    discountType: PosDiscountType
    discountValue: number
    status: PosDiscountStatus
    startAt?: string | null
    endAt?: string | null
    promotionName?: string | null
    eligibilityScope?: PosDiscountEligibilityScope
    eligibleCustomers?: string[]
    campaignId?: string | null
  }>,
  campaigns: Map<string, PosDiscountCampaignDoc> = new Map(),
  now: Date = new Date(),
  conflictMode?: PromotionConflictMode,
  disabledCampaignIds?: Set<string>
): PosDiscountContext {
  const productDiscounts = new Map<string, PosProductDiscountDoc>()
  for (const r of productRules) {
    const eligibility = normalizeDiscountEligibility(r)
    productDiscounts.set(r.productId, {
      productId: r.productId,
      discountType: r.discountType,
      discountValue: r.discountValue,
      status: r.status,
      startAt: parseOptionalDate(r.startAt),
      endAt: parseOptionalDate(r.endAt),
      promotionName: r.promotionName ?? null,
      eligibilityScope: eligibility.scope,
      eligibleCustomers: eligibility.eligibleCustomers,
      campaignId: r.campaignId ?? null,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  const categoryDiscounts = new Map<string, PosCategoryDiscountDoc>()
  for (const r of categoryRules) {
    const key = String(r.category).toLowerCase()
    const eligibility = normalizeDiscountEligibility(r)
    categoryDiscounts.set(key, {
      category: key,
      discountType: r.discountType,
      discountValue: r.discountValue,
      status: r.status,
      startAt: parseOptionalDate(r.startAt),
      endAt: parseOptionalDate(r.endAt),
      promotionName: r.promotionName ?? null,
      eligibilityScope: eligibility.scope,
      eligibleCustomers: eligibility.eligibleCustomers,
      campaignId: r.campaignId ?? null,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  return {
    productDiscounts,
    categoryDiscounts,
    campaigns,
    now,
    conflictMode,
    disabledCampaignIds,
  }
}

export function applyPosDiscountToUnitPrice(
  catalogUnit: number,
  productId: string,
  category: string,
  ctx: PosDiscountContext,
  customerId?: string | null
): {
  unit: number
  originalPrice?: number
  posDiscountAmount?: number
  posDiscountType?: PosDiscountType
  promotionName?: string | null
  campaignId?: string | null
  campaignName?: string | null
  discountValue?: number
  source?: 'product' | 'category'
  badgeLabel?: string
} {
  const resolved = resolvePosPrice(catalogUnit, productId, category, ctx, customerId)
  if (!resolved) return { unit: roundMoney(catalogUnit) }
  return {
    unit: resolved.unit,
    originalPrice: resolved.originalPrice,
    posDiscountAmount: resolved.posDiscountAmount,
    posDiscountType: resolved.posDiscountType,
    promotionName: resolved.promotionName,
    campaignId: resolved.campaignId,
    campaignName: resolved.campaignName,
    discountValue: resolved.discountValue,
    source: resolved.source,
    badgeLabel: resolved.badgeLabel,
  }
}

export function countEffectivelyActiveDiscounts(ctx: PosDiscountContext): number {
  let count = 0
  for (const rule of ctx.productDiscounts.values()) {
    if (rule.campaignId && !isCampaignAllowingDiscount(rule.campaignId, ctx.campaigns, ctx.now, ctx.disabledCampaignIds)) continue
    if (isDiscountEffectivelyActive(rule, ctx.now)) count++
  }
  for (const rule of ctx.categoryDiscounts.values()) {
    if (rule.campaignId && !isCampaignAllowingDiscount(rule.campaignId, ctx.campaigns, ctx.now, ctx.disabledCampaignIds)) continue
    if (isDiscountEffectivelyActive(rule, ctx.now)) count++
  }
  return count
}

export interface CustomerEligibleDiscount {
  id: string
  targetType: 'product' | 'category'
  targetName: string
  promotionName: string | null
  discountType: PosDiscountType
  discountValue: number
  discountLabel: string
}

export function listEligibleDiscountsForCustomer(
  customerId: string,
  ctx: PosDiscountContext,
  productNames: Map<string, string>,
  categoryLabels: Map<string, string>
): CustomerEligibleDiscount[] {
  const normalized = normalizeCustomerIdForEligibility(customerId)
  if (!normalized) return []

  const out: CustomerEligibleDiscount[] = []

  for (const rule of ctx.productDiscounts.values()) {
    if (rule.campaignId && !isCampaignAllowingDiscount(rule.campaignId, ctx.campaigns, ctx.now, ctx.disabledCampaignIds)) continue
    if (!isDiscountEffectivelyActive(rule, ctx.now)) continue
    if (!isDiscountEligibleForCustomer(rule, normalized)) continue
    const name = productNames.get(rule.productId) || rule.productId
    out.push({
      id: rule.productId,
      targetType: 'product',
      targetName: name,
      promotionName: rule.promotionName ?? null,
      discountType: rule.discountType,
      discountValue: rule.discountValue,
      discountLabel:
        rule.discountType === 'percentage'
          ? `${rule.discountValue}%`
          : `KSh ${rule.discountValue} off`,
    })
  }

  for (const rule of ctx.categoryDiscounts.values()) {
    if (rule.campaignId && !isCampaignAllowingDiscount(rule.campaignId, ctx.campaigns, ctx.now, ctx.disabledCampaignIds)) continue
    if (!isDiscountEffectivelyActive(rule, ctx.now)) continue
    if (!isDiscountEligibleForCustomer(rule, normalized)) continue
    const label = categoryLabels.get(rule.category) || rule.category
    out.push({
      id: rule.category,
      targetType: 'category',
      targetName: label,
      promotionName: rule.promotionName ?? null,
      discountType: rule.discountType,
      discountValue: rule.discountValue,
      discountLabel:
        rule.discountType === 'percentage'
          ? `${rule.discountValue}%`
          : `KSh ${rule.discountValue} off`,
    })
  }

  return out.sort((a, b) => {
    const aName = a.promotionName || a.targetName
    const bName = b.promotionName || b.targetName
    return aName.localeCompare(bName)
  })
}
