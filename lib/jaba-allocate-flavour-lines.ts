import type { Db } from "mongodb"
import { ObjectId } from "mongodb"
import {
  JABA_FLAVOUR_LINES_COLLECTION,
  nextFlavourLineCode,
  parentStatusAfterFlavourAllocation,
} from "@/lib/jaba-flavour-lines"

export type FlavourAllocationInput = {
  flavorId?: string | null
  flavorName: string
  quantityLitres: number
  notes?: string | null
  status?: string
}

export type AllocateFlavourLinesResult = {
  created: Array<Record<string, unknown> & { _id: string; id: string }>
  newAllocated: number
  newRemaining: number
  nextStatus: string
  infusionAllocationStatus: "full" | "partial"
  totalNew: number
}

/**
 * Inserts flavour line documents, updates parent neutral batch allocation fields,
 * and logs NEUTRAL_INFUSED — same behaviour as POST /api/jaba/batches/[id]/infuse.
 * Call only after validating parent state and remaining volume (caller responsibility).
 */
export async function allocateFlavourLinesToParent(
  db: Db,
  parentId: string,
  parent: {
    batchNumber?: string
    totalLitres?: number
    infusedAllocatedLitres?: number
    status?: string
  },
  outputs: FlavourAllocationInput[],
  infusionDate: Date
): Promise<AllocateFlavourLinesResult> {
  const positive = outputs.filter((o) => Math.max(0, Number(o.quantityLitres) || 0) > 0)
  const totalNew = positive.reduce((sum, o) => sum + Math.max(0, Number(o.quantityLitres) || 0), 0)
  if (totalNew <= 0) {
    throw new Error("Each output must have quantityLitres > 0")
  }

  for (const o of positive) {
    const name = (o.flavorName || "").trim()
    if (!name) {
      throw new Error("Each output needs a flavor name")
    }
  }

  const batchNumber = String(parent.batchNumber || "")
  const created: Array<Record<string, unknown> & { _id: string; id: string }> = []

  for (const o of positive) {
    const qty = Math.max(0, Number(o.quantityLitres) || 0)
    const flavorName = o.flavorName.trim()
    const lineCode = await nextFlavourLineCode(db, batchNumber, parentId)

    const lineDoc = {
      parentBatchId: parentId,
      flavourName: flavorName,
      flavourId: o.flavorId || null,
      allocatedLitres: qty,
      lineCode,
      status: o.status === "Infusing" ? "Infusing" : "Allocated",
      infusionDate,
      notes: o.notes?.trim() || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const ins = await db.collection(JABA_FLAVOUR_LINES_COLLECTION).insertOne(lineDoc)
    const idStr = ins.insertedId.toString()
    created.push({
      ...lineDoc,
      _id: idStr,
      id: idStr,
    })
  }

  const newAllocated = (Number(parent.infusedAllocatedLitres) || 0) + totalNew
  const produced = Number(parent.totalLitres) || 0
  const newRemaining = Math.max(0, produced - newAllocated)

  const infusionAllocationStatus: "full" | "partial" = newRemaining <= 1e-6 ? "full" : "partial"
  const nextStatus = parentStatusAfterFlavourAllocation(String(parent.status), newRemaining, newAllocated)

  await db.collection("jaba_batches").updateOne(
    { _id: new ObjectId(parentId) },
    {
      $set: {
        infusedAllocatedLitres: newAllocated,
        "outputSummary.remainingLitres": newRemaining,
        infusionAllocationStatus,
        status: nextStatus,
        updatedAt: new Date(),
      },
    }
  )

  await db.collection("jaba_inventory_movements").insertOne({
    type: "TRANSFER",
    reason: "NEUTRAL_INFUSED",
    batchId: parentId,
    batchNumber: parent.batchNumber,
    materialName: "Neutral batch → flavour lines",
    quantity: totalNew,
    unit: "L",
    metadata: { flavourLineIds: created.map((c) => c._id) },
    userId: "system",
    timestamp: new Date(),
    createdAt: new Date(),
  })

  return {
    created,
    newAllocated,
    newRemaining,
    nextStatus,
    infusionAllocationStatus,
    totalNew,
  }
}
