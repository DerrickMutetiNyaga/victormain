import type { Db } from 'mongodb'

const COLLECTION = 'jaba_system_flags'
const LOCK_ID = 'batch_bulk_purge_lock'
const STALE_MS = 35 * 60 * 1000

/**
 * Serialize bulk purges across instances (best-effort). Stale locks (>35m) can be stolen.
 */
export async function acquireBulkBatchPurgeLock(
  db: Db,
  actorEmail: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - STALE_MS)

  try {
    const res = await db.collection(COLLECTION).findOneAndUpdate(
      {
        _id: LOCK_ID,
        $or: [{ locked: { $ne: true } }, { lockedAt: { $lte: staleBefore } }],
      },
      { $set: { locked: true, lockedAt: now, lockedBy: actorEmail } },
      { upsert: true, returnDocument: 'after' }
    )

    const doc = res.value as { locked?: boolean; lockedBy?: string } | null
    if (doc?.locked === true && doc.lockedBy === actorEmail) {
      return { ok: true }
    }
    return { ok: false, error: 'Could not acquire purge lock (try again shortly).' }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('E11000') || msg.includes('duplicate')) {
      const cur = await db.collection(COLLECTION).findOne({ _id: LOCK_ID })
      if (cur?.locked === true) {
        const at = cur.lockedAt instanceof Date ? cur.lockedAt : null
        if (at && now.getTime() - at.getTime() < STALE_MS) {
          return {
            ok: false,
            error: 'Another batch purge is in progress. Wait for it to finish or for the lock to expire (~35 min).',
          }
        }
      }
    }
    console.error('[bulk-purge-lock] acquire error:', e)
    return { ok: false, error: 'Lock error — try again.' }
  }
}

export async function releaseBulkBatchPurgeLock(db: Db): Promise<void> {
  await db.collection(COLLECTION).updateOne(
    { _id: LOCK_ID },
    { $set: { locked: false, releasedAt: new Date() } }
  )
}
