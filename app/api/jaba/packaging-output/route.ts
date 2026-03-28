import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import {
  JABA_FLAVOUR_LINES_COLLECTION,
  sumPackagedLitresForFlavourLine,
} from '@/lib/jaba-flavour-lines'

export const runtime = 'nodejs'

// POST create packaging output
export async function POST(request: Request) {
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
      if (container.size === "500ml") {
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

    // Insert packaging output
    console.log('[Packaging Output API] Saving packaging data with packageNumber:', packagingData.packageNumber)
    const result = await db.collection('jaba_packagingOutput').insertOne(packagingData)
    console.log('[Packaging Output API] ✅ Packaging output saved to DB with ID:', result.insertedId)

    const bottleAdds = containers.reduce((sum: number, c: any) => sum + (parseFloat(c.quantity) || 0), 0)

    const updateData: Record<string, unknown> = {
      'outputSummary.totalBottles': (batch.outputSummary?.totalBottles || 0) + bottleAdds,
      updatedAt: new Date(),
    }

    if (flavourLineId) {
      if (batch.status === 'QC Passed - Ready for Packaging' || batch.status === 'Partially Allocated' || batch.status === 'Fully Allocated') {
        updateData.status = 'Partially Packaged'
      }
    } else {
      updateData['outputSummary.remainingLitres'] = Math.max(0, newRemaining ?? 0)
      if ((newRemaining ?? 0) <= 0) {
        updateData.status = 'Ready for Distribution'
      } else if (batch.status === 'QC Passed - Ready for Packaging') {
        updateData.status = 'Partially Packaged'
      }
    }

    containers.forEach((container: any) => {
      const qty = parseFloat(container.quantity) || 0
      if (container.size === "500ml") {
        updateData.bottles500ml = (batch.bottles500ml || 0) + qty
      } else if (container.size === "1L") {
        updateData.bottles1L = (batch.bottles1L || 0) + qty
      } else if (container.size === "2L") {
        updateData.bottles2L = (batch.bottles2L || 0) + qty
      }
    })

    await db.collection('jaba_batches').updateOne(
      { _id: new ObjectId(batchId) },
      { $set: updateData }
    )

    console.log(`[Packaging Output API] ✅ Packaging session created successfully (ID: ${result.insertedId}, Package Number: ${finalPackageNumber})`)

    return NextResponse.json(
      {
        success: true,
        packaging: {
          ...packagingData,
          _id: result.insertedId.toString(),
          id: result.insertedId.toString(),
          remainingLitres: Math.max(0, newRemaining ?? 0),
          remainingOnFlavourLineLitres: flavourLineId ? Math.max(0, newRemaining ?? 0) : undefined,
          flavourAllocatedLitres: lineAllocated ?? undefined,
        }
      },
      { status: 201 }
    )
  } catch (error: any) {
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
