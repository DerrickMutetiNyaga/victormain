import { ObjectId, type ClientSession, type Db } from 'mongodb'
import { JABA_FLAVOUR_LINES_COLLECTION } from '@/lib/jaba-flavour-lines'
import type { JabaPurgeErrorCode } from '@/lib/jaba-purge-constants'

function normalizeQty(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '0'))
  return Number.isFinite(n) ? n : 0
}

/** Escape user/data-derived strings used inside RegExp constructors. */
function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function mongoSessionOpts(session: ClientSession | undefined): { session?: ClientSession } {
  return session ? { session } : {}
}

function isMongoTransactionUnavailableError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  if (
    /Transaction numbers are only allowed on a replica set member|replica set|transactions.+not supported|IllegalOperation|transaction.*not supported|commands against non-replica|mongos.*transaction|multi-document transactions are not supported/i.test(
      msg
    )
  ) {
    return true
  }
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const code = (e as { code?: unknown }).code
    if (code === 20) return true
  }
  return false
}

export type PurgeJabaBatchRootResult =
  | { ok: true; deletedCount: number; batchNumber: string | null }
  | { ok: false; notFound: true }
  | { ok: false; error: string; code?: JabaPurgeErrorCode }

/**
 * Delete one root (or legacy) batch graph: child batches, flavour lines, packaging outputs,
 * delivery note line items, inventory movements, then batch documents. Restores raw/packaging stock.
 *
 * On replica sets, runs in a single MongoDB transaction per root so a mid-flight error rolls back
 * all writes for that root. On standalone / non-transaction deployments, automatically retries the
 * same steps without a transaction (best-effort; a crash mid-purge can leave partial state).
 *
 * Packaging stock is refunded only from persisted `materialsUsed` on each output row (atomic $inc).
 * Legacy rows without `materialsUsed` are still deleted but do not infer bottle/sticker materials (avoids wrong refunds).
 *
 * Mirrors app/api/jaba/batches/[id] DELETE.
 */
export async function purgeJabaBatchGraphByRootId(db: Db, id: string): Promise<PurgeJabaBatchRootResult> {
  if (!id || !ObjectId.isValid(id)) {
    return { ok: false, error: 'Invalid batch id' }
  }

  const mongoClient = db.client
  const session = mongoClient.startSession()
  let skipEndSessionInFinally = false

  let outcome: PurgeJabaBatchRootResult = { ok: false, error: 'Purge did not complete' }

  try {
    try {
      await session.withTransaction(
        async () => {
          const r = await purgeJabaBatchGraphCore(db, id, session)
          if (r.ok === false && 'notFound' in r && r.notFound) {
            outcome = r
            return
          }
          if (!r.ok) {
            throw new Error('error' in r ? r.error : 'Batch purge failed')
          }
          outcome = r
        },
        {
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority', wtimeoutMS: 60_000 },
        }
      )
    } catch (e: unknown) {
      if (isMongoTransactionUnavailableError(e)) {
        await session.endSession()
        skipEndSessionInFinally = true
        outcome = await purgeJabaBatchGraphCore(db, id, undefined)
        return outcome
      }
      const msg = e instanceof Error ? e.message : String(e)
      if (outcome.ok === false && 'notFound' in outcome && outcome.notFound) {
        return outcome
      }
      return { ok: false, error: msg || 'Batch purge failed' }
    }

    return outcome
  } finally {
    if (!skipEndSessionInFinally) {
      await session.endSession()
    }
  }
}

async function purgeJabaBatchGraphCore(
  db: Db,
  id: string,
  session: ClientSession | undefined
): Promise<PurgeJabaBatchRootResult> {
  const s = mongoSessionOpts(session)

  const batch = await db.collection('jaba_batches').findOne({ _id: new ObjectId(id) }, s)
  if (!batch) {
    return { ok: false, notFound: true }
  }

  const batchIdsToDelete = new Set<string>([id])
  const batchNumbersToDelete = new Set<string>([String(batch.batchNumber || '')])
  const flavourLineIdsToDelete = new Set<string>()

  if (!batch.parentBatchId) {
    const legacyChildren = await db
      .collection('jaba_batches')
      .find({ parentBatchId: id }, s)
      .toArray()
    for (const child of legacyChildren) {
      batchIdsToDelete.add(String(child._id))
      batchNumbersToDelete.add(String(child.batchNumber || ''))
    }
    const lines = await db
      .collection(JABA_FLAVOUR_LINES_COLLECTION)
      .find({ parentBatchId: id }, s)
      .project({ _id: 1 })
      .toArray()
    for (const line of lines) {
      flavourLineIdsToDelete.add(String(line._id))
    }
  }

  const batchDocsToDelete = await db
    .collection('jaba_batches')
    .find({ _id: { $in: Array.from(batchIdsToDelete).map((x) => new ObjectId(x)) } }, s)
    .toArray()

  const rawMaterialsCollection = db.collection('jaba_rawMaterials')

  for (const b of batchDocsToDelete) {
    if (!b.ingredients || !Array.isArray(b.ingredients) || b.ingredients.length === 0) continue
    for (const ingredient of b.ingredients) {
      const materialName = ingredient.material
      const quantity = Number(ingredient.quantity)
      if (!materialName || quantity <= 0) continue

      let refunded = false
      if (ingredient.materialId) {
        try {
          const ur = await rawMaterialsCollection.updateOne(
            { _id: new ObjectId(ingredient.materialId) },
            { $inc: { currentStock: quantity }, $set: { updatedAt: new Date() } },
            s
          )
          refunded = ur.matchedCount > 0
        } catch {
          refunded = false
        }
      }
      if (refunded) continue

      const escaped = escapeRegexLiteral(String(materialName))
      const material = await rawMaterialsCollection.findOne(
        { name: { $regex: new RegExp(`^${escaped}$`, 'i') } },
        s
      )
      if (!material) continue
      await rawMaterialsCollection.updateOne(
        { _id: material._id },
        { $inc: { currentStock: quantity }, $set: { updatedAt: new Date() } },
        s
      )
    }
  }

  const packagingOr: Record<string, unknown>[] = [
    { batchId: { $in: Array.from(batchIdsToDelete) } },
    { batchNumber: { $in: Array.from(batchNumbersToDelete).filter(Boolean) } },
  ]
  if (flavourLineIdsToDelete.size > 0) {
    packagingOr.push({ flavourLineId: { $in: Array.from(flavourLineIdsToDelete) } })
  }
  const packagingOutputsToDelete = await db
    .collection('jaba_packagingOutput')
    .find({ $or: packagingOr }, s)
    .toArray()

  for (const po of packagingOutputsToDelete) {
    const raw = po as unknown as { materialsUsed?: unknown }
    const materialsUsed = Array.isArray(raw.materialsUsed)
      ? (raw.materialsUsed as { materialId?: unknown; quantity?: unknown }[])
      : []
    for (const materialUse of materialsUsed) {
      const qty = normalizeQty(materialUse.quantity)
      if (!materialUse.materialId || qty <= 0) continue
      try {
        await rawMaterialsCollection.updateOne(
          { _id: new ObjectId(String(materialUse.materialId)) },
          { $inc: { currentStock: qty }, $set: { updatedAt: new Date() } },
          s
        )
      } catch {
        // invalid ObjectId — skip this line
      }
    }
  }

  if (packagingOutputsToDelete.length > 0) {
    await db.collection('jaba_packagingOutput').deleteMany(
      { _id: { $in: packagingOutputsToDelete.map((d) => d._id) } },
      s
    )
  }

  const linkedBatchNumbers = Array.from(batchNumbersToDelete).filter(Boolean)
  const linkedFlavourLineIds = Array.from(flavourLineIdsToDelete)
  const noteOr: Record<string, unknown>[] = []
  if (linkedBatchNumbers.length > 0) {
    noteOr.push({ items: { $elemMatch: { batchNumber: { $in: linkedBatchNumbers } } } })
  }
  if (linkedFlavourLineIds.length > 0) {
    noteOr.push({ items: { $elemMatch: { flavourLineId: { $in: linkedFlavourLineIds } } } })
  }

  if (noteOr.length > 0) {
    const notes = await db.collection('jaba_deliveryNotes').find({ $or: noteOr }, s).toArray()
    const linkedBatchSet = new Set(linkedBatchNumbers)
    const linkedFlSet = new Set(linkedFlavourLineIds)

    for (const note of notes) {
      const items = Array.isArray(note.items) ? note.items : []
      const keptItems = items.filter((item: { batchNumber?: unknown; flavourLineId?: unknown }) => {
        const itemBatch = String(item?.batchNumber || '')
        const itemFl = String(item?.flavourLineId || '')
        return !linkedBatchSet.has(itemBatch) && !(itemFl && linkedFlSet.has(itemFl))
      })
      if (keptItems.length === items.length) continue

      if (keptItems.length === 0) {
        await db.collection('jaba_deliveryNotes').deleteOne({ _id: note._id }, s)
      } else {
        const nextTotalCost = keptItems.reduce((sum: number, it: Record<string, unknown>) => {
          const explicit = Number(it.totalCost)
          if (!Number.isNaN(explicit) && explicit > 0) return sum + explicit
          return sum + ((Number(it.quantity) || 0) * (Number(it.pricePerUnit) || 0))
        }, 0)
        await db.collection('jaba_deliveryNotes').updateOne(
          { _id: note._id },
          { $set: { items: keptItems, totalCost: nextTotalCost, updatedAt: new Date() } },
          s
        )
      }
    }
  }

  await db.collection('jaba_inventory_movements').deleteMany(
    {
      $or: [
        { batchId: { $in: Array.from(batchIdsToDelete) } },
        { batchNumber: { $in: Array.from(batchNumbersToDelete).filter(Boolean) } },
      ],
    },
    s
  )

  if (!batch.parentBatchId) {
    await db.collection(JABA_FLAVOUR_LINES_COLLECTION).deleteMany({ parentBatchId: id }, s)
  }

  const result = await db.collection('jaba_batches').deleteMany(
    {
      _id: { $in: Array.from(batchIdsToDelete).map((x) => new ObjectId(x)) },
    },
    s
  )

  if (result.deletedCount === 0) {
    return { ok: false, error: 'Batch rows were not deleted' }
  }

  return {
    ok: true,
    deletedCount: result.deletedCount,
    batchNumber: batch.batchNumber != null ? String(batch.batchNumber) : null,
  }
}
