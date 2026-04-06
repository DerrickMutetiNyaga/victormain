import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireJabaAction } from '@/lib/api-jaba-permissions'
import {
  JABA_FLAVOUR_LINES_COLLECTION,
  sumPackagedLitresForFlavourLine,
} from '@/lib/jaba-flavour-lines'
import {
  findPrimaryPackagingMaterials,
  findPrimaryBottleMaterialForSize,
  findPrimaryStickerMaterialForSize,
} from '@/lib/jaba-packaging-materials'

export const runtime = 'nodejs'

function normalizeQty(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '0'))
  return Number.isFinite(n) ? n : 0
}

function getTotalContainerUnits(containers: Array<{ quantity?: string | number }>): number {
  return containers.reduce((sum, c) => sum + normalizeQty(c.quantity), 0)
}

class ApiError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

// POST create packaging output
export async function POST(request: Request) {
  const authResult = await requireJabaAction('production.packaging', 'add')
  if ('response' in authResult) return authResult.response

  try {
    const body = await request.json()
    const {
      batchId,
      batchNumber,
      packageNumber,
      volumeAllocated,
      packagingDate,
      packagingLine,
      supervisor,
      teamMembers,
      containers,
      totalPackedLitres,
      defects,
      defectReasons,
      machineEfficiency,
      safetyChecks,
      flavourLineId: flavourLineIdRaw,
    } = body

    const flavourLineId =
      typeof flavourLineIdRaw === 'string' && flavourLineIdRaw.trim() ? flavourLineIdRaw.trim() : ''

    // Validate required fields
    if (!batchId || !batchNumber || !volumeAllocated || !packagingDate || !supervisor || !packagingLine) {
      return NextResponse.json(
        { error: 'Missing required fields: batchId, batchNumber, packageNumber, volumeAllocated, packagingDate, packagingLine, and supervisor are required' },
        { status: 400 }
      )
    }

    // Generate package number if not provided
    const finalPackageNumber = packageNumber || (() => {
      const currentYear = new Date().getFullYear()
      const randomNum = String(Math.floor(Math.random() * 99999)).padStart(5, "0")
      return `PKG-${currentYear}-${randomNum}`
    })()

    console.log('[Packaging Output API] Creating packaging session for batch:', batchNumber)
    console.log('[Packaging Output API] Package number received:', packageNumber)
    console.log('[Packaging Output API] Final package number to save:', finalPackageNumber)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Get batch to calculate remaining litres
    const batch = await db.collection('jaba_batches').findOne({ _id: new ObjectId(batchId) })
    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    for (const c of containers || []) {
      if (normalizeQty((c as any)?.quantity) < 0) {
        return NextResponse.json({ error: 'Container quantities cannot be negative.' }, { status: 400 })
      }
    }

    // Calculate packaged litres from containers
    const packagedLitres = totalPackedLitres || containers.reduce((sum: number, container: any) => {
      const qty = parseFloat(container.quantity) || 0
      if (container.size === "250ml") {
        return sum + (qty * 0.25)
      } else if (container.size === "500ml") {
        return sum + (qty * 0.5)
      } else if (container.size === "1L") {
        return sum + (qty * 1)
      } else if (container.size === "2L") {
        return sum + (qty * 2)
      } else if (container.customSize) {
        const customSize = parseFloat(container.customSize) || 0
        return sum + (qty * (customSize / 1000))
      }
      return sum
    }, 0)
    const allocatedVolume = Number(volumeAllocated) || 0
    if (allocatedVolume <= 0) {
      return NextResponse.json({ error: 'Volume allocated must be greater than 0.' }, { status: 400 })
    }
    if (packagedLitres <= 0) {
      return NextResponse.json({ error: 'Packed litres must be greater than 0.' }, { status: 400 })
    }
    if (packagedLitres > allocatedVolume + 1e-6) {
      return NextResponse.json(
        {
          error: `Packed litres (${packagedLitres.toFixed(2)}L) cannot exceed allocated volume (${allocatedVolume.toFixed(2)}L).`,
        },
        { status: 400 }
      )
    }

    const hasFlavourLines =
      !batch.parentBatchId &&
      (await db.collection(JABA_FLAVOUR_LINES_COLLECTION).countDocuments({ parentBatchId: batchId })) > 0

    if (hasFlavourLines && !flavourLineId) {
      return NextResponse.json(
        { error: 'This batch is split into flavour lines. Select a flavour line before packaging.' },
        { status: 400 }
      )
    }

    let newRemaining: number | null = null
    let lineAllocated: number | null = null
    let flavourLineDoc: any = null

    if (flavourLineId) {
      flavourLineDoc = await db.collection(JABA_FLAVOUR_LINES_COLLECTION).findOne({ _id: new ObjectId(flavourLineId) })
      if (!flavourLineDoc) {
        return NextResponse.json({ error: 'Flavour line not found' }, { status: 404 })
      }
      if (String(flavourLineDoc.parentBatchId) !== String(batchId)) {
        return NextResponse.json({ error: 'Flavour line does not belong to this batch' }, { status: 400 })
      }
      const priorOutputs = await db.collection('jaba_packagingOutput').find({ flavourLineId }).toArray()
      const priorLitres = sumPackagedLitresForFlavourLine(priorOutputs, { flavourLineId })
      const alloc = Number(flavourLineDoc.allocatedLitres) || 0
      lineAllocated = alloc
      if (priorLitres + packagedLitres > alloc + 1e-6) {
        return NextResponse.json(
          {
            error: `Packaging would exceed this flavour line allocation (${alloc.toFixed(2)}L). Already packaged ${priorLitres.toFixed(2)}L, session adds ${packagedLitres.toFixed(2)}L.`,
          },
          { status: 400 }
        )
      }
      newRemaining = Math.max(0, alloc - priorLitres - packagedLitres)
    } else {
      const currentRemaining = batch.outputSummary?.remainingLitres || batch.totalLitres
      if (packagedLitres > Number(currentRemaining) + 1e-6) {
        return NextResponse.json(
          {
            error: `Packaging would exceed remaining batch volume (${Number(currentRemaining).toFixed(2)}L). Session adds ${packagedLitres.toFixed(2)}L.`,
          },
          { status: 400 }
        )
      }
      newRemaining = currentRemaining - packagedLitres
    }

    // Prepare packaging output document
    const packagingData: Record<string, unknown> = {
      batchId: batchId,
      batchNumber: batchNumber.trim(),
      packageNumber: finalPackageNumber.trim(),
      volumeAllocated: Number(volumeAllocated),
      packagedLitres: packagedLitres,
      packagingDate: new Date(packagingDate),
      packagingLine: packagingLine.trim(),
      supervisor: supervisor.trim(),
      teamMembers: teamMembers || [],
      containers: containers || [],
      defects: Number(defects) || 0,
      defectReasons: defectReasons?.trim() || '',
      machineEfficiency: machineEfficiency ? Number(machineEfficiency) : undefined,
      safetyChecks: safetyChecks || false,
      createdAt: new Date(),
    }

    if (flavourLineId && flavourLineDoc) {
      packagingData.flavourLineId = flavourLineId
      packagingData.flavourName = String(flavourLineDoc.flavourName || '')
    }

    const totalUnitsPacked = getTotalContainerUnits(containers || [])
    if (totalUnitsPacked <= 0) {
      return NextResponse.json(
        { error: 'No container quantity entered. Add at least one packaged bottle.' },
        { status: 400 }
      )
    }

    const rawMaterialsCollection = db.collection('jaba_rawMaterials')
    const mongoSession = client.startSession()
    let createdPackagingId = ''
    let txRemainingLitres = Math.max(0, newRemaining ?? 0)

    try {
      await mongoSession.withTransaction(async () => {
        const fmtSize = (size: string, customSize?: string) => (size === 'custom' ? `${customSize ?? ''}ml` : size)

        // Group quantities by container "size spec", then resolve the correct raw materials per size.
        const sizeSpecToUnits = new Map<
          string,
          {
            size: string
            customSize?: string
            units: number
          }
        >()

        for (const c of containers || []) {
          const units = normalizeQty((c as any).quantity)
          if (units <= 0) continue

          const size = String((c as any).size || '')
          const customSize = (c as any).customSize ? String((c as any).customSize) : undefined
          const specKey = size === 'custom' ? `custom:${customSize ?? ''}` : size

          const existing = sizeSpecToUnits.get(specKey)
          if (existing) {
            existing.units += units
          } else {
            sizeSpecToUnits.set(specKey, { size, customSize, units })
          }
        }

        const bottleRequirementsById = new Map<string, { doc: any; units: number }>()
        const stickerRequirementsById = new Map<string, { doc: any; units: number }>()

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
              session: mongoSession,
            }),
          ])

          if (!bottleMaterial) {
            throw new ApiError(
              `No bottle raw material found for size ${fmtSize(spec.size, spec.customSize)}. Add an item like "250ml Bottles", "500ml Bottles", "1L Bottles", "2L Bottles" in Raw Materials.`,
              400
            )
          }
          if (!stickerMaterial) {
            throw new ApiError(
              `No sticker raw material found for size ${fmtSize(spec.size, spec.customSize)}. Add an item like "250ml Stickers" / "Labels" in Raw Materials before packaging.`,
              400
            )
          }

          const bottleId = String(bottleMaterial._id)
          const stickerId = String(stickerMaterial._id)

          const existingBottle = bottleRequirementsById.get(bottleId)
          if (existingBottle) existingBottle.units += spec.units
          else bottleRequirementsById.set(bottleId, { doc: bottleMaterial, units: spec.units })

          const existingSticker = stickerRequirementsById.get(stickerId)
          if (existingSticker) existingSticker.units += spec.units
          else stickerRequirementsById.set(stickerId, { doc: stickerMaterial, units: spec.units })
        }

        // Validate stock before deducting (still inside the transaction).
        for (const req of bottleRequirementsById.values()) {
          const stock = Number(req.doc.currentStock) || 0
          if (stock < req.units) {
            throw new ApiError(
              `Insufficient bottle stock: need ${req.units.toLocaleString()}, available ${stock.toLocaleString()} (${String(
                req.doc.name || 'bottles'
              )}).`,
              400
            )
          }
        }
        for (const req of stickerRequirementsById.values()) {
          const stock = Number(req.doc.currentStock) || 0
          if (stock < req.units) {
            throw new ApiError(
              `Insufficient sticker stock: need ${req.units.toLocaleString()}, available ${stock.toLocaleString()} (${String(
                req.doc.name || 'stickers'
              )}).`,
              400
            )
          }
        }

        const materialsUsed: any[] = []
        for (const [materialId, req] of bottleRequirementsById.entries()) {
          materialsUsed.push({
            materialId,
            name: String(req.doc.name || 'Bottles'),
            type: 'bottles',
            quantity: req.units,
          })
        }
        for (const [materialId, req] of stickerRequirementsById.entries()) {
          materialsUsed.push({
            materialId,
            name: String(req.doc.name || 'Stickers'),
            type: 'stickers',
            quantity: req.units,
          })
        }

        ;(packagingData as any).materialsUsed = materialsUsed

        // Re-read current batch inside transaction for concurrency-safe update.
        const txBatch = await db.collection('jaba_batches').findOne({ _id: new ObjectId(batchId) }, { session: mongoSession })
        if (!txBatch) throw new ApiError('Batch not found', 404)

        if (flavourLineId) {
          const txLine = await db.collection(JABA_FLAVOUR_LINES_COLLECTION).findOne({ _id: new ObjectId(flavourLineId) }, { session: mongoSession })
          if (!txLine) throw new ApiError('Flavour line not found', 404)
          const txPriorOutputs = await db.collection('jaba_packagingOutput').find({ flavourLineId }, { session: mongoSession }).toArray()
          const txPriorLitres = sumPackagedLitresForFlavourLine(txPriorOutputs, { flavourLineId })
          const txAlloc = Number(txLine.allocatedLitres) || 0
          if (txPriorLitres + packagedLitres > txAlloc + 1e-6) {
            throw new ApiError(
              `Packaging would exceed this flavour line allocation (${txAlloc.toFixed(2)}L). Already packaged ${txPriorLitres.toFixed(2)}L, session adds ${packagedLitres.toFixed(2)}L.`,
              400
            )
          }
          txRemainingLitres = Math.max(0, txAlloc - txPriorLitres - packagedLitres)
        } else {
          const txRemaining = Number(txBatch.outputSummary?.remainingLitres ?? txBatch.totalLitres) || 0
          if (packagedLitres > txRemaining + 1e-6) {
            throw new ApiError(
              `Packaging would exceed remaining batch volume (${txRemaining.toFixed(2)}L). Session adds ${packagedLitres.toFixed(2)}L.`,
              400
            )
          }
          txRemainingLitres = Math.max(0, txRemaining - packagedLitres)
        }

        const packagingInsert = await db.collection('jaba_packagingOutput').insertOne(packagingData, { session: mongoSession })
        createdPackagingId = packagingInsert.insertedId.toString()

        const bottleAdds = containers.reduce(
          (sum: number, c: any) => sum + Math.max(0, parseFloat(c.quantity) || 0),
          0
        )

        // Deduct bottles and stickers using conditional $inc to keep it concurrency-safe.
        for (const [_, req] of bottleRequirementsById.entries()) {
          const qty = req.units
          const bottleDeduct = await rawMaterialsCollection.updateOne(
            { _id: req.doc._id, currentStock: { $gte: qty } },
            { $inc: { currentStock: -qty }, $set: { updatedAt: new Date() } },
            { session: mongoSession }
          )
          if (bottleDeduct.modifiedCount !== 1) {
            throw new ApiError('Raw material stock changed during packaging. Please refresh and try again.', 409)
          }
        }

        for (const [_, req] of stickerRequirementsById.entries()) {
          const qty = req.units
          const stickerDeduct = await rawMaterialsCollection.updateOne(
            { _id: req.doc._id, currentStock: { $gte: qty } },
            { $inc: { currentStock: -qty }, $set: { updatedAt: new Date() } },
            { session: mongoSession }
          )
          if (stickerDeduct.modifiedCount !== 1) {
            throw new ApiError('Raw material stock changed during packaging. Please refresh and try again.', 409)
          }
        }
        const updateData: Record<string, unknown> = {
          'outputSummary.totalBottles': (txBatch.outputSummary?.totalBottles || 0) + bottleAdds,
          updatedAt: new Date(),
        }

        if (flavourLineId) {
          if (txBatch.status === 'QC Passed - Ready for Packaging' || txBatch.status === 'Partially Allocated' || txBatch.status === 'Fully Allocated') {
            updateData.status = 'Partially Packaged'
          }
        } else {
          updateData['outputSummary.remainingLitres'] = txRemainingLitres
          if (txRemainingLitres <= 0) {
            updateData.status = 'Ready for Distribution'
          } else if (txBatch.status === 'QC Passed - Ready for Packaging') {
            updateData.status = 'Partially Packaged'
          }
        }

        containers.forEach((container: any) => {
          const qty = Math.max(0, parseFloat(container.quantity) || 0)
          if (container.size === '250ml') updateData.bottles250ml = (txBatch.bottles250ml || 0) + qty
          else if (container.size === '500ml') updateData.bottles500ml = (txBatch.bottles500ml || 0) + qty
          else if (container.size === '1L') updateData.bottles1L = (txBatch.bottles1L || 0) + qty
          else if (container.size === '2L') updateData.bottles2L = (txBatch.bottles2L || 0) + qty
        })

        await db.collection('jaba_batches').updateOne(
          { _id: new ObjectId(batchId) },
          { $set: updateData },
          { session: mongoSession }
        )
      })
    } finally {
      await mongoSession.endSession()
    }

    console.log(`[Packaging Output API] ✅ Packaging session created successfully (ID: ${createdPackagingId}, Package Number: ${finalPackageNumber})`)

    return NextResponse.json(
      {
        success: true,
        packaging: {
          ...packagingData,
          _id: createdPackagingId,
          id: createdPackagingId,
          remainingLitres: txRemainingLitres,
          remainingOnFlavourLineLitres: flavourLineId ? txRemainingLitres : undefined,
          flavourAllocatedLitres: lineAllocated ?? undefined,
        }
      },
      { status: 201 }
    )
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Packaging Output API] ❌ Error creating packaging output:', error)
    return NextResponse.json(
      {
        error: 'Failed to create packaging output',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// GET packaging outputs
export async function GET(request: Request) {
  const authResult = await requireJabaAction('production.packaging', 'view')
  if ('response' in authResult) return authResult.response

  try {
    console.log('[Packaging Output API] GET request received')
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batchId')
    console.log('[Packaging Output API] BatchId filter:', batchId || 'none')

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    const query: any = {}
    if (batchId) {
      query.batchId = batchId
    }

    console.log('[Packaging Output API] Query:', JSON.stringify(query))
    console.log('[Packaging Output API] Database:', db.databaseName)
    console.log('[Packaging Output API] Collection: jaba_packagingOutput')
    
    // Verify collection exists and get count
    const collection = db.collection('jaba_packagingOutput')
    const totalCount = await collection.countDocuments({})
    console.log('[Packaging Output API] Total documents in collection:', totalCount)
    
    // Sort by createdAt (most recent first) as primary, then packagingDate as fallback
    const packagingOutputs = await collection
      .find(query)
      .sort({ createdAt: -1, packagingDate: -1 })
      .toArray()

    console.log('[Packaging Output API] Found packaging outputs matching query:', packagingOutputs.length)
    
    if (packagingOutputs.length > 0) {
      console.log('[Packaging Output API] First output sample:', {
        _id: packagingOutputs[0]._id?.toString(),
        batchNumber: packagingOutputs[0].batchNumber,
        packageNumber: packagingOutputs[0].packageNumber,
        containers: packagingOutputs[0].containers?.length || 0,
      })
    }

    const formattedOutputs = packagingOutputs.map(output => ({
      ...output,
      _id: output._id.toString(),
      id: output._id.toString(),
      packagingDate: output.packagingDate instanceof Date ? output.packagingDate.toISOString() : output.packagingDate,
      createdAt: output.createdAt instanceof Date ? output.createdAt.toISOString() : output.createdAt,
    }))

    console.log('[Packaging Output API] ✅ Returning', formattedOutputs.length, 'packaging outputs')
    return NextResponse.json({ packagingOutputs: formattedOutputs })
  } catch (error: any) {
    console.error('[Packaging Output API] ❌ Error fetching packaging outputs:', error)
    console.error('[Packaging Output API] Error stack:', error.stack)
    return NextResponse.json(
      {
        error: 'Failed to fetch packaging outputs',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// DELETE packaging output and restore packaging materials stock
export async function DELETE(request: Request) {
  const authResult = await requireJabaAction('production.packaging', 'delete')
  if ('response' in authResult) return authResult.response

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Packaging output id is required' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    const packagingOutput = await db.collection('jaba_packagingOutput').findOne({ _id: new ObjectId(id) })
    if (!packagingOutput) {
      return NextResponse.json({ error: 'Packaging output not found' }, { status: 404 })
    }

    const containers = Array.isArray(packagingOutput.containers) ? packagingOutput.containers : []
    const totalUnitsPacked = getTotalContainerUnits(containers as any[])
    const rawMaterialsCollection = db.collection('jaba_rawMaterials')

    // Prefer exact materials used for this session; fallback by name if old records don't have metadata.
    const materialsUsed = Array.isArray((packagingOutput as any).materialsUsed)
      ? (packagingOutput as any).materialsUsed
      : []

    if (materialsUsed.length > 0) {
      for (const materialUse of materialsUsed) {
        const qty = normalizeQty(materialUse.quantity)
        if (!materialUse.materialId || qty <= 0) continue
        await rawMaterialsCollection.updateOne(
          { _id: new ObjectId(String(materialUse.materialId)) },
          { $inc: { currentStock: qty }, $set: { updatedAt: new Date() } }
        )
      }
    } else if (totalUnitsPacked > 0) {
      const { bottleMaterial, stickerMaterial } = await findPrimaryPackagingMaterials(rawMaterialsCollection)
      if (bottleMaterial) {
        await rawMaterialsCollection.updateOne(
          { _id: bottleMaterial._id },
          { $inc: { currentStock: totalUnitsPacked }, $set: { updatedAt: new Date() } }
        )
      }
      if (stickerMaterial) {
        await rawMaterialsCollection.updateOne(
          { _id: stickerMaterial._id },
          { $inc: { currentStock: totalUnitsPacked }, $set: { updatedAt: new Date() } }
        )
      }
    }

    // Reverse batch packed counters and remaining litres.
    const batchId = String(packagingOutput.batchId || '')
    if (batchId) {
      const batch = await db.collection('jaba_batches').findOne({ _id: new ObjectId(batchId) })
      if (batch) {
        const packagedLitres = Number(packagingOutput.packagedLitres) || 0
        const updateData: Record<string, unknown> = {
          updatedAt: new Date(),
          'outputSummary.totalBottles': Math.max(0, (Number(batch.outputSummary?.totalBottles) || 0) - totalUnitsPacked),
        }

        if (!(packagingOutput as any).flavourLineId) {
          updateData['outputSummary.remainingLitres'] =
            Math.max(0, (Number(batch.outputSummary?.remainingLitres) || 0) + packagedLitres)
          if (batch.status === 'Ready for Distribution') {
            updateData.status = 'Partially Packaged'
          }
        }

        for (const container of containers as any[]) {
          const qty = normalizeQty(container.quantity)
          if (container.size === '250ml') {
            updateData.bottles250ml = Math.max(0, (Number(batch.bottles250ml) || 0) - qty)
          } else if (container.size === '500ml') {
            updateData.bottles500ml = Math.max(0, (Number(batch.bottles500ml) || 0) - qty)
          } else if (container.size === '1L') {
            updateData.bottles1L = Math.max(0, (Number(batch.bottles1L) || 0) - qty)
          } else if (container.size === '2L') {
            updateData.bottles2L = Math.max(0, (Number(batch.bottles2L) || 0) - qty)
          }
        }

        await db.collection('jaba_batches').updateOne(
          { _id: new ObjectId(batchId) },
          { $set: updateData }
        )
      }
    }

    await db.collection('jaba_packagingOutput').deleteOne({ _id: new ObjectId(id) })

    return NextResponse.json({
      success: true,
      message: 'Packaging session deleted and packaging materials stock restored.',
    })
  } catch (error: any) {
    console.error('[Packaging Output API] ❌ Error deleting packaging output:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete packaging output',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}
