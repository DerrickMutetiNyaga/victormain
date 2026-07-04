/**
 * POS-only product & category discounts — never mutates bar_inventory.price.
 * Product-level discounts win over category-level discounts.
 * Prices are always computed from live catalog price at runtime.
 */

import type { Db } from 'mongodb'

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

export interface PosDiscountRule {
  discountType: PosDiscountType
  discountValue: number
  status: PosDiscountStatus
  startAt?: Date | null
  endAt?: Date | null
  promotionName?: string | null
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
  source: 'product' | 'category'
  badgeLabel: string
}

export interface PosDiscountContext {
  productDiscounts: Map<string, PosProductDiscountDoc>
  categoryDiscounts: Map<string, PosCategoryDiscountDoc>
  now: Date
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

/**
 * Resolve POS price: product discount wins over category discount.
 * Always uses live catalogPrice — never a stored snapshot.
 */
export function resolvePosPrice(
  catalogPrice: number,
  productId: string,
  category: string,
  ctx: PosDiscountContext
): AppliedPosDiscount | null {
  const catalog = roundMoney(Number(catalogPrice))
  if (!Number.isFinite(catalog) || catalog <= 0) return null

  const productRule = ctx.productDiscounts.get(productId)
  if (productRule && isDiscountEffectivelyActive(productRule, ctx.now)) {
    const applied = applyDiscountRule(catalog, productRule)
    if (applied) {
      return {
        unit: applied.discountedPrice,
        originalPrice: catalog,
        posDiscountAmount: applied.discountAmount,
        posDiscountType: productRule.discountType,
        discountValue: productRule.discountValue,
        promotionName: productRule.promotionName ?? null,
        source: 'product',
        badgeLabel: posDiscountBadgeLabel(productRule.discountType, productRule.discountValue),
      }
    }
  }

  const catKey = String(category || '').trim().toLowerCase()
  const categoryRule = catKey ? ctx.categoryDiscounts.get(catKey) : undefined
  if (categoryRule && isDiscountEffectivelyActive(categoryRule, ctx.now)) {
    const applied = applyDiscountRule(catalog, categoryRule)
    if (applied) {
      return {
        unit: applied.discountedPrice,
        originalPrice: catalog,
        posDiscountAmount: applied.discountAmount,
        posDiscountType: categoryRule.discountType,
        discountValue: categoryRule.discountValue,
        promotionName: categoryRule.promotionName ?? null,
        source: 'category',
        badgeLabel: posDiscountBadgeLabel(categoryRule.discountType, categoryRule.discountValue),
      }
    }
  }

  return null
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

  return {
    id: String(doc._id),
    productId: String(doc.productId),
    discountType,
    discountValue,
    status: (doc.status as PosDiscountStatus) || 'inactive',
    startAt: toIsoDate(doc.startAt),
    endAt: toIsoDate(doc.endAt),
    promotionName: doc.promotionName != null ? String(doc.promotionName) : null,
    createdBy: doc.createdBy != null ? String(doc.createdBy) : null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ''),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt ?? ''),
    catalogPrice,
    discountedPrice,
    discountPercent,
  }
}

export function serializeCategoryDiscount(doc: Record<string, unknown>): PosCategoryDiscountPublic {
  return {
    id: String(doc._id),
    category: String(doc.category),
    discountType: doc.discountType as PosDiscountType,
    discountValue: Number(doc.discountValue ?? 0),
    status: (doc.status as PosDiscountStatus) || 'inactive',
    startAt: toIsoDate(doc.startAt),
    endAt: toIsoDate(doc.endAt),
    promotionName: doc.promotionName != null ? String(doc.promotionName) : null,
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
  return {
    _id: row._id,
    productId: String(row.productId),
    discountType: row.discountType as PosDiscountType,
    discountValue: Number(row.discountValue ?? 0),
    status: (row.status as PosDiscountStatus) || 'inactive',
    startAt: parseOptionalDate(row.startAt),
    endAt: parseOptionalDate(row.endAt),
    promotionName: row.promotionName != null ? String(row.promotionName) : null,
    createdBy: row.createdBy != null ? String(row.createdBy) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(),
  }
}

function mapCategoryDiscountRow(row: Record<string, unknown>): PosCategoryDiscountDoc {
  return {
    _id: row._id,
    category: String(row.category).toLowerCase(),
    discountType: row.discountType as PosDiscountType,
    discountValue: Number(row.discountValue ?? 0),
    status: (row.status as PosDiscountStatus) || 'inactive',
    startAt: parseOptionalDate(row.startAt),
    endAt: parseOptionalDate(row.endAt),
    promotionName: row.promotionName != null ? String(row.promotionName) : null,
    createdBy: row.createdBy != null ? String(row.createdBy) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(),
  }
}

/** Load all discount rules; effective filtering happens at resolve time */
export async function loadPosDiscountContext(db: Db, now: Date = new Date()): Promise<PosDiscountContext> {
  const [productRows, categoryRows] = await Promise.all([
    db.collection(POS_DISCOUNTS_COLLECTION).find({}).toArray(),
    db.collection(POS_CATEGORY_DISCOUNTS_COLLECTION).find({}).toArray(),
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

  return { productDiscounts, categoryDiscounts, now }
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
  ctx: PosDiscountContext
): {
  unit: number
  originalPrice?: number
  posDiscountAmount?: number
  posDiscountType?: PosDiscountType
  promotionName?: string | null
  discountValue?: number
  source?: 'product' | 'category'
  badgeLabel?: string
} {
  const resolved = resolvePosPrice(catalogUnit, productId, category, ctx)
  if (!resolved) return { unit: roundMoney(catalogUnit) }
  return {
    unit: resolved.unit,
    originalPrice: resolved.originalPrice,
    posDiscountAmount: resolved.posDiscountAmount,
    posDiscountType: resolved.posDiscountType,
    promotionName: resolved.promotionName,
    discountValue: resolved.discountValue,
    source: resolved.source,
    badgeLabel: resolved.badgeLabel,
  }
}

export interface PosDiscountAuditEntry {
  action: PosDiscountAuditAction
  targetType: 'product' | 'category'
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
    if (isDiscountEffectivelyActive(rule, ctx.now)) count++
  }
  for (const rule of ctx.categoryDiscounts.values()) {
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
  }>,
  categoryRules: Array<{
    category: string
    discountType: PosDiscountType
    discountValue: number
    status: PosDiscountStatus
    startAt?: string | null
    endAt?: string | null
    promotionName?: string | null
  }>,
  now: Date = new Date()
): PosDiscountContext {
  const productDiscounts = new Map<string, PosProductDiscountDoc>()
  for (const r of productRules) {
    productDiscounts.set(r.productId, {
      productId: r.productId,
      discountType: r.discountType,
      discountValue: r.discountValue,
      status: r.status,
      startAt: parseOptionalDate(r.startAt),
      endAt: parseOptionalDate(r.endAt),
      promotionName: r.promotionName ?? null,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  const categoryDiscounts = new Map<string, PosCategoryDiscountDoc>()
  for (const r of categoryRules) {
    const key = String(r.category).toLowerCase()
    categoryDiscounts.set(key, {
      category: key,
      discountType: r.discountType,
      discountValue: r.discountValue,
      status: r.status,
      startAt: parseOptionalDate(r.startAt),
      endAt: parseOptionalDate(r.endAt),
      promotionName: r.promotionName ?? null,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  return { productDiscounts, categoryDiscounts, now }
}

export type DiscountInputPayload = {
  productId: string
  discountType: PosDiscountType
  discountValue: number
  status?: PosDiscountStatus
  startAt?: string | null
  endAt?: string | null
  promotionName?: string | null
}

export type CategoryDiscountInputPayload = {
  category: string
  discountType: PosDiscountType
  discountValue: number
  status?: PosDiscountStatus
  startAt?: string | null
  endAt?: string | null
  promotionName?: string | null
}

export function buildDiscountDocFields(
  input: Omit<DiscountInputPayload, 'productId'>,
  staffEmail: string | null,
  now: Date
) {
  return {
    discountType: input.discountType,
    discountValue: Number(input.discountValue),
    status: input.status === 'inactive' ? ('inactive' as const) : ('active' as const),
    startAt: parseOptionalDate(input.startAt),
    endAt: parseOptionalDate(input.endAt),
    promotionName: input.promotionName?.trim() || null,
    createdBy: staffEmail,
    updatedAt: now,
  }
}
