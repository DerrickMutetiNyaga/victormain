/**
 * Jaba batch model: neutral (parent) vs flavoured (child) batches.
 */

export const NEUTRAL_BATCH_DISPLAY_FLAVOR = "Neutral"

export type JabaBatchType = "neutral" | "flavoured"

export function normalizeBatchType(doc: {
  batchType?: string
  parentBatchId?: string | null
}): JabaBatchType {
  if (doc.parentBatchId) return "flavoured"
  if (doc.batchType === "flavoured") return "flavoured"
  if (doc.batchType === "neutral") return "neutral"
  // Legacy documents have no batchType — treat as neutral parent (may have flavour at creation)
  return "neutral"
}

/** Legacy: flavour chosen at batch creation (before neutral-first model). */
export function isLegacyFlavourFirstBatch(doc: {
  batchType?: string
  parentBatchId?: string | null
  flavor?: string
}): boolean {
  if (doc.parentBatchId) return false
  if (doc.batchType === "neutral" || doc.batchType === "flavoured") return false
  const f = (doc.flavor || "").trim()
  if (!f) return false
  if (f.toLowerCase() === NEUTRAL_BATCH_DISPLAY_FLAVOR.toLowerCase()) return false
  return true
}

export function getInfusedAllocated(batch: { infusedAllocatedLitres?: number }): number {
  return Math.max(0, Number(batch.infusedAllocatedLitres) || 0)
}

/** Produced neutral volume (after processing). Uses totalLitres as produced amount. */
export function getNeutralProducedLitres(batch: { totalLitres?: number; status?: string }): number {
  return Math.max(0, Number(batch.totalLitres) || 0)
}

/** Remaining neutral litres available to allocate to flavour outputs. */
export function getNeutralRemainingLitres(batch: {
  totalLitres?: number
  infusedAllocatedLitres?: number
  status?: string
  batchType?: string
  parentBatchId?: string | null
}): number {
  if (batch.parentBatchId || normalizeBatchType(batch) === "flavoured") return 0
  const produced = getNeutralProducedLitres(batch)
  const allocated = getInfusedAllocated(batch)
  return Math.max(0, produced - allocated)
}

export function childBatchNumberSuffix(parentNumber: string, index: number): string {
  return `${parentNumber}-F${String(index).padStart(2, "0")}`
}
