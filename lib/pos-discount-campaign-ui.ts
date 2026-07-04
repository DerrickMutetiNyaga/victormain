/**
 * Campaign UI helpers — no MongoDB (client + server safe).
 */

import type {
  PosCampaignStatus,
  PosDiscountCampaignDoc,
  PosDiscountContext,
  PosCampaignBanner,
  PosDiscountType,
} from '@/lib/pos-discount-types'
import {
  parseOptionalDate,
  isDiscountEffectivelyActive,
  isDiscountEligibleForCustomer,
  normalizeCustomerIdForEligibility,
} from '@/lib/pos-discount-rules'

export type { PosDiscountCampaignDoc, PosCampaignBanner }

export function isCampaignEffectivelyActive(
  campaign: Pick<PosDiscountCampaignDoc, 'status' | 'startAt' | 'endAt'>,
  now: Date = new Date()
): boolean {
  if (campaign.status !== 'active') return false
  const start = parseOptionalDate(campaign.startAt)
  const end = parseOptionalDate(campaign.endAt)
  if (start && now < start) return false
  if (end && now > end) return false
  return true
}

export function isCampaignAllowingDiscount(
  campaignId: string | null | undefined,
  campaigns: Map<string, PosDiscountCampaignDoc>,
  now: Date,
  disabledCampaignIds?: Set<string>
): boolean {
  if (!campaignId) return true
  if (disabledCampaignIds?.has(campaignId)) return false
  const campaign = campaigns.get(campaignId)
  if (!campaign) return false
  return isCampaignEffectivelyActive(campaign, now)
}

export function buildCampaignsMapFromApi(
  campaigns: Array<{
    id: string
    name: string
    description?: string | null
    status: PosCampaignStatus
    priority: number
    startAt?: string | null
    endAt?: string | null
    color?: string | null
    icon?: string | null
  }>,
  now: Date = new Date()
): Map<string, PosDiscountCampaignDoc> {
  const map = new Map<string, PosDiscountCampaignDoc>()
  for (const c of campaigns) {
    map.set(c.id, {
      name: c.name,
      description: c.description ?? null,
      status: c.status,
      priority: c.priority,
      startAt: parseOptionalDate(c.startAt),
      endAt: parseOptionalDate(c.endAt),
      color: c.color ?? null,
      icon: c.icon ?? null,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    })
  }
  return map
}

export function getActiveCampaignBanners(
  ctx: PosDiscountContext,
  customerId?: string | null
): PosCampaignBanner[] {
  const banners: PosCampaignBanner[] = []

  for (const [campaignId, campaign] of ctx.campaigns) {
    if (!isCampaignEffectivelyActive(campaign, ctx.now)) continue
    if (ctx.disabledCampaignIds?.has(campaignId)) continue

    let hasVisibleDiscount = false
    let maxPct = 0
    let sampleLabel = ''

    for (const rule of ctx.productDiscounts.values()) {
      if (rule.campaignId !== campaignId) continue
      if (!isDiscountEffectivelyActive(rule, ctx.now)) continue
      if (!isDiscountEligibleForCustomer(rule, customerId)) continue
      hasVisibleDiscount = true
      if (rule.discountType === 'percentage' && rule.discountValue > maxPct) {
        maxPct = rule.discountValue
        sampleLabel = `${Math.round(rule.discountValue)}% OFF Selected Drinks`
      }
    }
    for (const rule of ctx.categoryDiscounts.values()) {
      if (rule.campaignId !== campaignId) continue
      if (!isDiscountEffectivelyActive(rule, ctx.now)) continue
      if (!isDiscountEligibleForCustomer(rule, customerId)) continue
      hasVisibleDiscount = true
      if (rule.discountType === 'percentage' && rule.discountValue > maxPct) {
        maxPct = rule.discountValue
        sampleLabel = `${Math.round(rule.discountValue)}% OFF Selected Categories`
      }
    }

    if (!hasVisibleDiscount) continue

    banners.push({
      id: campaignId,
      name: campaign.name,
      icon: campaign.icon ?? '🔥',
      color: campaign.color ?? null,
      headline: campaign.name.toUpperCase(),
      subline: sampleLabel || campaign.description || null,
      endsAt: campaign.endAt ? campaign.endAt.toISOString() : null,
      priority: campaign.priority,
    })
  }

  return banners.sort((a, b) => b.priority - a.priority)
}

export interface CustomerEligibleCampaign {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  discountSummary: string
}

export function listEligibleCampaignsForCustomer(
  customerId: string,
  ctx: PosDiscountContext
): CustomerEligibleCampaign[] {
  const normalized = normalizeCustomerIdForEligibility(customerId)
  if (!normalized) return []

  const out: CustomerEligibleCampaign[] = []

  for (const [campaignId, campaign] of ctx.campaigns) {
    if (!isCampaignEffectivelyActive(campaign, ctx.now)) continue

    let eligible = false
    let maxPct = 0

    for (const rule of ctx.productDiscounts.values()) {
      if (rule.campaignId !== campaignId) continue
      if (!isDiscountEffectivelyActive(rule, ctx.now)) continue
      if (!isDiscountEligibleForCustomer(rule, normalized)) continue
      eligible = true
      if (rule.discountType === 'percentage') maxPct = Math.max(maxPct, rule.discountValue)
    }
    for (const rule of ctx.categoryDiscounts.values()) {
      if (rule.campaignId !== campaignId) continue
      if (!isDiscountEffectivelyActive(rule, ctx.now)) continue
      if (!isDiscountEligibleForCustomer(rule, normalized)) continue
      eligible = true
      if (rule.discountType === 'percentage') maxPct = Math.max(maxPct, rule.discountValue)
    }

    if (!eligible) continue

    out.push({
      id: campaignId,
      name: campaign.name,
      description: campaign.description ?? null,
      icon: campaign.icon ?? null,
      color: campaign.color ?? null,
      discountSummary: maxPct > 0 ? `Up to ${Math.round(maxPct)}% off` : 'Special pricing',
    })
  }

  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export function formatDiscountLabel(type: PosDiscountType, value: number): string {
  if (type === 'percentage') return `${value}%`
  return `KSh ${value}`
}
