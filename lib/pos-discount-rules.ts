/**
 * Pure POS discount rule helpers — no MongoDB (client + server safe).
 */

import { normalizeKenyaPhone } from '@/lib/phone-utils'
import type {
  PosDiscountEligibilityScope,
  PosDiscountRule,
  PosDiscountStatus,
  PosDiscountType,
} from '@/lib/pos-discount-types'

export function roundMoney(n: number): number {
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

  return false
}

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

function toIsoDate(value: unknown): string | null {
  const d = parseOptionalDate(value)
  return d ? d.toISOString() : null
}

export function serializePosDiscount(
  doc: Record<string, unknown>,
  catalogPrice?: number
) {
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

export function serializeCategoryDiscount(doc: Record<string, unknown>) {
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

export function buildDiscountDocFields(
  input: {
    discountType: PosDiscountType
    discountValue: number
    status?: PosDiscountStatus
    startAt?: string | null
    endAt?: string | null
    promotionName?: string | null
    eligibilityScope?: PosDiscountEligibilityScope
    eligibleCustomers?: string[]
    campaignId?: string | null
  },
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
