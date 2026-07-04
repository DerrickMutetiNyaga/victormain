/**
 * Shared POS discount types — safe for client and server (no MongoDB).
 */

import type { PromotionConflictMode } from '@/lib/pos-promotion-settings'

export type { PromotionConflictMode }

export const POS_DISCOUNTS_COLLECTION = 'pos_product_discounts'
export const POS_CATEGORY_DISCOUNTS_COLLECTION = 'pos_category_discounts'
export const POS_DISCOUNT_AUDIT_COLLECTION = 'pos_discount_audit_log'

export type PosDiscountType = 'percentage' | 'fixed'
export type PosDiscountStatus = 'active' | 'inactive'

export type PosCampaignStatus = 'active' | 'inactive' | 'archived'

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
  eligibilityScope?: PosDiscountEligibilityScope
  eligibleCustomers?: string[]
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

export interface PosDiscountCampaignDoc {
  _id?: unknown
  name: string
  description?: string | null
  status: PosCampaignStatus
  priority: number
  startAt?: Date | null
  endAt?: Date | null
  color?: string | null
  icon?: string | null
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

export interface PosCampaignBanner {
  id: string
  name: string
  icon: string | null
  color: string | null
  headline: string
  subline: string | null
  endsAt: string | null
  priority: number
}
