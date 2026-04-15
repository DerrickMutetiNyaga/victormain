import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireJabaAction } from '@/lib/api-jaba-permissions'
import {
  normalizeBatchType,
  isLegacyFlavourFirstBatch,
  getNeutralRemainingLitres,
} from '@/lib/jaba-batch-utils'
import {
  JABA_FLAVOUR_LINES_COLLECTION,
  nextFlavourLineCode,
  parentStatusAfterFlavourAllocation,
} from '@/lib/jaba-flavour-lines'

export const runtime = 'nodejs'

type InfuseOutputInput = {
  flavorId?: string
  flavorName: string
  quantityLitres: number
  notes?: string
  status?: string
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireJabaAction('production.batches', 'edit')
  if ('response' in authResult) return authResult.response

  try {
    const { id: parentId } = await params
    const body = await request.json()
    const outputs = body.outputs as InfuseOutputInput[]
    const infusionDateRaw = body.infusionDate as string | undefined

    if (!parentId || !Array.isArray(outputs) || outputs.length === 0) {
      return NextResponse.json({ error: 'parent id and non-empty outputs[] are required' }, { status: 400 })
    }

    const totalNew = outputs.reduce((sum, o) => sum + Math.max(0, Number(o.quantityLitres) || 0), 0)
    if (totalNew <= 0) {
      return NextResponse.json({ error: 'Each output must have quantityLitres > 0' }, { status: 400 })
    }

    for (const o of outputs) {
      const name = (o.flavorName || '').trim()
      if (!name) {
        return NextResponse.json({ error: 'Each output needs a flavor name' }, { status: 400 })
      }
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    const parent = (await db.collection('jaba_batches').findOne({ _id: new ObjectId(parentId) })) as Record<
      string,
      any
    > | null
    if (!parent) {
      return NextResponse.json({ error: 'Parent batch not found' }, { status: 404 })
    }

    if (parent.parentBatchId) {
      return NextResponse.json({ error: 'Only the master batch can have flavour lines' }, { status: 400 })
    }

    if (isLegacyFlavourFirstBatch(parent)) {
      return NextResponse.json(
        {
          error:
            'This batch was created with a flavour already assigned (legacy). Create new neutral batches for the infusion workflow.',
        },
        { status: 400 }
      )
    }

    if (normalizeBatchType(parent) !== 'neutral') {
      return NextResponse.json({ error: 'Only neutral batches can receive flavour allocation' }, { status: 400 })
    }

    const allowedStatuses = new Set([
      'Processed',
      'QC Pending',
      'QC Passed - Ready for Packaging',
      'Partially Packaged',
      'Ready for Distribution',
      'Completed',
      'Ready for Infusion',
      'Ready for flavour allocation',
      'Partially Allocated',
      'Fully Allocated',
    ])
    if (!allowedStatuses.has(parent.status) && parent.status !== 'Ready for Infusion') {
      return NextResponse.json(
        { error: 'Mark the batch as processed (or advance status) before allocating flavours.' },
        { status: 400 }
      )
    }

    const remaining = getNeutralRemainingLitres(parent)
    if (totalNew - remaining > 1e-6) {
      return NextResponse.json(
        {
          error: `Total allocation (${totalNew}L) exceeds remaining unallocated volume (${remaining.toFixed(2)}L).`,
        },
        { status: 400 }
      )
    }

    const infusionDate = infusionDateRaw ? new Date(infusionDateRaw) : new Date()
    const batchNumber = String(parent.batchNumber || '')
    const created: any[] = []

    for (const o of outputs) {
      const qty = Math.max(0, Number(o.quantityLitres) || 0)
      const flavorName = o.flavorName.trim()
      const lineCode = await nextFlavourLineCode(db, batchNumber, parentId)

      const lineDoc = {
        parentBatchId: parentId,
        flavourName: flavorName,
        flavourId: o.flavorId || null,
        allocatedLitres: qty,
        lineCode,
        status: o.status === 'Infusing' ? 'Infusing' : 'Allocated',
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

    const infusionAllocationStatus = newRemaining <= 1e-6 ? 'full' : 'partial'
    const nextStatus = parentStatusAfterFlavourAllocation(String(parent.status), newRemaining, newAllocated)

    await db.collection('jaba_batches').updateOne(
      { _id: new ObjectId(parentId) },
      {
        $set: {
          infusedAllocatedLitres: newAllocated,
          'outputSummary.remainingLitres': newRemaining,
          infusionAllocationStatus,
          status: nextStatus,
          updatedAt: new Date(),
        },
      }
    )

    await db.collection('jaba_inventory_movements').insertOne({
      type: 'TRANSFER',
      reason: 'NEUTRAL_INFUSED',
      batchId: parentId,
      batchNumber: parent.batchNumber,
      materialName: 'Neutral batch → flavour lines',
      quantity: totalNew,
      unit: 'L',
      metadata: { flavourLineIds: created.map((c) => c._id) },
      userId: 'system',
      timestamp: new Date(),
      createdAt: new Date(),
    })

    return NextResponse.json({
      success: true,
      created,
      parent: {
        infusedAllocatedLitres: newAllocated,
        neutralRemainingLitres: newRemaining,
        status: nextStatus,
        infusionAllocationStatus,
      },
    })
  } catch (error: any) {
    console.error('[Infuse batch] Error:', error)
    return NextResponse.json({ error: error.message || 'Infusion failed' }, { status: 500 })
  }
}
