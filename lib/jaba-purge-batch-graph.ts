import { ObjectId, type Db } from 'mongodb'
import { JABA_FLAVOUR_LINES_COLLECTION } from '@/lib/jaba-flavour-lines'
import {
  JABA_PURGE_MONGODB_TRANSACTIONS_REQUIRED_CODE,
  type JabaPurgeErrorCode,
} from '@/lib/jaba-purge-constants'

function normalizeQty(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '0'))
  return Number.isFinite(n) ? n : 0
}

/** Escape user/data-derived strings used inside RegExp constructors. */
function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export type PurgeJabaBatchRootResult =
  | { ok: true; deletedCount: number; batchNumber: string | null }
  | { ok: false; notFound: true }
  | { ok: false; error: string; code?: JabaPurgeErrorCode }

/**
 * Delete one root (or legacy) batch graph: child batches, flavour lines, packaging outputs,
 * delivery note line items, inventory movements, then batch documents. Restores raw/packaging stock.
 * Runs in a single MongoDB transaction per root so a mid-flight error rolls back all writes for that root.
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

  let outcome: PurgeJabaBatchRootResult = { ok: false, error: 'Purge did not complete' }

  try {
    await session.withTransaction(
      async () => {
        const batch = await db
          .collection('jaba_batches')
          .findOne({ _id: new ObjectId(id) }, { session })
        if (!batch) {
          outcome = { ok: false, notFound: true }
          return
        }

        const batchIdsToDelete = new Set<string>([id])
        const batchNumbersToDelete = new Set<string>([String(batch.batchNumber || '')])
        const flavourLineIdsToDelete = new Set<string>()

        if (!batch.parentBatchId) {
          // One level of children only; deeper chains are out of scope for this helper.
          const legacyChildren = await db
            .collection('jaba_batches')
            .find({ parentBatchId: id }, { session })
            .toArray()
          for (const child of legacyChildren) {
            batchIdsToDelete.add(String(child._id))
            batchNumbersToDelete.add(String(child.batchNumber || ''))
          }
          const lines = await db
            .collection(JABA_FLAVOUR_LINES_COLLECTION)
            .find({ parentBatchId: id }, { session })
            .project({ _id: 1 })
            .toArray()
          for (const line of lines) {
            flavourLineIdsToDelete.add(String(line._id))
          }
        }

        const batchDocsToDelete = await db
          .collection('jaba_batches')
          .find({ _id: { $in: Array.from(batchIdsToDelete).map((x) => new ObjectId(x)) } }, { session })
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
                  { session }
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
              { session }
            )
            if (!material) continue
            await rawMaterialsCollection.updateOne(
              { _id: material._id },
              { $inc: { currentStock: quantity }, $set: { updatedAt: new Date() } },
              { session }
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
          .find({ $or: packagingOr }, { session })
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
                { session }
              )
            } catch {
              // invalid ObjectId — skip this line
            }
          }
        }

        if (packagingOutputsToDelete.length > 0) {
          await db.collection('jaba_packagingOutput').deleteMany(
            { _id: { $in: packagingOutputsToDelete.map((d) => d._id) } },
            { session }
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
          const notes = await db
            .collection('jaba_deliveryNotes')
            .find({ $or: noteOr }, { session })
            .toArray()
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
              await db.collection('jaba_deliveryNotes').deleteOne({ _id: note._id }, { session })
            } else {
              const nextTotalCost = keptItems.reduce((sum: number, it: Record<string, unknown>) => {
                const explicit = Number(it.totalCost)
                if (!Number.isNaN(explicit) && explicit > 0) return sum + explicit
                return sum + ((Number(it.quantity) || 0) * (Number(it.pricePerUnit) || 0))
              }, 0)
              await db.collection('jaba_deliveryNotes').updateOne(
                { _id: note._id },
                { $set: { items: keptItems, totalCost: nextTotalCost, updatedAt: new Date() } },
                { session }
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
          { session }
        )

        if (!batch.parentBatchId) {
          await db
            .collection(JABA_FLAVOUR_LINES_COLLECTION)
            .deleteMany({ parentBatchId: id }, { session })
        }

        const result = await db.collection('jaba_batches').deleteMany(
          {
            _id: { $in: Array.from(batchIdsToDelete).map((x) => new ObjectId(x)) },
          },
          { session }
        )

        if (result.deletedCount === 0) {
          throw new Error('Batch rows were not deleted')
        }

        outcome = {
          ok: true,
          deletedCount: result.deletedCount,
          batchNumber: batch.batchNumber != null ? String(batch.batchNumber) : null,
        }
      },
      {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority', wtimeoutMS: 60_000 },
      }
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/Transaction numbers are only allowed on a replica set member|replica set|transactions.+not supported|IllegalOperation/i.test(msg)) {
      return {
        ok: false,
        error:
          'Batch purge requires MongoDB replica set transactions. Use a replica set (e.g. Atlas) or enable transactions on your deployment.',
        code: JABA_PURGE_MONGODB_TRANSACTIONS_REQUIRED_CODE,
      }
    }
    if (outcome.ok === false && 'notFound' in outcome && outcome.notFound) {
      return outcome
    }
    return { ok: false, error: msg || 'Batch purge failed' }
  } finally {
    await session.endSession()
  }

  return outcome
}
