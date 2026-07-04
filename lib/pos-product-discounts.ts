/**
 * POS-only product & category discounts — never mutates bar_inventory.price.
 * Product-level discounts win over category-level discounts.
 * Prices are always computed from live catalog price at runtime.
 */

import type { Db } from 'mongodb'
import { normalizeKenyaPhone } from '@/lib/phone-utils'
import {
  isCampaignAllowingDiscount,
  type PosDiscountCampaignDoc,
} from '@/lib/pos-discount-campaigns'
import type { PromotionConflictMode } from '@/lib/pos-promotion-settings'
export type { PromotionConflictMode }

export const POS_DISCOUNTS_COLLECTION = 'pos_product_discounts'
export const POS_CATEGORY_DISCOUNTS_COLLECTION = 'pos_category_discounts'
export const POS_DISCOUNT_AUDIT_COLLECTION = 'pos_discount_audit_log'

export type PosDiscountType = 'percentage' | 'fixed'
export type PosDiscountStatus = 'active' | 'inactive'

export type PosDiscountAuditAction =
  | 'created'
  | 'updated'
  | 'disabled'
  | 'enabled'
  | 'deleted'
  | 'bulk_applied'
  | 'category_applied'
  | 'eligibility_changed'
  | 'campaign_created'
  | 'campaign_updated'
  | 'campaign_activated'
  | 'campaign_disabled'
  | 'campaign_archived'
  | 'campaign_deleted'
  | 'promotion_settings_updated'
  | 'coupon_created'
  | 'coupon_updated'
  | 'coupon_deleted'
  | 'bundle_created'
  | 'bundle_updated'
  | 'bundle_deleted'
  | 'spend_promo_created'
  | 'spend_promo_updated'
  | 'spend_promo_deleted'
  | 'campaign_override_created'
  | 'campaign_override_removed'

/** Who may receive a discount — extensible for future loyalty / membership scopes */
export type PosDiscountEligibilityScope =
  | 'everyone'
  | 'selected_customers'
  | 'customer_group'
  | 'loyalty_tier'
  | 'membership_plan'

export interface PosDiscountRule {
  discountType: PosDiscountType
  discountValue: number
  status: PosDiscountStatus
  startAt?: Date | null
  endAt?: Date | null
  promotionName?: string | null
  /** Defaults to 'everyone' when absent (backward compatible) */
  eligibilityScope?: PosDiscountEligibilityScope
  /** Normalized customer IDs (phone). Empty = available to everyone */
  eligibleCustomers?: string[]
  /** Optional promotion campaign link */
  campaignId?: string | null
}

export interface PosProductDiscountDoc extends PosDiscountRule {
  _id?: unknown
  productId: string
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PosCategoryDiscountDoc extends PosDiscountRule {
  _id?: unknown
  category: string
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PosDiscountPublic {
  id: string
  productId: string
  discountType: PosDiscountType
  discountValue: number
  status: PosDiscountStatus
  startAt: string | null
  endAt: string | null
  promotionName: string | null
  eligibilityScope: PosDiscountEligibilityScope
  eligibleCustomers: string[]
  campaignId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  /** Live catalog price — computed at read time, not stored for pricing */
  catalogPrice?: number
  discountedPrice?: number
  discountPercent?: number
}

export interface PosCategoryDiscountPublic {
  id: string
  category: string
  discountType: PosDiscountType
  discountValue: number
  status: PosDiscountStatus
  startAt: string | null
  endAt: string | null
  promotionName: string | null
  eligibilityScope: PosDiscountEligibilityScope
  eligibleCustomers: string[]
  campaignId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface AppliedPosDiscount {
  unit: number
  originalPrice: number
  posDiscountAmount: number
  posDiscountType: PosDiscountType
  discountValue: number
  promotionName: string | null
  campaignId: string | null
  campaignName: string | null
  source: 'product' | 'category'
  badgeLabel: string
}

export interface PosDiscountContext {
  productDiscounts: Map<string, PosProductDiscountDoc>
  categoryDiscounts: Map<string, PosCategoryDiscountDoc>
  campaigns: Map<string, PosDiscountCampaignDoc>
  now: Date
  conflictMode?: PromotionConflictMode
  disabledCampaignIds?: Set<string>
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function parseOptionalDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

export function validateDiscountInput(
  discountType: PosDiscountType,
  discountValue: number,
  originalPrice: number
): { ok: true; discountedPrice: number } | { ok: false; error: string } {
  const original = roundMoney(Number(originalPrice))
  if (!Number.isFinite(original) || original <= 0) {
    return { ok: false, error: 'Invalid original price' }
  }

  const value = Number(discountValue)
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, error: 'Discount value must be zero or greater' }
  }

  if (discountType === 'percentage') {
    if (value > 100) {
      return { ok: false, error: 'Percentage discount cannot exceed 100%' }
    }
    const discountedPrice = roundMoney(original * (1 - value / 100))
    return { ok: true, discountedPrice: Math.max(0, discountedPrice) }
  }

  if (discountType === 'fixed') {
    const discountedPrice = roundMoney(original - value)
    if (discountedPrice < 0) {
      return { ok: false, error: 'Fixed discount cannot reduce price below zero' }
    }
    return { ok: true, discountedPrice }
  }

  return { ok: false, error: 'Invalid discount type' }
}

export function computePosDiscountAmount(originalPrice: number, discountedPrice: number): number {
  return roundMoney(Math.max(0, originalPrice - discountedPrice))
}

export function posDiscountBadgeLabel(
  discountType: PosDiscountType,
  discountValue: number
): string {
  if (discountType === 'percentage' && discountValue > 0) {
    return `${Math.round(discountValue)}% OFF`
  }
  if (discountType === 'fixed' && discountValue > 0) {
    return 'Special Price'
  }
  return 'POS Offer'
}

export function normalizeCustomerIdForEligibility(id: string | null | undefined): string | null {
  if (!id) return null
  const trimmed = String(id).trim()
  if (!trimmed) return null
  return normalizeKenyaPhone(trimmed) || trimmed
}

export function normalizeEligibleCustomerIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const out = new Set<string>()
  for (const raw of ids) {
    const normalized = normalizeCustomerIdForEligibility(String(raw))
    if (normalized) out.add(normalized)
  }
  return [...out]
}

export function normalizeDiscountEligibility(
  rule: Partial<{
    eligibilityScope?: PosDiscountEligibilityScope
    eligibleCustomers?: unknown
  }>
): { scope: PosDiscountEligibilityScope; eligibleCustomers: string[] } {
  const eligibleCustomers = normalizeEligibleCustomerIds(rule.eligibleCustomers)
  let scope = (rule.eligibilityScope as PosDiscountEligibilityScope) || 'everyone'
  if (eligibleCustomers.length === 0) {
    scope = 'everyone'
  } else if (scope === 'everyone') {
    scope = 'selected_customers'
  }
  return { scope, eligibleCustomers }
}

/**
 * Whether a discount may apply for the current POS customer.
 * No customer selected → only public (everyone) discounts qualify.
 */
export function isDiscountEligibleForCustomer(
  rule: Pick<PosDiscountRule, 'eligibilityScope' | 'eligibleCustomers'>,
  customerId: string | null | undefined
): boolean {
  const { scope, eligibleCustomers } = normalizeDiscountEligibility(rule)

  if (scope === 'everyone' || eligibleCustomers.length === 0) {
    return true
  }

  if (scope === 'selected_customers') {
    const normalized = normalizeCustomerIdForEligibility(customerId)
    if (!normalized) return false
    return eligibleCustomers.includes(normalized)
  }

  // Future scopes (customer_group, loyalty_tier, membership_plan) — not yet implemented
  return false
}

/** Manual status + schedule window */
export function isDiscountEffectivelyActive(
  rule: Pick<PosDiscountRule, 'status' | 'startAt' | 'endAt'>,
  now: Date = new Date()
): boolean {
  if (rule.status !== 'active') return false
  const start = parseOptionalDate(rule.startAt)
  const end = parseOptionalDate(rule.endAt)
  if (start && now < start) return false
  if (end && now > end) return false
  return true
}

export function applyDiscountRule(
  catalogPrice: number,
  rule: PosDiscountRule
): { discountedPrice: number; discountAmount: number } | null {
  const validated = validateDiscountInput(rule.discountType, rule.discountValue, catalogPrice)
  if (!validated.ok) return null
  const discountAmount = computePosDiscountAmount(catalogPrice, validated.discountedPrice)
  if (discountAmount <= 0) return null
  return { discountedPrice: validated.discountedPrice, discountAmount }
}

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

  // never_stack: product candidate listed first
  return candidates[0]
}

/**
 * Resolve POS price with configurable conflict resolution.
 */
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

function toIsoDate(value: unknown): string | null {
  const d = parseOptionalDate(value)
  return d ? d.toISOString() : null
}

export function serializePosDiscount(
  doc: Record<string, unknown>,
  catalogPrice?: number
): PosDiscountPublic {
  const discountType = doc.discountType as PosDiscountType
  const discountValue = Number(doc.discountValue ?? 0)
  let discountedPrice: number | undefined
  let discountPercent: number | undefined

  if (catalogPrice != null && Number.isFinite(catalogPrice)) {
    const validated = validateDiscountInput(discountType, discountValue, catalogPrice)
    if (validated.ok) {
      discountedPrice = validated.discountedPrice
      if (catalogPrice > 0) {
        discountPercent = roundMoney(((catalogPrice - validated.discountedPrice) / catalogPrice) * 100)
      }
    }
  }

  const eligibility = normalizeDiscountEligibility({
    eligibilityScope: doc.eligibilityScope as PosDiscountEligibilityScope | undefined,
    eligibleCustomers: doc.eligibleCustomers,
  })

  return {
    id: String(doc._id),
    productId: String(doc.productId),
    discountType,
    discountValue,
    status: (doc.status as PosDiscountStatus) || 'inactive',
    startAt: toIsoDate(doc.startAt),
    endAt: toIsoDate(doc.endAt),
    promotionName: doc.promotionName != null ? String(doc.promotionName) : null,
    eligibilityScope: eligibility.scope,
    eligibleCustomers: eligibility.eligibleCustomers,
    campaignId: doc.campaignId != null ? String(doc.campaignId) : null,
    createdBy: doc.createdBy != null ? String(doc.createdBy) : null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ''),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt ?? ''),
    catalogPrice,
    discountedPrice,
    discountPercent,
  }
}

export function serializeCategoryDiscount(doc: Record<string, unknown>): PosCategoryDiscountPublic {
  const eligibility = normalizeDiscountEligibility({
    eligibilityScope: doc.eligibilityScope as PosDiscountEligibilityScope | undefined,
    eligibleCustomers: doc.eligibleCustomers,
  })

  return {
    id: String(doc._id),
    category: String(doc.category),
    discountType: doc.discountType as PosDiscountType,
    discountValue: Number(doc.discountValue ?? 0),
    status: (doc.status as PosDiscountStatus) || 'inactive',
    startAt: toIsoDate(doc.startAt),
    endAt: toIsoDate(doc.endAt),
    promotionName: doc.promotionName != null ? String(doc.promotionName) : null,
    eligibilityScope: eligibility.scope,
    eligibleCustomers: eligibility.eligibleCustomers,
    campaignId: doc.campaignId != null ? String(doc.campaignId) : null,
    createdBy: doc.createdBy != null ? String(doc.createdBy) : null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ''),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt ?? ''),
  }
}

export async function ensurePosDiscountIndexes(db: Db): Promise<void> {
  try {
    await db.collection(POS_DISCOUNTS_COLLECTION).createIndex({ productId: 1 }, { unique: true })
    await db.collection(POS_DISCOUNTS_COLLECTION).createIndex({ status: 1, startAt: 1, endAt: 1 })
    await db.collection(POS_CATEGORY_DISCOUNTS_COLLECTION).createIndex({ category: 1 }, { unique: true })
    await db.collection(POS_DISCOUNT_AUDIT_COLLECTION).createIndex({ createdAt: -1 })
  } catch {
    // indexes may already exist
  }
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

/** Load all discount rules; effective filtering happens at resolve time */
export async function loadPosDiscountContext(db: Db, now: Date = new Date()): Promise<PosDiscountContext> {
  const { loadCampaignsMap } = await import('@/lib/pos-discount-campaigns')
  const { loadPromotionSettings } = await import('@/lib/pos-promotion-settings')
  const { loadDisabledCampaignIdsForDate, dateKeyForNow } = await import('@/lib/pos-campaign-overrides')
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

export interface PosDiscountAuditEntry {
  action: PosDiscountAuditAction
  targetType: 'product' | 'category' | 'campaign' | 'settings' | 'coupon' | 'bundle' | 'spend_promotion' | 'campaign_override'
  targetId: string
  targetName: string
  actorEmail: string | null
  actorName: string | null
  details?: Record<string, unknown>
}

export async function logPosDiscountAudit(db: Db, entry: PosDiscountAuditEntry): Promise<void> {
  await db.collection(POS_DISCOUNT_AUDIT_COLLECTION).insertOne({
    ...entry,
    createdAt: new Date(),
  })
}

export function countEffectivelyActiveDiscounts(ctx: PosDiscountContext): number {
  let count = 0
  for (const rule of ctx.productDiscounts.values()) {
    if (rule.campaignId && !isCampaignAllowingDiscount(rule.campaignId, ctx.campaigns, ctx.now)) continue
    if (isDiscountEffectivelyActive(rule, ctx.now)) count++
  }
  for (const rule of ctx.categoryDiscounts.values()) {
    if (rule.campaignId && !isCampaignAllowingDiscount(rule.campaignId, ctx.campaigns, ctx.now)) continue
    if (isDiscountEffectivelyActive(rule, ctx.now)) count++
  }
  return count
}

/** Sum POS discount savings from order line items for a date range */
export function sumPosDiscountSavingsFromOrders(
  orders: Array<{ items?: Array<Record<string, unknown>>; timestamp?: Date | string }>,
  rangeStart: Date,
  rangeEnd: Date
): number {
  let total = 0
  for (const order of orders) {
    const ts = order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp ?? 0)
    if (ts < rangeStart || ts >= rangeEnd) continue
    for (const item of order.items ?? []) {
      const amt = Number(item.posDiscountAmount ?? 0)
      const qty = Number(item.quantity ?? 1)
      if (amt > 0 && qty > 0) total += amt * qty
    }
  }
  return roundMoney(total)
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

export function buildDiscountDocFields(
  input: Omit<DiscountInputPayload, 'productId'>,
  staffEmail: string | null,
  now: Date
) {
  const eligibility = normalizeDiscountEligibility({
    eligibilityScope: input.eligibilityScope,
    eligibleCustomers: input.eligibleCustomers,
  })
  return {
    discountType: input.discountType,
    discountValue: Number(input.discountValue),
    status: input.status === 'inactive' ? ('inactive' as const) : ('active' as const),
    startAt: parseOptionalDate(input.startAt),
    endAt: parseOptionalDate(input.endAt),
    promotionName: input.promotionName?.trim() || null,
    eligibilityScope: eligibility.scope,
    eligibleCustomers: eligibility.eligibleCustomers,
    campaignId: input.campaignId?.trim() || null,
    createdBy: staffEmail,
    updatedAt: now,
  }
}

/** Diff eligible customer IDs for audit logging */
export function diffEligibleCustomers(
  previous: string[] | undefined,
  next: string[] | undefined
): { added: string[]; removed: string[] } {
  const prevSet = new Set(normalizeEligibleCustomerIds(previous))
  const nextSet = new Set(normalizeEligibleCustomerIds(next))
  const added: string[] = []
  const removed: string[] = []
  for (const id of nextSet) {
    if (!prevSet.has(id)) added.push(id)
  }
  for (const id of prevSet) {
    if (!nextSet.has(id)) removed.push(id)
  }
  return { added, removed }
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

/** List discounts a customer is eligible for (active + scheduled within rules) */
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
    if (rule.campaignId && !isCampaignAllowingDiscount(rule.campaignId, ctx.campaigns, ctx.now)) continue
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
    if (rule.campaignId && !isCampaignAllowingDiscount(rule.campaignId, ctx.campaigns, ctx.now)) continue
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
