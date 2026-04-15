import type { MongoClient } from 'mongodb'
import {
  JABA_FLAVOUR_LINES_COLLECTION,
  sumPackagedLitresForFlavourLine,
} from '@/lib/jaba-flavour-lines'
import {
  findPrimaryBottleMaterialForSize,
  findPrimaryStickerMaterialForSize,
  normalizeFlavourLabel,
} from '@/lib/jaba-packaging-materials'
import {
  normalizeQty,
  getTotalContainerUnits,
  computePackagedLitresFromContainers,
} from '@/lib/jaba-packaging-calculations'

export class PackagingApiError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

type PackingMaterialLineRow = {
  flavourName: string
  containerSize: string
  customSizeMl?: string
  quantityPacked: number
  stickersUsed: number
  stickerMaterialId: string
  stickerMaterialName: string
  bottleMaterialId: string
  bottleMaterialName: string
  bottlesUsed: number
}

type PreparedFlavourLine = {
  flavourLineId: string
  flavourLineDoc: Record<string, unknown>
  packagedLitres: number
  volumeAllocated: number
  containers: unknown[]
  packingMaterialLines: PackingMaterialLineRow[]
  materialsUsed: Array<Record<string, unknown>>
  resolvedFlavourName: string
  defects: number
  defectReasons: string
  machineEfficiency: number | undefined
  packagingDataBase: Record<string, unknown>
}

function mergeReqMap(
  into: Map<string, { doc: any; units: number }>,
  from: Map<string, { doc: any; units: number }>
) {
  for (const [id, v] of from) {
    const ex = into.get(id)
    if (ex) ex.units += v.units
    else into.set(id, { doc: v.doc, units: v.units })
  }
}

function buildSizeSpecMap(containers: unknown[]) {
  const sizeSpecToUnits = new Map<
    string,
    {
      size: string
      customSize?: string
      units: number
    }
  >()
  for (const c of containers || []) {
    const units = normalizeQty((c as any)?.quantity)
    if (units <= 0) continue
    const size = String((c as any).size || '')
    const customSize = (c as any).customSize ? String((c as any).customSize) : undefined
    const specKey = size === 'custom' ? `custom:${customSize ?? ''}` : size
    const existing = sizeSpecToUnits.get(specKey)
    if (existing) existing.units += units
    else sizeSpecToUnits.set(specKey, { size, customSize, units })
  }
  return sizeSpecToUnits
}

/**
 * One API save creates N `jaba_packagingOutput` documents (one per flavour line) in a single transaction,
 * with combined bottle/sticker validation and a shared package number + session group id.
 */
export async function executeMultiFlavourPackagingTransaction(params: {
  client: MongoClient
  db: any
  ObjectId: typeof import('mongodb').ObjectId
  batchId: string
  batchNumber: string
  finalPackageNumber: string
  packagingDate: string | Date
  supervisor: string
  teamMembers: unknown
  safetyChecks: boolean
  batch: Record<string, unknown>
  lineInputs: Array<Record<string, unknown>>
}): Promise<{
  createdIds: string[]
  packagingDocs: Record<string, unknown>[]
  sessionGroupId: string
  totalLitresPacked: number
  remainingByFlavourLineId: Record<string, number>
}> {
  const {
    client,
    db,
    ObjectId,
    batchId,
    batchNumber,
    finalPackageNumber,
    packagingDate,
    supervisor,
    teamMembers,
    safetyChecks,
    batch,
    lineInputs,
  } = params

  const rawMaterialsCollection = db.collection('jaba_rawMaterials')
  const mongoSession = client.startSession()

  const year =
    packagingDate instanceof Date
      ? packagingDate.getFullYear()
      : new Date(packagingDate).getFullYear() || new Date().getFullYear()

  const fmtSize = (size: string, customSize?: string) => (size === 'custom' ? `${customSize ?? ''}ml` : size)

  let createdIds: string[] = []
  let packagingDocs: Record<string, unknown>[] = []
  let sessionGroupIdOut = ''
  let totalLitresPacked = 0
  let remainingByFlavourLineId: Record<string, number> = {}

  try {
    await mongoSession.withTransaction(async () => {
      const existingCount = await db
        .collection('jaba_packagingOutput')
        .countDocuments({ batchId: String(batchId) }, { session: mongoSession })

      const sessionGroupId = new ObjectId()
      sessionGroupIdOut = sessionGroupId.toString()

      const globalBottleReq = new Map<string, { doc: any; units: number }>()
      const globalStickerReq = new Map<string, { doc: any; units: number }>()

      const prepared: PreparedFlavourLine[] = []
      const seenLineIds = new Set<string>()

      for (const raw of lineInputs) {
        const flavourLineId =
          typeof raw.flavourLineId === 'string' && raw.flavourLineId.trim()
            ? raw.flavourLineId.trim()
            : ''
        if (!flavourLineId) {
          throw new PackagingApiError('Each packaging line must include a flavourLineId.', 400)
        }
        if (seenLineIds.has(flavourLineId)) {
          throw new PackagingApiError('Duplicate flavour line in the same packaging session.', 400)
        }
        seenLineIds.add(flavourLineId)

        const containers = Array.isArray(raw.containers) ? raw.containers : []
        for (const c of containers) {
          if (normalizeQty((c as any)?.quantity) < 0) {
            throw new PackagingApiError('Container quantities cannot be negative.', 400)
          }
        }

        const packagedLitres =
          raw.totalPackedLitres != null && raw.totalPackedLitres !== ''
            ? Number(raw.totalPackedLitres)
            : computePackagedLitresFromContainers(containers as any[])
        const allocatedVolume = Number(raw.volumeAllocated) || 0

        if (allocatedVolume <= 0) {
          throw new PackagingApiError('Each line must have volume allocated greater than 0.', 400)
        }
        if (packagedLitres <= 0) {
          throw new PackagingApiError('Each selected flavour line must pack a positive volume.', 400)
        }
        if (packagedLitres > allocatedVolume + 1e-6) {
          throw new PackagingApiError(
            `Packed litres (${packagedLitres.toFixed(2)}L) cannot exceed allocated volume (${allocatedVolume.toFixed(2)}L) for a flavour line.`,
            400
          )
        }

        if (getTotalContainerUnits(containers as any[]) <= 0) {
          throw new PackagingApiError('Each flavour line with packed volume needs at least one container quantity.', 400)
        }

        const flavourLineDoc = (await db
          .collection(JABA_FLAVOUR_LINES_COLLECTION)
          .findOne({ _id: new ObjectId(flavourLineId) }, { session: mongoSession })) as Record<string, unknown> | null

        if (!flavourLineDoc) {
          throw new PackagingApiError('Flavour line not found', 404)
        }
        if (String(flavourLineDoc.parentBatchId) !== String(batchId)) {
          throw new PackagingApiError('Flavour line does not belong to this batch', 400)
        }

        const priorOutputs = await db
          .collection('jaba_packagingOutput')
          .find({ flavourLineId }, { session: mongoSession })
          .toArray()
        const priorLitres = sumPackagedLitresForFlavourLine(priorOutputs, { flavourLineId })
        const alloc = Number(flavourLineDoc.allocatedLitres) || 0
        if (priorLitres + packagedLitres > alloc + 1e-6) {
          throw new PackagingApiError(
            `Packaging would exceed flavour line "${String(flavourLineDoc.flavourName || '')}" allocation (${alloc.toFixed(2)}L). Already packaged ${priorLitres.toFixed(2)}L, session adds ${packagedLitres.toFixed(2)}L.`,
            400
          )
        }

        const resolvedFlavourName = normalizeFlavourLabel(
          String(flavourLineDoc.flavourName || flavourLineDoc.flavor || batch.flavourName || batch.flavor || batch.flavour || '')
        )
        const stickerMustMatchFlavour = resolvedFlavourName.length > 0

        const sizeSpecToUnits = buildSizeSpecMap(containers)
        if (sizeSpecToUnits.size === 0) {
          throw new PackagingApiError(
            `No positive container quantities for flavour line "${resolvedFlavourName || flavourLineId}".`,
            400
          )
        }

        const lineBottleReq = new Map<string, { doc: any; units: number }>()
        const lineStickerReq = new Map<string, { doc: any; units: number }>()
        const packingMaterialLines: PackingMaterialLineRow[] = []

        for (const spec of sizeSpecToUnits.values()) {
          const [bottleMaterial, stickerMaterial] = await Promise.all([
            findPrimaryBottleMaterialForSize(rawMaterialsCollection, {
              size: spec.size,
              customSize: spec.customSize,
              session: mongoSession,
            }),
            findPrimaryStickerMaterialForSize(rawMaterialsCollection, {
              size: spec.size,
              customSize: spec.customSize,
              flavourName: resolvedFlavourName || undefined,
              requireFlavorSpecific: stickerMustMatchFlavour,
              session: mongoSession,
            }),
          ])

          if (!bottleMaterial) {
            throw new PackagingApiError(
              `No bottle raw material found for size ${fmtSize(spec.size, spec.customSize)}. Add an item like "250ml Bottles", "500ml Bottles", "1L Bottles", "2L Bottles" in Raw Materials.`,
              400
            )
          }
          if (!stickerMaterial) {
            const hint = stickerMustMatchFlavour
              ? ` For flavour "${resolvedFlavourName}", create a Packaging raw material such as "${fmtSize(spec.size, spec.customSize)} ${resolvedFlavourName} Stickers" (or set field packagingStickerFlavor on the sticker row).`
              : ` Add an item like "${fmtSize(spec.size, spec.customSize)} Stickers" or "Labels" in Raw Materials before packaging.`
            throw new PackagingApiError(
              `No sticker raw material found for size ${fmtSize(spec.size, spec.customSize)}.${hint}`,
              400
            )
          }

          const bottleId = String(bottleMaterial._id)
          const stickerId = String(stickerMaterial._id)

          const eb = lineBottleReq.get(bottleId)
          if (eb) eb.units += spec.units
          else lineBottleReq.set(bottleId, { doc: bottleMaterial, units: spec.units })

          const es = lineStickerReq.get(stickerId)
          if (es) es.units += spec.units
          else lineStickerReq.set(stickerId, { doc: stickerMaterial, units: spec.units })

          packingMaterialLines.push({
            flavourName: resolvedFlavourName || String(batch.flavor || batch.flavour || '—'),
            containerSize: spec.size,
            customSizeMl: spec.size === 'custom' ? spec.customSize : undefined,
            quantityPacked: spec.units,
            stickersUsed: spec.units,
            stickerMaterialId: stickerId,
            stickerMaterialName: String(stickerMaterial.name || 'Stickers'),
            bottleMaterialId: bottleId,
            bottleMaterialName: String(bottleMaterial.name || 'Bottles'),
            bottlesUsed: spec.units,
          })
        }

        mergeReqMap(globalBottleReq, lineBottleReq)
        mergeReqMap(globalStickerReq, lineStickerReq)

        const materialsUsed: any[] = []
        for (const [materialId, req] of lineBottleReq.entries()) {
          materialsUsed.push({
            materialId,
            name: String(req.doc.name || 'Bottles'),
            type: 'bottles',
            quantity: req.units,
            flavourName: resolvedFlavourName || undefined,
          })
        }
        for (const [materialId, req] of lineStickerReq.entries()) {
          materialsUsed.push({
            materialId,
            name: String(req.doc.name || 'Stickers'),
            type: 'stickers',
            quantity: req.units,
            flavourName: resolvedFlavourName || undefined,
          })
        }

        const packagingDataBase: Record<string, unknown> = {
          batchId,
          batchNumber: batchNumber.trim(),
          packageNumber: finalPackageNumber.trim(),
          volumeAllocated: allocatedVolume,
          packagedLitres: packagedLitres,
          packagingDate: new Date(packagingDate as any),
          supervisor: supervisor.trim(),
          teamMembers: teamMembers || [],
          containers,
          defects: Number(raw.defects) || 0,
          defectReasons: typeof raw.defectReasons === 'string' ? raw.defectReasons.trim() : '',
          machineEfficiency: raw.machineEfficiency ? Number(raw.machineEfficiency) : undefined,
          safetyChecks: safetyChecks || false,
          createdAt: new Date(),
          flavourLineId,
          flavourName: String(flavourLineDoc.flavourName || ''),
          materialsUsed,
          packingMaterialLines,
          packedFlavourName: resolvedFlavourName || undefined,
          packagingSessionGroupId: sessionGroupIdOut,
        }

        prepared.push({
          flavourLineId,
          flavourLineDoc,
          packagedLitres,
          volumeAllocated: allocatedVolume,
          containers,
          packingMaterialLines,
          materialsUsed,
          resolvedFlavourName,
          defects: Number(raw.defects) || 0,
          defectReasons: typeof raw.defectReasons === 'string' ? raw.defectReasons.trim() : '',
          machineEfficiency: raw.machineEfficiency ? Number(raw.machineEfficiency) : undefined,
          packagingDataBase,
        })
      }

      for (const req of globalBottleReq.values()) {
        const stock = Number(req.doc.currentStock) || 0
        if (stock < req.units) {
          throw new PackagingApiError(
            `Insufficient bottle stock (combined session): need ${req.units.toLocaleString()}, available ${stock.toLocaleString()} (${String(
              req.doc.name || 'bottles'
            )}).`,
            400
          )
        }
      }
      for (const req of globalStickerReq.values()) {
        const stock = Number(req.doc.currentStock) || 0
        if (stock < req.units) {
          throw new PackagingApiError(
            `Insufficient sticker stock (combined session): need ${req.units.toLocaleString()}, available ${stock.toLocaleString()} (${String(
              req.doc.name || 'stickers'
            )}).`,
            400
          )
        }
      }

      const txBatch = await db
        .collection('jaba_batches')
        .findOne({ _id: new ObjectId(batchId) }, { session: mongoSession })
      if (!txBatch) throw new PackagingApiError('Batch not found', 404)

      let lineIdx = 0
      const insertedPackagingIds: string[] = []
      const insertedDocs: Record<string, unknown>[] = []

      for (const p of prepared) {
        lineIdx += 1
        const txLine = await db
          .collection(JABA_FLAVOUR_LINES_COLLECTION)
          .findOne({ _id: new ObjectId(p.flavourLineId) }, { session: mongoSession })
        if (!txLine) throw new PackagingApiError('Flavour line not found', 404)
        const txPriorOutputs = await db
          .collection('jaba_packagingOutput')
          .find({ flavourLineId: p.flavourLineId }, { session: mongoSession })
          .toArray()
        const txPriorLitres = sumPackagedLitresForFlavourLine(txPriorOutputs, { flavourLineId: p.flavourLineId })
        const txAlloc = Number(txLine.allocatedLitres) || 0
        if (txPriorLitres + p.packagedLitres > txAlloc + 1e-6) {
          throw new PackagingApiError(
            `Packaging would exceed this flavour line allocation (${txAlloc.toFixed(2)}L). Already packaged ${txPriorLitres.toFixed(2)}L, session adds ${p.packagedLitres.toFixed(2)}L.`,
            400
          )
        }
        const remainingLine = Math.max(0, txAlloc - txPriorLitres - p.packagedLitres)
        remainingByFlavourLineId[p.flavourLineId] = remainingLine

        const packagingLineLabel = `${year}-${String(batchNumber).trim()}-L${String(existingCount + lineIdx).padStart(2, '0')}`
        const packagingData = {
          ...p.packagingDataBase,
          packagingLine: packagingLineLabel,
          packagingSessionLineIndex: lineIdx,
        }

        const packagingInsert = await db.collection('jaba_packagingOutput').insertOne(packagingData, { session: mongoSession })
        const cid = packagingInsert.insertedId.toString()
        insertedPackagingIds.push(cid)
        insertedDocs.push({ ...packagingData, _id: cid })
      }

      createdIds = insertedPackagingIds
      packagingDocs = insertedDocs

      for (const [_, req] of globalBottleReq.entries()) {
        const qty = req.units
        const bottleDeduct = await rawMaterialsCollection.updateOne(
          { _id: req.doc._id, currentStock: { $gte: qty } },
          { $inc: { currentStock: -qty }, $set: { updatedAt: new Date() } },
          { session: mongoSession }
        )
        if (bottleDeduct.modifiedCount !== 1) {
          throw new PackagingApiError('Raw material stock changed during packaging. Please refresh and try again.', 409)
        }
      }

      for (const [_, req] of globalStickerReq.entries()) {
        const qty = req.units
        const stickerDeduct = await rawMaterialsCollection.updateOne(
          { _id: req.doc._id, currentStock: { $gte: qty } },
          { $inc: { currentStock: -qty }, $set: { updatedAt: new Date() } },
          { session: mongoSession }
        )
        if (stickerDeduct.modifiedCount !== 1) {
          throw new PackagingApiError('Raw material stock changed during packaging. Please refresh and try again.', 409)
        }
      }

      const packagingMovementTs = new Date()
      const packagingMovementDocs: Record<string, unknown>[] = []
      const primaryPackagingOutputId = insertedPackagingIds[0] || ''

      const pushPackagingMovement = (req: { doc: any; units: number }, materialType: 'bottles' | 'stickers') => {
        const qty = req.units
        const before = Number(req.doc.currentStock) || 0
        packagingMovementDocs.push({
          type: 'DEDUCTION',
          reason: 'PACKAGING',
          batchId,
          batchNumber: String(batchNumber).trim(),
          packagingOutputId: primaryPackagingOutputId,
          packagingSessionGroupId: sessionGroupIdOut,
          packagingOutputIds: insertedPackagingIds,
          multiFlavourSession: insertedPackagingIds.length > 1,
          packageNumber: finalPackageNumber.trim(),
          materialType,
          materialId: String(req.doc._id),
          materialName: String(req.doc.name || materialType),
          quantity: qty,
          unit: String(req.doc.unit || 'pcs'),
          beforeStock: before,
          afterStock: before - qty,
          userId: 'system',
          timestamp: packagingMovementTs,
          createdAt: packagingMovementTs,
        })
      }
      for (const req of globalBottleReq.values()) pushPackagingMovement(req, 'bottles')
      for (const req of globalStickerReq.values()) pushPackagingMovement(req, 'stickers')
      if (packagingMovementDocs.length > 0) {
        await db.collection('jaba_inventory_movements').insertMany(packagingMovementDocs, { session: mongoSession })
      }

      let bottleAdds = 0
      let sumLitres = 0
      for (const p of prepared) {
        bottleAdds += (p.containers as any[]).reduce(
          (sum: number, c: any) => sum + Math.max(0, parseFloat(c.quantity) || 0),
          0
        )
        sumLitres += p.packagedLitres
      }
      totalLitresPacked = sumLitres

      let add250 = 0
      let add500 = 0
      let add1 = 0
      let add2 = 0
      for (const p of prepared) {
        for (const container of p.containers as any[]) {
          const qty = Math.max(0, parseFloat(container.quantity) || 0)
          if (container.size === '250ml') add250 += qty
          else if (container.size === '500ml') add500 += qty
          else if (container.size === '1L') add1 += qty
          else if (container.size === '2L') add2 += qty
        }
      }

      const updateData: Record<string, unknown> = {
        'outputSummary.totalBottles': (txBatch.outputSummary?.totalBottles || 0) + bottleAdds,
        updatedAt: new Date(),
      }

      if (add250 > 0) updateData.bottles250ml = (txBatch.bottles250ml || 0) + add250
      if (add500 > 0) updateData.bottles500ml = (txBatch.bottles500ml || 0) + add500
      if (add1 > 0) updateData.bottles1L = (txBatch.bottles1L || 0) + add1
      if (add2 > 0) updateData.bottles2L = (txBatch.bottles2L || 0) + add2

      if (
        txBatch.status === 'QC Passed - Ready for Packaging' ||
        txBatch.status === 'Ready for Packaging' ||
        txBatch.status === 'Partially Allocated' ||
        txBatch.status === 'Fully Allocated'
      ) {
        updateData.status = 'Partially Packaged'
      }

      await db.collection('jaba_batches').updateOne(
        { _id: new ObjectId(batchId) },
        { $set: updateData },
        { session: mongoSession }
      )
    })
  } finally {
    await mongoSession.endSession()
  }

  return {
    createdIds,
    packagingDocs,
    sessionGroupId: sessionGroupIdOut,
    totalLitresPacked,
    remainingByFlavourLineId,
  }
}
