/**
 * One-click campaign overrides — disable a campaign for a specific day.
 */

import type { Db } from 'mongodb'
import { parseOptionalDate } from '@/lib/pos-product-discounts'

export const POS_CAMPAIGN_OVERRIDES_COLLECTION = 'pos_campaign_overrides'

export interface PosCampaignOverrideDoc {
  _id?: unknown
  campaignId: string
  /** Calendar date key YYYY-MM-DD (local venue day) */
  dateKey: string
  reason: string
  createdBy: string | null
  createdAt: Date
}

export function dateKeyForNow(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function ensureCampaignOverrideIndexes(db: Db): Promise<void> {
  try {
    await db
      .collection(POS_CAMPAIGN_OVERRIDES_COLLECTION)
      .createIndex({ campaignId: 1, dateKey: 1 }, { unique: true })
    await db.collection(POS_CAMPAIGN_OVERRIDES_COLLECTION).createIndex({ dateKey: 1 })
  } catch {
    /* exists */
  }
}

export async function loadDisabledCampaignIdsForDate(
  db: Db,
  dateKey: string
): Promise<Set<string>> {
  const rows = await db
    .collection(POS_CAMPAIGN_OVERRIDES_COLLECTION)
    .find({ dateKey })
    .project({ campaignId: 1 })
    .toArray()
  return new Set(rows.map((r) => String(r.campaignId)))
}

export async function createCampaignOverride(
  db: Db,
  opts: { campaignId: string; dateKey?: string; reason: string; createdBy: string | null }
): Promise<PosCampaignOverrideDoc> {
  const dateKey = opts.dateKey ?? dateKeyForNow()
  const doc: PosCampaignOverrideDoc = {
    campaignId: opts.campaignId,
    dateKey,
    reason: opts.reason.trim() || 'Manual override',
    createdBy: opts.createdBy,
    createdAt: new Date(),
  }
  await db.collection(POS_CAMPAIGN_OVERRIDES_COLLECTION).updateOne(
    { campaignId: opts.campaignId, dateKey },
    { $set: doc },
    { upsert: true }
  )
  return doc
}

export async function removeCampaignOverride(
  db: Db,
  campaignId: string,
  dateKey: string
): Promise<void> {
  await db.collection(POS_CAMPAIGN_OVERRIDES_COLLECTION).deleteOne({ campaignId, dateKey })
}

export function serializeCampaignOverride(doc: Record<string, unknown>) {
  return {
    id: String(doc._id),
    campaignId: String(doc.campaignId),
    dateKey: String(doc.dateKey),
    reason: String(doc.reason ?? ''),
    createdBy: doc.createdBy != null ? String(doc.createdBy) : null,
    createdAt:
      doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ''),
  }
}
