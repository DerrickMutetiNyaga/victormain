import type { Db } from "mongodb"
import { ObjectId } from "mongodb"
import {
  JABA_FLAVOUR_LINES_COLLECTION,
  normalizeFlavourNameForMatch,
  parentStatusAfterFlavourAllocation,
} from "@/lib/jaba-flavour-lines"
import { findExistingFlavourLineForParent, nextFlavourLineCode } from "@/lib/jaba-flavour-lines-server"

export type FlavourAllocationInput = {
  flavorId?: string | null
  flavorName: string
  quantityLitres: number
  notes?: string | null
  status?: string
}

export type AllocateFlavourLinesResult = {
  /** Newly inserted flavour line documents */
  created: Array<Record<string, unknown> & { _id: string; id: string }>
  /** Existing lines that received additional allocated litres */
  updated: Array<Record<string, unknown> & { _id: string; id: string }>
  newAllocated: number
  newRemaining: number
  nextStatus: string
  infusionAllocationStatus: "full" | "partial"
  totalNew: number
}

const LITRE_EPS = 1e-9

export function roundLitres(n: number): number {
  return Math.round((Number(n) + LITRE_EPS) * 1e6) / 1e6
}

function toStoredFlavourId(raw: string | null | undefined): string | ObjectId | null {
  if (!raw || !String(raw).trim()) return null
  const s = String(raw).trim()
  if (ObjectId.isValid(s)) return new ObjectId(s)
  return s
}

/**
 * Merge duplicate flavours in a single allocation request (same flavourId or same normalized name).
 */
export function groupMergeAllocationOutputs(outputs: FlavourAllocationInput[]): FlavourAllocationInput[] {
  const map = new Map<string, FlavourAllocationInput>()
  for (const raw of outputs) {
    const name = (raw.flavorName || "").trim()
    if (!name) continue
    const qty = Math.max(0, Number(raw.quantityLitres) || 0)
    if (qty <= 0) continue
    const fid = raw.flavorId && String(raw.flavorId).trim() ? String(raw.flavorId).trim() : ""
    const key = fid ? `id:${fid}` : `name:${normalizeFlavourNameForMatch(name)}`
    const cur = map.get(key)
    if (!cur) {
      map.set(key, {
        ...raw,
        flavorName: name,
        quantityLitres: roundLitres(qty),
      })
    } else {
      cur.quantityLitres = roundLitres(Math.max(0, Number(cur.quantityLitres) || 0) + qty)
      const a = cur.notes?.toString().trim()
      const b = raw.notes?.toString().trim()
      if (b) {
        cur.notes = a ? `${a} | ${b}` : b
      }
    }
  }
  return Array.from(map.values())
}

type LineUpdateSnapshot = {
  _id: ObjectId
  allocatedLitres: number
  notes: unknown
  flavourId: unknown
  infusionDate: unknown
  updatedAt: unknown
  status: unknown
}

/**
 * Inserts or updates flavour line documents, updates parent neutral batch allocation fields,
 * and logs NEUTRAL_INFUSED — same behaviour as POST /api/jaba/batches/[id]/infuse.
 * Re-infusion for an existing flavour merges into the same line (batch + flavourId or normalized name).
 *
 * On failure after any insert: deletes only the line documents inserted in this call.
 * On failure after any update: reverts those lines using snapshots taken before update.
 * If the parent batch was updated but the NEUTRAL_INFUSED movement insert fails,
 * parent allocation fields are reverted to the snapshot taken at entry.
 */
export async function allocateFlavourLinesToParent(
  db: Db,
  parentId: string,
  parent: {
    batchNumber?: string
    totalLitres?: number
    infusedAllocatedLitres?: number
    status?: string
    outputSummary?: { remainingLitres?: number }
    infusionAllocationStatus?: string
  },
  outputs: FlavourAllocationInput[],
  infusionDate: Date
): Promise<AllocateFlavourLinesResult> {
  const positive = outputs.filter((o) => Math.max(0, Number(o.quantityLitres) || 0) > 0)
  const grouped = groupMergeAllocationOutputs(positive)
  const totalNew = grouped.reduce((sum, o) => sum + Math.max(0, Number(o.quantityLitres) || 0), 0)
  if (totalNew <= 0) {
    throw new Error("Each output must have quantityLitres > 0")
  }

  for (const o of grouped) {
    const name = (o.flavorName || "").trim()
    if (!name) {
      throw new Error("Each output needs a flavor name")
    }
  }

  const prevInfused = Number(parent.infusedAllocatedLitres) || 0
  const produced = Number(parent.totalLitres) || 0
  const prevRemaining =
    parent.outputSummary != null &&
    typeof parent.outputSummary === "object" &&
    (parent.outputSummary as { remainingLitres?: unknown }).remainingLitres != null
      ? Math.max(
          0,
          Number((parent.outputSummary as { remainingLitres?: number }).remainingLitres) || 0
        )
      : Math.max(0, produced - prevInfused)
  const prevStatus = String(parent.status ?? "")
  const prevAllocStatus = String(parent.infusionAllocationStatus ?? "none")

  const batchNumber = String(parent.batchNumber || "")
  const created: Array<Record<string, unknown> & { _id: string; id: string }> = []
  const updated: Array<Record<string, unknown> & { _id: string; id: string }> = []
  const insertedIds: ObjectId[] = []
  const updateSnapshots: LineUpdateSnapshot[] = []
  let parentWasUpdated = false

  try {
    for (const o of grouped) {
      const qty = Math.max(0, Number(o.quantityLitres) || 0)
      const flavorName = o.flavorName.trim()
      const existing = await findExistingFlavourLineForParent(db, parentId, o.flavorId, flavorName)

      if (existing) {
        updateSnapshots.push({
          _id: existing._id as ObjectId,
          allocatedLitres: Number(existing.allocatedLitres) || 0,
          notes: existing.notes ?? null,
          flavourId: existing.flavourId ?? null,
          infusionDate: existing.infusionDate,
          updatedAt: existing.updatedAt,
          status: existing.status,
        })

        const prevAllocated = Number(existing.allocatedLitres) || 0
        const newAllocatedLine = roundLitres(prevAllocated + qty)

        const setDoc: Record<string, unknown> = {
          allocatedLitres: newAllocatedLine,
          updatedAt: new Date(),
          infusionDate,
        }

        const storedIncoming = toStoredFlavourId(o.flavorId)
        if (storedIncoming != null && (existing.flavourId == null || existing.flavourId === "")) {
          setDoc.flavourId = storedIncoming
        }

        if (o.notes?.trim()) {
          const prev = existing.notes ? String(existing.notes) : ""
          setDoc.notes = prev ? `${prev} | ${o.notes.trim()}` : o.notes.trim()
        }

        if (o.status === "Infusing") {
          setDoc.status = "Infusing"
        }

        await db.collection(JABA_FLAVOUR_LINES_COLLECTION).updateOne({ _id: existing._id }, { $set: setDoc })

        const refreshed = await db.collection(JABA_FLAVOUR_LINES_COLLECTION).findOne({ _id: existing._id })
        if (refreshed) {
          const idStr = refreshed._id.toString()
          updated.push({
            ...refreshed,
            _id: idStr,
            id: idStr,
          } as Record<string, unknown> & { _id: string; id: string })
        }
      } else {
        const lineCode = await nextFlavourLineCode(db, batchNumber, parentId)

        const lineDoc = {
          parentBatchId: parentId,
          flavourName: flavorName,
          flavourId: toStoredFlavourId(o.flavorId),
          allocatedLitres: qty,
          lineCode,
          status: o.status === "Infusing" ? "Infusing" : "Allocated",
          infusionDate,
          notes: o.notes?.trim() || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        const ins = await db.collection(JABA_FLAVOUR_LINES_COLLECTION).insertOne(lineDoc)
        insertedIds.push(ins.insertedId)
        const idStr = ins.insertedId.toString()
        created.push({
          ...lineDoc,
          _id: idStr,
          id: idStr,
        })
      }
    }

    const newAllocated = roundLitres(prevInfused + totalNew)
    const newRemaining = Math.max(0, roundLitres(produced - newAllocated))

    const infusionAllocationStatus: "full" | "partial" = newRemaining <= 1e-6 ? "full" : "partial"
    const nextStatus = parentStatusAfterFlavourAllocation(prevStatus, newRemaining, newAllocated)

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
    parentWasUpdated = true

    const allLineIds = [...created.map((c) => c._id), ...updated.map((u) => u._id)]

    await db.collection("jaba_inventory_movements").insertOne({
      type: "TRANSFER",
      reason: "NEUTRAL_INFUSED",
      batchId: parentId,
      batchNumber: parent.batchNumber,
      materialName: "Neutral batch → flavour lines",
      quantity: totalNew,
      unit: "L",
      metadata: {
        flavourLineIds: allLineIds,
        mergedIntoExisting: updated.length,
        newlyCreatedLines: created.length,
      },
      userId: "system",
      timestamp: new Date(),
      createdAt: new Date(),
    })

    return {
      created,
      updated,
      newAllocated,
      newRemaining,
      nextStatus,
      infusionAllocationStatus,
      totalNew,
    }
  } catch (err) {
    if (insertedIds.length > 0) {
      await db.collection(JABA_FLAVOUR_LINES_COLLECTION).deleteMany({
        _id: { $in: insertedIds },
      })
    }
    for (const snap of [...updateSnapshots].reverse()) {
      await db.collection(JABA_FLAVOUR_LINES_COLLECTION).updateOne(
        { _id: snap._id },
        {
          $set: {
            allocatedLitres: snap.allocatedLitres,
            notes: snap.notes,
            flavourId: snap.flavourId,
            infusionDate: snap.infusionDate,
            updatedAt: snap.updatedAt,
            status: snap.status,
          },
        }
      )
    }
    if (parentWasUpdated) {
      await db.collection("jaba_batches").updateOne(
        { _id: new ObjectId(parentId) },
        {
          $set: {
            infusedAllocatedLitres: prevInfused,
            "outputSummary.remainingLitres": prevRemaining,
            infusionAllocationStatus: prevAllocStatus,
            status: prevStatus,
            updatedAt: new Date(),
          },
        }
      )
    }
    throw err
  }
}
