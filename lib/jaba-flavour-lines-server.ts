/**
 * Server-only flavour line DB helpers (uses mongodb driver — do not import from Client Components).
 */

import type { Db, Document, WithId } from "mongodb"
import { ObjectId } from "mongodb"
import {
  JABA_FLAVOUR_LINES_COLLECTION,
  mergeFlavourRowsFromCaches,
  normalizeFlavourNameForMatch,
} from "@/lib/jaba-flavour-lines"

function flavourIdsEqual(a: unknown, b: string): boolean {
  if (a == null || b == null) return false
  const sa = String(a)
  const sb = String(b)
  if (sa === sb) return true
  if (ObjectId.isValid(sa) && ObjectId.isValid(sb)) {
    try {
      return new ObjectId(sa).equals(new ObjectId(sb))
    } catch {
      return false
    }
  }
  return false
}

/**
 * Find an existing flavour line document when allocating more volume to the same flavour.
 * Prefers flavourId (catalog id) when provided; otherwise matches normalized flavour name.
 * When flavourId is set on the request, does not merge into a line that already has a different catalogue id.
 */
export async function findExistingFlavourLineForParent(
  db: Db,
  parentId: string,
  flavorId: string | null | undefined,
  flavorName: string
): Promise<WithId<Document> | null> {
  const coll = db.collection(JABA_FLAVOUR_LINES_COLLECTION)
  const nameNorm = normalizeFlavourNameForMatch(flavorName)
  const lines = await coll.find({ parentBatchId: parentId }).toArray()

  const fid = flavorId && String(flavorId).trim() ? String(flavorId).trim() : ""

  if (fid) {
    for (const line of lines) {
      if (flavourIdsEqual(line.flavourId, fid)) return line as WithId<Document>
    }
    for (const line of lines) {
      const n = normalizeFlavourNameForMatch(String(line.flavourName || ""))
      if (n !== nameNorm) continue
      const lineHasId = line.flavourId != null && String(line.flavourId).trim() !== ""
      if (!lineHasId) return line as WithId<Document>
    }
    return null
  }

  for (const line of lines) {
    const n = normalizeFlavourNameForMatch(String(line.flavourName || ""))
    if (n === nameNorm) return line as WithId<Document>
  }
  return null
}

export async function nextFlavourLineCode(db: Db, parentBatchNumber: string, parentBatchId: string): Promise<string> {
  const n =
    (await db.collection(JABA_FLAVOUR_LINES_COLLECTION).countDocuments({
      parentBatchId,
    })) +
    (await db.collection("jaba_batches").countDocuments({
      parentBatchId,
      batchType: "flavoured",
    }))
  return `${parentBatchNumber}-F${String(n + 1).padStart(2, "0")}`
}

export async function loadMergedFlavourRowsForParent(
  db: Db,
  parentId: string,
  packagingOutputs: Document[],
  deliveryNotes: Document[]
) {
  const lines = await db
    .collection(JABA_FLAVOUR_LINES_COLLECTION)
    .find({ parentBatchId: parentId })
    .sort({ createdAt: 1 })
    .toArray()

  const legacyKids = await db
    .collection("jaba_batches")
    .find({ parentBatchId: parentId, batchType: "flavoured" })
    .sort({ createdAt: 1 })
    .toArray()

  return mergeFlavourRowsFromCaches(parentId, lines, legacyKids, packagingOutputs, deliveryNotes)
}
