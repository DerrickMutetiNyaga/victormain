import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireJabaAction } from '@/lib/api-jaba-permissions'
import { normalizeBatchType, isLegacyFlavourFirstBatch, getNeutralRemainingLitres, childBatchNumberSuffix } from '@/lib/jaba-batch-utils'

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

    const parent = await db.collection('jaba_batches').findOne({ _id: new ObjectId(parentId) })
    if (!parent) {
      return NextResponse.json({ error: 'Parent batch not found' }, { status: 404 })
    }

    if (parent.parentBatchId) {
      return NextResponse.json({ error: 'Cannot infuse from a flavoured output batch' }, { status: 400 })
    }

    if (isLegacyFlavourFirstBatch(parent)) {
      return NextResponse.json(
        { error: 'This batch was created with a flavour already assigned (legacy). Create new neutral batches for the infusion workflow.' },
        { status: 400 }
      )
    }

    if (normalizeBatchType(parent) !== 'neutral') {
      return NextResponse.json({ error: 'Only neutral batches can be infused' }, { status: 400 })
    }

    // Require processed neutral stock (actual produced volume) before splitting into flavours
    const allowedStatuses = new Set(['Processed', 'QC Pending', 'QC Passed - Ready for Packaging', 'Partially Packaged', 'Ready for Distribution', 'Completed'])
    if (!allowedStatuses.has(parent.status) && parent.status !== 'Ready for Infusion') {
      return NextResponse.json(
        { error: 'Mark the batch as processed (or advance status) before creating flavoured outputs.' },
        { status: 400 }
      )
    }

    const remaining = getNeutralRemainingLitres(parent)
    if (totalNew - remaining > 1e-6) {
      return NextResponse.json(
        { error: `Total infusion (${totalNew}L) exceeds remaining neutral volume (${remaining.toFixed(2)}L).` },
        { status: 400 }
      )
    }

    const existingChildren = await db
      .collection('jaba_batches')
      .find({ parentBatchId: parentId })
      .toArray()
    const startIdx = existingChildren.length + 1

    const infusionDate = infusionDateRaw ? new Date(infusionDateRaw) : new Date()

    const created: any[] = []
    let idx = 0
    for (const o of outputs) {
      const qty = Math.max(0, Number(o.quantityLitres) || 0)
      const flavorName = o.flavorName.trim()
      const bn = childBatchNumberSuffix(parent.batchNumber, startIdx + idx)

      const childDoc = {
        batchNumber: bn,
        date: infusionDate,
        infusionDate,
        flavor: flavorName,
        flavorId: o.flavorId || null,
        productCategory: parent.productCategory || 'Infusion Jaba',
        batchType: 'flavoured',
        parentBatchId: parentId,
        infusedQuantityLitres: qty,
        totalLitres: qty,
        expectedLitres: qty,
        bottles500ml: 0,
        bottles1L: 0,
        bottles2L: 0,
        status: o.status && ['Created', 'Infused', 'Packaged', 'Completed'].includes(o.status) ? o.status : 'Created',
        qcStatus: 'Pending',
        supervisor: parent.supervisor || '',
        shift: parent.shift || 'Morning',
        tankNumber: parent.tankNumber || null,
        ingredients: [],
        locked: false,
        outputSummary: {
          totalBottles: 0,
          remainingLitres: qty,
          breakdown: [],
        },
        notes: o.notes?.trim() || null,
        createdAt: new Date(),
      }

      const ins = await db.collection('jaba_batches').insertOne(childDoc)
      created.push({ ...childDoc, _id: ins.insertedId.toString(), id: ins.insertedId.toString() })
      idx++
    }

    const newAllocated = (Number(parent.infusedAllocatedLitres) || 0) + totalNew
    const produced = Number(parent.totalLitres) || 0
    const newRemaining = Math.max(0, produced - newAllocated)

    const infusionAllocationStatus = newRemaining <= 1e-6 ? 'full' : 'partial'
    const simpleInfusionStatuses = new Set(['Processed', 'Ready for Infusion', 'Partially Infused', 'Fully Infused'])
    const nextStatus = simpleInfusionStatuses.has(parent.status)
      ? newRemaining <= 1e-6
        ? 'Fully Infused'
        : 'Partially Infused'
      : parent.status

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
      materialName: 'Neutral batch → flavoured outputs',
      quantity: totalNew,
      unit: 'L',
      metadata: { childBatchIds: created.map((c) => c._id) },
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
