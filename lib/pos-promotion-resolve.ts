/**
 * Order-level promotion resolution — bundles, spend thresholds, promo codes.
 */

import type { Db } from 'mongodb'
import type { PosDiscountContext } from '@/lib/pos-product-discounts'
import { loadPosDiscountContext } from '@/lib/pos-product-discounts'
import { loadPromotionSettings } from '@/lib/pos-promotion-settings'
import { loadDisabledCampaignIdsForDate, dateKeyForNow } from '@/lib/pos-campaign-overrides'
import { loadBundlePromotions, computeBundleOrderDiscount } from '@/lib/pos-bundle-promotions'
import { loadSpendPromotions, resolveSpendPromotion } from '@/lib/pos-spend-promotions'
import { validatePromoCode, type PromoCodeValidationLine } from '@/lib/pos-promo-codes'
import type { ResolvedOrderLine } from '@/lib/secure-bar-order-lines'

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export interface FullPromotionContext extends PosDiscountContext {
  bundles: Awaited<ReturnType<typeof loadBundlePromotions>>
  spendPromotions: Awaited<ReturnType<typeof loadSpendPromotions>>
}

export async function loadFullPromotionContext(
  db: Db,
  now: Date = new Date()
): Promise<FullPromotionContext> {
  const dateKey = dateKeyForNow(now)
  const [base, conflictMode, disabledCampaignIds, bundles, spendPromotions] = await Promise.all([
    loadPosDiscountContext(db, now),
    loadPromotionSettings(db),
    loadDisabledCampaignIdsForDate(db, dateKey),
    loadBundlePromotions(db),
    loadSpendPromotions(db),
  ])

  return {
    ...base,
    conflictMode,
    disabledCampaignIds,
    bundles,
    spendPromotions,
  }
}

export interface OrderPromotionBreakdown {
  bundleDiscount: number
  spendDiscount: number
  couponDiscount: number
  orderDiscount: number
  appliedBundles: string[]
  spendPromotionName: string | null
  spendPromotionId: string | null
  promoCode: string | null
  promoCodeId: string | null
  promoCodeLabel: string | null
  total: number
}

export async function resolveOrderPromotions(
  db: Db,
  opts: {
    items: ResolvedOrderLine[]
    subtotal: number
    customerId?: string | null
    promoCode?: string | null
    promotionCtx?: FullPromotionContext
    now?: Date
  }
): Promise<OrderPromotionBreakdown> {
  const now = opts.now ?? new Date()
  const ctx = opts.promotionCtx ?? (await loadFullPromotionContext(db, now))
  let subtotal = roundMoney(opts.subtotal)

  const bundleLines = opts.items
    .filter((item) => item.productId && !item.isCustomItem)
    .map((item, index) => ({
      index,
      productId: item.productId!,
      quantity: item.quantity,
      unitPrice: item.price,
      catalogPrice: item.originalPrice ?? item.price,
    }))

  const bundleResult = computeBundleOrderDiscount(bundleLines, ctx.bundles, {
    customerId: opts.customerId,
    campaigns: ctx.campaigns,
    disabledCampaignIds: ctx.disabledCampaignIds,
    now,
  })

  const bundleDiscount = bundleResult.discount
  subtotal = roundMoney(Math.max(0, subtotal - bundleDiscount))

  const spendResult = resolveSpendPromotion(subtotal, ctx.spendPromotions, {
    customerId: opts.customerId,
    campaigns: ctx.campaigns,
    disabledCampaignIds: ctx.disabledCampaignIds,
    now,
  })
  const spendDiscount = spendResult?.discountAmount ?? 0
  subtotal = roundMoney(Math.max(0, subtotal - spendDiscount))

  let couponDiscount = 0
  let promoCode: string | null = null
  let promoCodeId: string | null = null
  let promoCodeLabel: string | null = null

  const rawCode = opts.promoCode?.trim()
  if (rawCode) {
    const promoLines: PromoCodeValidationLine[] = opts.items
      .filter((item) => item.productId && !item.isCustomItem)
      .map((item) => ({
        productId: item.productId!,
        category: item.category ?? '',
        quantity: item.quantity,
        unitPrice: item.price,
        catalogPrice: item.originalPrice ?? item.price,
      }))

    const validated = await validatePromoCode(db, rawCode, {
      customerId: opts.customerId,
      lines: promoLines,
      subtotal,
      campaigns: ctx.campaigns,
      disabledCampaignIds: ctx.disabledCampaignIds,
      now,
    })

    if (validated.ok) {
      couponDiscount = validated.orderDiscount
      promoCode = validated.code
      promoCodeId = validated.promoCodeId
      promoCodeLabel = validated.label
      subtotal = roundMoney(Math.max(0, subtotal - couponDiscount))
    }
  }

  const orderDiscount = roundMoney(bundleDiscount + spendDiscount + couponDiscount)
  const total = roundMoney(Math.max(0, opts.subtotal - orderDiscount))

  return {
    bundleDiscount,
    spendDiscount,
    couponDiscount,
    orderDiscount,
    appliedBundles: bundleResult.appliedBundles,
    spendPromotionName: spendResult?.name ?? null,
    spendPromotionId: spendResult?.promotionId ?? null,
    promoCode,
    promoCodeId,
    promoCodeLabel,
    total,
  }
}
