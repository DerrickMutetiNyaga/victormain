import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireJabaAction } from '@/lib/api-jaba-permissions'
import {
  normalizeBatchType,
  isLegacyFlavourFirstBatch,
  getNeutralRemainingLitres,
} from '@/lib/jaba-batch-utils'
import { allocateFlavourLinesToParent } from '@/lib/jaba-allocate-flavour-lines'

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
      'Ready for Packaging',
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

    const result = await allocateFlavourLinesToParent(db, parentId, parent, outputs, infusionDate)

    return NextResponse.json({
      success: true,
      created: result.created,
      parent: {
        infusedAllocatedLitres: result.newAllocated,
        neutralRemainingLitres: result.newRemaining,
        status: result.nextStatus,
        infusionAllocationStatus: result.infusionAllocationStatus,
      },
    })
  } catch (error: any) {
    console.error('[Infuse batch] Error:', error)
    return NextResponse.json({ error: error.message || 'Infusion failed' }, { status: 500 })
  }
}
