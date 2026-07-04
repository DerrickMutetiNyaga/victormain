/**
 * Global promotion conflict resolution settings (POS-only).
 */

import type { Db } from 'mongodb'

export const POS_PROMOTION_SETTINGS_COLLECTION = 'pos_promotion_settings'
export const SETTINGS_DOC_ID = 'global'

/** How to resolve multiple qualifying line-level promotions */
export type PromotionConflictMode =
  | 'never_stack'       // product beats category (legacy default)
  | 'best_discount'     // highest savings per line
  | 'highest_priority'  // highest campaign/rule priority wins
  | 'allow_stacking'    // stack product + category sequentially

export interface PosPromotionSettingsDoc {
  _id: string
  conflictMode: PromotionConflictMode
  updatedBy: string | null
  updatedAt: Date
}

export const DEFAULT_CONFLICT_MODE: PromotionConflictMode = 'never_stack'

export async function loadPromotionSettings(db: Db): Promise<PromotionConflictMode> {
  const doc = await db
    .collection<PosPromotionSettingsDoc>(POS_PROMOTION_SETTINGS_COLLECTION)
    .findOne({ _id: SETTINGS_DOC_ID })
  const mode = doc?.conflictMode
  if (
    mode === 'best_discount' ||
    mode === 'highest_priority' ||
    mode === 'allow_stacking' ||
    mode === 'never_stack'
  ) {
    return mode
  }
  return DEFAULT_CONFLICT_MODE
}

export async function savePromotionSettings(
  db: Db,
  conflictMode: PromotionConflictMode,
  updatedBy: string | null
): Promise<void> {
  await db.collection(POS_PROMOTION_SETTINGS_COLLECTION).updateOne(
    { _id: SETTINGS_DOC_ID },
    {
      $set: { conflictMode, updatedBy, updatedAt: new Date() },
      $setOnInsert: { _id: SETTINGS_DOC_ID },
    },
    { upsert: true }
  )
}

export async function ensurePromotionSettingsIndexes(db: Db): Promise<void> {
  try {
    await db.collection(POS_PROMOTION_SETTINGS_COLLECTION).createIndex({ _id: 1 }, { unique: true })
  } catch {
    /* exists */
  }
}

export const CONFLICT_MODE_LABELS: Record<PromotionConflictMode, string> = {
  never_stack: 'Never stack (product beats category)',
  best_discount: 'Apply best discount only',
  highest_priority: 'Highest priority wins',
  allow_stacking: 'Allow stacking',
}
