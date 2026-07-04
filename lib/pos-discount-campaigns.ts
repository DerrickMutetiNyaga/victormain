/**
 * POS promotion campaigns — server entry + re-exports.
 * Client components must import from `@/lib/pos-discount-client` instead.
 */

import type { Db } from 'mongodb'
import type {
  PosCampaignStatus,
  PosDiscountCampaignDoc,
  PosDiscountContext,
  PosDiscountType,
} from '@/lib/pos-discount-types'
import {
  parseOptionalDate,
  sumPosDiscountSavingsFromOrders,
} from '@/lib/pos-discount-rules'
import {
  isCampaignEffectivelyActive,
  formatDiscountLabel,
} from '@/lib/pos-discount-campaign-ui'

export * from '@/lib/pos-discount-campaign-ui'
export type { PosDiscountCampaignDoc } from '@/lib/pos-discount-types'

export const POS_DISCOUNT_CAMPAIGNS_COLLECTION = 'pos_discount_campaigns'

export type PosCampaignAuditAction =
  | 'campaign_created'
  | 'campaign_updated'
  | 'campaign_activated'
  | 'campaign_disabled'
  | 'campaign_archived'
  | 'campaign_deleted'

export interface PosDiscountCampaignPublic {
  id: string
  name: string
  description: string | null
  status: PosCampaignStatus
  priority: number
  startAt: string | null
  endAt: string | null
  color: string | null
  icon: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  effectivelyActive?: boolean
  linkedProductCount?: number
  linkedCategoryCount?: number
}

export interface CampaignAnalyticsRow {
  campaignId: string
  campaignName: string
  status: PosCampaignStatus
  orders: number
  revenue: number
  discountGiven: number
  averageTicket: number
  topProducts: Array<{ name: string; quantity: number; revenue: number }>
}

function toIsoDate(value: unknown): string | null {
  const d = parseOptionalDate(value)
  return d ? d.toISOString() : null
}

export function mapCampaignRow(row: Record<string, unknown>): PosDiscountCampaignDoc {
  return {
    _id: row._id,
    name: String(row.name ?? '').trim(),
    description: row.description != null ? String(row.description) : null,
    status: (row.status as PosCampaignStatus) || 'inactive',
    priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : 0,
    startAt: parseOptionalDate(row.startAt),
    endAt: parseOptionalDate(row.endAt),
    color: row.color != null ? String(row.color) : null,
    icon: row.icon != null ? String(row.icon) : null,
    createdBy: row.createdBy != null ? String(row.createdBy) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(),
  }
}

export function serializeCampaign(
  doc: Record<string, unknown>,
  extras?: { effectivelyActive?: boolean; linkedProductCount?: number; linkedCategoryCount?: number }
): PosDiscountCampaignPublic {
  return {
    id: String(doc._id),
    name: String(doc.name ?? ''),
    description: doc.description != null ? String(doc.description) : null,
    status: (doc.status as PosCampaignStatus) || 'inactive',
    priority: Number(doc.priority ?? 0),
    startAt: toIsoDate(doc.startAt),
    endAt: toIsoDate(doc.endAt),
    color: doc.color != null ? String(doc.color) : null,
    icon: doc.icon != null ? String(doc.icon) : null,
    createdBy: doc.createdBy != null ? String(doc.createdBy) : null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ''),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt ?? ''),
    ...extras,
  }
}

export async function ensureCampaignIndexes(db: Db): Promise<void> {
  const { POS_DISCOUNTS_COLLECTION, POS_CATEGORY_DISCOUNTS_COLLECTION } = await import(
    '@/lib/pos-discount-types'
  )
  try {
    await db.collection(POS_DISCOUNT_CAMPAIGNS_COLLECTION).createIndex({ status: 1, startAt: 1, endAt: 1 })
    await db.collection(POS_DISCOUNT_CAMPAIGNS_COLLECTION).createIndex({ priority: -1 })
    await db.collection(POS_DISCOUNTS_COLLECTION).createIndex({ campaignId: 1 })
    await db.collection(POS_CATEGORY_DISCOUNTS_COLLECTION).createIndex({ campaignId: 1 })
  } catch {
    /* exists */
  }
}

export async function loadCampaignsMap(db: Db): Promise<Map<string, PosDiscountCampaignDoc>> {
  const rows = await db.collection(POS_DISCOUNT_CAMPAIGNS_COLLECTION).find({}).toArray()
  const map = new Map<string, PosDiscountCampaignDoc>()
  for (const row of rows) {
    const mapped = mapCampaignRow(row)
    map.set(String(row._id), mapped)
  }
  return map
}

function attributeLineToCampaign(
  item: Record<string, unknown>,
  ctx: PosDiscountContext,
  productCategoryMap: Map<string, string>
): string | null {
  if (Number(item.posDiscountAmount ?? 0) <= 0) return null
  if (item.posCampaignId) return String(item.posCampaignId)

  const pid = item.productId != null ? String(item.productId) : item.skuId != null ? String(item.skuId) : null
  if (!pid) return null

  const productRule = ctx.productDiscounts.get(pid)
  if (productRule?.campaignId) {
    const camp = ctx.campaigns.get(productRule.campaignId)
    if (camp && isCampaignEffectivelyActive(camp, ctx.now)) return productRule.campaignId
  }

  const cat = productCategoryMap.get(pid)
  if (cat) {
    const catRule = ctx.categoryDiscounts.get(cat.toLowerCase())
    if (catRule?.campaignId) {
      const camp = ctx.campaigns.get(catRule.campaignId)
      if (camp && isCampaignEffectivelyActive(camp, ctx.now)) return catRule.campaignId
    }
  }
  return null
}

export async function computeCampaignAnalytics(
  db: Db,
  ctx: PosDiscountContext,
  rangeStart: Date,
  rangeEnd: Date
): Promise<CampaignAnalyticsRow[]> {
  const { ObjectId } = await import('mongodb')

  const orders = await db
    .collection('orders')
    .find({
      orderSource: { $in: ['pos', null] },
      timestamp: { $gte: rangeStart, $lt: rangeEnd },
      $or: [{ status: 'completed' }, { paymentStatus: 'PAID' }],
    })
    .project({ items: 1, total: 1 })
    .toArray()

  const productIds = new Set<string>()
  for (const o of orders) {
    for (const item of (o.items as Record<string, unknown>[]) ?? []) {
      const pid = item.productId ?? item.skuId
      if (pid) productIds.add(String(pid))
    }
  }

  const productCategoryMap = new Map<string, string>()
  const productNameMap = new Map<string, string>()
  const oids = [...productIds].filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id))
  if (oids.length > 0) {
    const products = await db
      .collection('bar_inventory')
      .find({ _id: { $in: oids } })
      .project({ name: 1, category: 1 })
      .toArray()
    for (const p of products) {
      const id = p._id.toString()
      productCategoryMap.set(id, String(p.category ?? ''))
      productNameMap.set(id, String(p.name ?? 'Product'))
    }
  }

  const stats = new Map<
    string,
    {
      orders: Set<string>
      revenue: number
      discountGiven: number
      products: Map<string, { name: string; quantity: number; revenue: number }>
    }
  >()

  for (const campaignId of ctx.campaigns.keys()) {
    stats.set(campaignId, { orders: new Set(), revenue: 0, discountGiven: 0, products: new Map() })
  }

  let orderIdx = 0
  for (const order of orders) {
    const orderId = String(order._id ?? orderIdx++)
    for (const raw of (order.items as Record<string, unknown>[]) ?? []) {
      const campaignId = attributeLineToCampaign(raw, ctx, productCategoryMap)
      if (!campaignId || !stats.has(campaignId)) continue

      const row = stats.get(campaignId)!
      row.orders.add(orderId)

      const qty = Number(raw.quantity ?? 1)
      const unit = Number(raw.price ?? 0)
      const disc = Number(raw.posDiscountAmount ?? 0)
      row.discountGiven += disc * qty
      row.revenue += unit * qty

      const pid = String(raw.productId ?? raw.skuId ?? '')
      const pname = productNameMap.get(pid) || String(raw.name ?? 'Product')
      const cur = row.products.get(pid) || { name: pname, quantity: 0, revenue: 0 }
      cur.quantity += qty
      cur.revenue += unit * qty
      row.products.set(pid, cur)
    }
  }

  const rows: CampaignAnalyticsRow[] = []
  for (const [campaignId, campaign] of ctx.campaigns) {
    const s = stats.get(campaignId)
    if (!s) continue
    const orderCount = s.orders.size
    const topProducts = [...s.products.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    rows.push({
      campaignId,
      campaignName: campaign.name,
      status: campaign.status,
      orders: orderCount,
      revenue: Math.round(s.revenue * 100) / 100,
      discountGiven: Math.round(s.discountGiven * 100) / 100,
      averageTicket: orderCount > 0 ? Math.round((s.revenue / orderCount) * 100) / 100 : 0,
      topProducts,
    })
  }

  return rows.sort((a, b) => b.discountGiven - a.discountGiven)
}

export function getPromotionDashboardStats(
  ctx: PosDiscountContext,
  todayOrders: Array<{ items?: Array<Record<string, unknown>>; timestamp?: Date | string }>,
  todayStart: Date,
  tomorrowStart: Date
) {
  const activeCampaigns = [...ctx.campaigns.values()].filter((c) =>
    isCampaignEffectivelyActive(c, ctx.now)
  )

  let bestCampaign: { id: string; name: string; discountGiven: number } | null = null
  const campaignDiscount = new Map<string, number>()

  for (const order of todayOrders) {
    const ts = order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp ?? 0)
    if (ts < todayStart || ts >= tomorrowStart) continue
    for (const item of order.items ?? []) {
      const disc = Number(item.posDiscountAmount ?? 0) * Number(item.quantity ?? 1)
      if (disc <= 0) continue
      const cid = item.posCampaignId ? String(item.posCampaignId) : null
      if (cid) {
        campaignDiscount.set(cid, (campaignDiscount.get(cid) ?? 0) + disc)
      }
    }
  }

  for (const [id, amount] of campaignDiscount) {
    const camp = ctx.campaigns.get(id)
    if (!camp) continue
    if (!bestCampaign || amount > bestCampaign.discountGiven) {
      bestCampaign = { id, name: camp.name, discountGiven: amount }
    }
  }

  return {
    activeCampaignCount: activeCampaigns.length,
    todayDiscountGiven: sumPosDiscountSavingsFromOrders(todayOrders, todayStart, tomorrowStart),
    bestPerformingCampaign: bestCampaign,
    activeCampaigns: [...ctx.campaigns.entries()]
      .filter(([, c]) => isCampaignEffectivelyActive(c, ctx.now))
      .map(([id, c]) => ({
        id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        endsAt: c.endAt?.toISOString() ?? null,
      })),
  }
}

export type CampaignInputPayload = {
  name: string
  description?: string | null
  status?: PosCampaignStatus
  priority?: number
  startAt?: string | null
  endAt?: string | null
  color?: string | null
  icon?: string | null
}

export function buildCampaignDocFields(
  input: CampaignInputPayload,
  staffEmail: string | null,
  now: Date
) {
  const status = input.status === 'archived' ? 'archived' : input.status === 'inactive' ? 'inactive' : 'active'
  return {
    name: String(input.name ?? '').trim(),
    description: input.description?.trim() || null,
    status: status as PosCampaignStatus,
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0,
    startAt: parseOptionalDate(input.startAt),
    endAt: parseOptionalDate(input.endAt),
    color: input.color?.trim() || null,
    icon: input.icon?.trim() || null,
    createdBy: staffEmail,
    updatedAt: now,
  }
}

export { formatDiscountLabel }
