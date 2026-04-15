/**
 * Flavour lines: sub-rows under one parent jaba batch (not separate batch documents).
 * Legacy child batches in jaba_batches are still merged in API responses for old data.
 */

import type { Db, Document } from "mongodb"

export const JABA_FLAVOUR_LINES_COLLECTION = "jaba_batch_flavour_lines"

export type JabaFlavourLineWorkflowStatus =
  | "Allocated"
  | "Infusing"
  | "Partially Packaged"
  | "Packaged"
  | "Partially Distributed"
  | "Fully Distributed"

export function bottleRowToLitres(qty: number, size: string): number {
  const q = Number(qty) || 0
  if (size === "500ml") return q * 0.5
  if (size === "1L") return q * 1
  if (size === "2L") return q * 2
  return 0
}

/** Packaging tied to a flavour line (new model) or to a legacy child batch id. */
export function sumPackagedLitresForFlavourLine(
  packagingOutputs: Document[],
  opts: { flavourLineId: string; legacyChildBatchId?: string }
): number {
  let sum = 0
  const fid = opts.flavourLineId
  const legacy = opts.legacyChildBatchId
  for (const po of packagingOutputs) {
    const poF = po.flavourLineId != null ? String(po.flavourLineId) : ""
    const matchNew = poF === fid
    const matchLegacy =
      !!legacy &&
      !poF &&
      String(po.batchId || "") === legacy
    if (!matchNew && !matchLegacy) continue
    const containers = po.containers
    if (!containers || !Array.isArray(containers)) continue
    for (const c of containers) {
      sum += bottleRowToLitres(parseFloat(c.quantity) || 0, c.size || "500ml")
    }
  }
  return sum
}

export function sumDistributedLitresForFlavourLine(
  deliveryNotes: Document[],
  opts: { flavourLineId: string; legacyBatchNumber?: string }
): number {
  let sum = 0
  const fid = opts.flavourLineId
  const legacyBn = opts.legacyBatchNumber
  for (const note of deliveryNotes) {
    const items = note.items
    if (!items || !Array.isArray(items)) continue
    for (const item of items) {
      const itemF = item.flavourLineId != null ? String(item.flavourLineId) : ""
      const matchNew = itemF === fid
      const matchLegacy =
        !!legacyBn &&
        !itemF &&
        String(item.batchNumber || "") === legacyBn
      if (!matchNew && !matchLegacy) continue
      sum += bottleRowToLitres(parseFloat(item.quantity) || 0, item.size || "500ml")
    }
  }
  return sum
}

export function deriveFlavourLineWorkflowStatus(
  allocated: number,
  packaged: number,
  distributed: number,
  manualInfusing?: boolean | null
): JabaFlavourLineWorkflowStatus {
  const a = Math.max(0, Number(allocated) || 0)
  const p = Math.max(0, Number(packaged) || 0)
  const d = Math.max(0, Number(distributed) || 0)
  if (p <= 1e-6) {
    if (manualInfusing) return "Infusing"
    return "Allocated"
  }
  if (p + 1e-6 < a) return "Partially Packaged"
  if (d <= 1e-6) return "Packaged"
  if (d + 1e-6 < p) return "Partially Distributed"
  return "Fully Distributed"
}

const PARENT_ALLOC_STATUSES = new Set([
  "Processed",
  "Ready for Infusion",
  "Partially Infused",
  "Fully Infused",
  "Ready for flavour allocation",
  "Partially Allocated",
  "Fully Allocated",
])

export function parentStatusAfterFlavourAllocation(
  prevStatus: string,
  neutralRemainingLitres: number,
  totalAllocatedLitres: number
): string {
  if (!PARENT_ALLOC_STATUSES.has(prevStatus)) return prevStatus
  const n = neutralRemainingLitres
  const a = totalAllocatedLitres
  // All volume unallocated again (e.g. removed last flavour line)
  if (a <= 1e-6 && n > 1e-6) return "Ready for flavour allocation"
  if (n <= 1e-6) return "Fully Allocated"
  if (a > 1e-6) return "Partially Allocated"
  return "Ready for flavour allocation"
}

export function mapLegacyParentStatusToDisplay(status: string): string {
  switch (status) {
    case "Partially Infused":
      return "Partially Allocated"
    case "Fully Infused":
      return "Fully Allocated"
    case "Ready for Infusion":
      return "Ready for flavour allocation"
    default:
      return status
  }
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

export interface EnrichedFlavourRow {
  _id: string
  id: string
  parentBatchId: string
  lineCode: string
  flavor: string
  flavourName: string
  allocatedLitres: number
  packagedLitres: number
  distributedLitres: number
  remainingPackLitres: number
  remainingDistributeLitres: number
  status: string
  workflowStatus: JabaFlavourLineWorkflowStatus
  infusionDate?: string
  notes?: string | null
  isLegacyChildBatch: boolean
  /** Present only for legacy rows — child batch document id */
  legacyChildBatchId?: string
}

export function buildEnrichedFlavourRow(
  base: {
    _id: string
    parentBatchId: string
    lineCode: string
    flavourName: string
    allocatedLitres: number
    infusionDate?: Date | string
    notes?: string | null
    isLegacyChildBatch: boolean
    legacyChildBatchId?: string
    legacyBatchNumber?: string
    manualInfusing?: boolean | null
    createdAt?: Date
  },
  packagingOutputs: Document[],
  deliveryNotes: Document[]
): EnrichedFlavourRow {
  const id = base._id
  const packagedLitres = sumPackagedLitresForFlavourLine(packagingOutputs, {
    flavourLineId: id,
    legacyChildBatchId: base.legacyChildBatchId,
  })
  const distributedLitres = sumDistributedLitresForFlavourLine(deliveryNotes, {
    flavourLineId: id,
    legacyBatchNumber: base.legacyBatchNumber,
  })
  const alloc = Math.max(0, Number(base.allocatedLitres) || 0)
  const remainingPackLitres = Math.max(0, alloc - packagedLitres)
  const remainingDistributeLitres = Math.max(0, packagedLitres - distributedLitres)
  const workflowStatus = deriveFlavourLineWorkflowStatus(
    alloc,
    packagedLitres,
    distributedLitres,
    base.manualInfusing
  )
  const row: EnrichedFlavourRow & { createdAt?: string } = {
    _id: id,
    id,
    parentBatchId: base.parentBatchId,
    lineCode: base.lineCode,
    flavor: base.flavourName,
    flavourName: base.flavourName,
    allocatedLitres: alloc,
    packagedLitres,
    distributedLitres,
    remainingPackLitres,
    remainingDistributeLitres,
    status: workflowStatus,
    workflowStatus,
    infusionDate:
      base.infusionDate instanceof Date
        ? base.infusionDate.toISOString()
        : base.infusionDate,
    notes: base.notes ?? null,
    isLegacyChildBatch: base.isLegacyChildBatch,
    legacyChildBatchId: base.legacyChildBatchId,
  }
  if (base.createdAt instanceof Date) {
    ;(row as any).createdAt = base.createdAt.toISOString()
  }
  return row as EnrichedFlavourRow
}

/** Bottle units available to distribute for one flavour row (packaged − distributed). */
export function countAvailableBottlesForFlavourRow(
  row: EnrichedFlavourRow,
  packagingOutputs: Document[],
  deliveryNotes: Document[]
): number {
  let p500 = 0
  let p1 = 0
  let p2 = 0
  for (const po of packagingOutputs) {
    if (row.isLegacyChildBatch) {
      const bid = row.legacyChildBatchId || row._id
      if (String(po.batchId || "") !== bid || po.flavourLineId) continue
    } else {
      if (String(po.flavourLineId || "") !== row._id) continue
    }
    const containers = po.containers
    if (!containers || !Array.isArray(containers)) continue
    for (const c of containers) {
      const qty = parseFloat(c.quantity) || 0
      if (c.size === "500ml") p500 += qty
      else if (c.size === "1L") p1 += qty
      else if (c.size === "2L") p2 += qty
    }
  }

  let d500 = 0
  let d1 = 0
  let d2 = 0
  const legacyBn = row.isLegacyChildBatch ? row.lineCode : undefined
  for (const note of deliveryNotes) {
    const items = note.items
    if (!items || !Array.isArray(items)) continue
    for (const item of items) {
      const itemF = item.flavourLineId != null ? String(item.flavourLineId) : ""
      const matchNew = !row.isLegacyChildBatch && itemF === row._id
      const matchLegacy =
        row.isLegacyChildBatch &&
        !itemF &&
        legacyBn &&
        String(item.batchNumber || "") === legacyBn
      if (!matchNew && !matchLegacy) continue
      const qty = parseFloat(item.quantity) || 0
      if (item.size === "500ml") d500 += qty
      else if (item.size === "1L") d1 += qty
      else if (item.size === "2L") d2 += qty
    }
  }

  return (
    Math.max(0, p500 - d500) + Math.max(0, p1 - d1) + Math.max(0, p2 - d2)
  )
}

export function mergeFlavourRowsFromCaches(
  parentId: string,
  lineDocs: Document[],
  legacyChildDocs: Document[],
  packagingOutputs: Document[],
  deliveryNotes: Document[]
): EnrichedFlavourRow[] {
  const byCreated = (a: Document, b: Document) => {
    const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
    const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
    return ta - tb
  }
  const sortedLines = [...lineDocs].sort(byCreated)
  const sortedLegacy = [...legacyChildDocs].sort(byCreated)

  const out: (EnrichedFlavourRow & { sortAt: number })[] = []

  for (const doc of sortedLines) {
    const id = doc._id.toString()
    const t = doc.createdAt instanceof Date ? doc.createdAt.getTime() : 0
    const manualInfusing = doc.status === "Infusing"
    out.push(
      Object.assign(
        buildEnrichedFlavourRow(
          {
            _id: id,
            parentBatchId: parentId,
            lineCode: String(doc.lineCode || ""),
            flavourName: String(doc.flavourName || ""),
            allocatedLitres: Number(doc.allocatedLitres) || 0,
            infusionDate: doc.infusionDate,
            notes: doc.notes,
            isLegacyChildBatch: false,
            manualInfusing,
            createdAt: doc.createdAt instanceof Date ? doc.createdAt : undefined,
          },
          packagingOutputs,
          deliveryNotes
        ),
        { sortAt: t }
      )
    )
  }

  for (const child of sortedLegacy) {
    const id = child._id.toString()
    const bn = String(child.batchNumber || "")
    const alloc = Number(child.infusedQuantityLitres ?? child.totalLitres) || 0
    const t = child.createdAt instanceof Date ? child.createdAt.getTime() : 0
    out.push(
      Object.assign(
        buildEnrichedFlavourRow(
          {
            _id: id,
            parentBatchId: parentId,
            lineCode: bn,
            flavourName: String(child.flavor || "Unknown"),
            allocatedLitres: alloc,
            infusionDate: child.infusionDate,
            notes: child.notes,
            isLegacyChildBatch: true,
            legacyChildBatchId: id,
            legacyBatchNumber: bn,
            manualInfusing: null,
            createdAt: child.createdAt instanceof Date ? child.createdAt : undefined,
          },
          packagingOutputs,
          deliveryNotes
        ),
        { sortAt: t }
      )
    )
  }

  out.sort((a, b) => a.sortAt - b.sortAt)
  return out.map(({ sortAt: _s, ...row }) => row) as EnrichedFlavourRow[]
}

export async function loadMergedFlavourRowsForParent(
  db: Db,
  parentId: string,
  packagingOutputs: Document[],
  deliveryNotes: Document[]
): Promise<EnrichedFlavourRow[]> {
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
