import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireJabaAction } from '@/lib/api-jaba-permissions'
import {
  JABA_FLAVOUR_LINES_COLLECTION,
  sumPackagedLitresForFlavourLine,
} from '@/lib/jaba-flavour-lines'

export const runtime = 'nodejs'

const BOTTLE_NAME_REGEX = /\bbott?l?e?s?\b/i
const STICKER_NAME_REGEX = /\b(stickers?|labels?)\b/i

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
        const [bottleMaterial, stickerMaterial] = await Promise.all([
          rawMaterialsCollection
            .find({ name: { $regex: BOTTLE_NAME_REGEX } }, { session: mongoSession })
            .sort({ currentStock: -1, updatedAt: -1, createdAt: -1 })
            .limit(1)
            .next(),
          rawMaterialsCollection
            .find({ name: { $regex: STICKER_NAME_REGEX } }, { session: mongoSession })
            .sort({ currentStock: -1, updatedAt: -1, createdAt: -1 })
            .limit(1)
            .next(),
        ])

        if (!bottleMaterial) throw new ApiError('No bottle raw material found. Add a bottle item in Raw Materials before packaging.', 400)
        if (!stickerMaterial) throw new ApiError('No sticker raw material found. Add a sticker item in Raw Materials before packaging.', 400)

        const bottleStock = Number(bottleMaterial.currentStock) || 0
        const stickerStock = Number(stickerMaterial.currentStock) || 0
        if (bottleStock < totalUnitsPacked) {
          throw new ApiError(
            `Insufficient bottle stock: need ${totalUnitsPacked.toLocaleString()}, available ${bottleStock.toLocaleString()}.`,
            400
          )
        }
        if (stickerStock < totalUnitsPacked) {
          throw new ApiError(
            `Insufficient sticker stock: need ${totalUnitsPacked.toLocaleString()}, available ${stickerStock.toLocaleString()}.`,
            400
          )
        }

        ;(packagingData as any).materialsUsed = [
          { materialId: String(bottleMaterial._id), name: String(bottleMaterial.name || 'Bottles'), type: 'bottles', quantity: totalUnitsPacked },
          { materialId: String(stickerMaterial._id), name: String(stickerMaterial.name || 'Stickers'), type: 'stickers', quantity: totalUnitsPacked },
        ]

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

        const bottleDeduct = await rawMaterialsCollection.updateOne(
          { _id: bottleMaterial._id, currentStock: { $gte: totalUnitsPacked } },
          { $inc: { currentStock: -totalUnitsPacked }, $set: { updatedAt: new Date() } },
          { session: mongoSession }
        )
        const stickerDeduct = await rawMaterialsCollection.updateOne(
          { _id: stickerMaterial._id, currentStock: { $gte: totalUnitsPacked } },
          { $inc: { currentStock: -totalUnitsPacked }, $set: { updatedAt: new Date() } },
          { session: mongoSession }
        )
        if (bottleDeduct.modifiedCount !== 1 || stickerDeduct.modifiedCount !== 1) {
          throw new ApiError('Raw material stock changed during packaging. Please refresh and try again.', 409)
        }

        const bottleAdds = containers.reduce((sum: number, c: any) => sum + (parseFloat(c.quantity) || 0), 0)
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
          const qty = parseFloat(container.quantity) || 0
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
      const [bottleMaterial, stickerMaterial] = await Promise.all([
        rawMaterialsCollection
          .find({ name: { $regex: BOTTLE_NAME_REGEX } })
          .sort({ currentStock: -1, updatedAt: -1, createdAt: -1 })
          .limit(1)
          .next(),
        rawMaterialsCollection
          .find({ name: { $regex: STICKER_NAME_REGEX } })
          .sort({ currentStock: -1, updatedAt: -1, createdAt: -1 })
          .limit(1)
          .next(),
      ])
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
