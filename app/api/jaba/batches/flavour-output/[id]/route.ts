import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireJabaAction } from '@/lib/api-jaba-permissions'
import { normalizeBatchType, getNeutralRemainingLitres } from '@/lib/jaba-batch-utils'

export const runtime = 'nodejs'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireJabaAction('production.batches', 'edit')
  if ('response' in authResult) return authResult.response

  try {
    const { id } = await params
    const body = await request.json()
    const newQty = Number(body.quantityLitres ?? body.infusedQuantityLitres)
    const flavorName = typeof body.flavorName === 'string' ? body.flavorName.trim() : undefined
    const notes = body.notes !== undefined ? String(body.notes).trim() || null : undefined
    const status = typeof body.status === 'string' ? body.status : undefined

    if (!id || Number.isNaN(newQty) || newQty <= 0) {
      return NextResponse.json({ error: 'Valid quantityLitres is required' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    const child = await db.collection('jaba_batches').findOne({ _id: new ObjectId(id) })
    if (!child) {
      return NextResponse.json({ error: 'Flavour output not found' }, { status: 404 })
    }
    if (!child.parentBatchId || normalizeBatchType(child) !== 'flavoured') {
      return NextResponse.json({ error: 'Not a flavoured output batch' }, { status: 400 })
    }

    const parent = await db.collection('jaba_batches').findOne({ _id: new ObjectId(child.parentBatchId) })
    if (!parent) {
      return NextResponse.json({ error: 'Parent batch missing' }, { status: 400 })
    }

    const oldQty = Number(child.infusedQuantityLitres ?? child.totalLitres) || 0
    const delta = newQty - oldQty
    const parentRemaining = getNeutralRemainingLitres(parent)
    // When increasing, need delta <= parentRemaining; when decreasing, always ok
    if (delta > parentRemaining + 1e-6) {
      return NextResponse.json(
        { error: `Increase of ${delta}L exceeds parent remaining ${parentRemaining.toFixed(2)}L` },
        { status: 400 }
      )
    }

    const newParentAllocated = (Number(parent.infusedAllocatedLitres) || 0) + delta
    const produced = Number(parent.totalLitres) || 0
    const neutralLeft = Math.max(0, produced - newParentAllocated)

    const setChild: Record<string, unknown> = {
      infusedQuantityLitres: newQty,
      totalLitres: newQty,
      expectedLitres: newQty,
      'outputSummary.remainingLitres': newQty,
      updatedAt: new Date(),
    }
    if (flavorName) setChild.flavor = flavorName
    if (notes !== undefined) setChild.notes = notes
    if (status && ['Created', 'Infused', 'Packaged', 'Completed'].includes(status)) setChild.status = status

    await db.collection('jaba_batches').updateOne({ _id: new ObjectId(id) }, { $set: setChild })

    const simpleInfusionStatuses = new Set(['Processed', 'Ready for Infusion', 'Partially Infused', 'Fully Infused'])
    const nextParentStatus = simpleInfusionStatuses.has(parent.status)
      ? neutralLeft <= 1e-6
        ? 'Fully Infused'
        : newParentAllocated > 0
          ? 'Partially Infused'
          : parent.status
      : parent.status

    await db.collection('jaba_batches').updateOne(
      { _id: new ObjectId(child.parentBatchId) },
      {
        $set: {
          infusedAllocatedLitres: newParentAllocated,
          'outputSummary.remainingLitres': neutralLeft,
          infusionAllocationStatus: neutralLeft <= 1e-6 ? 'full' : newParentAllocated > 0 ? 'partial' : 'none',
          status: nextParentStatus,
          updatedAt: new Date(),
        },
      }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Flavour output PUT]', error)
    return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireJabaAction('production.batches', 'delete')
  if ('response' in authResult) return authResult.response

  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    const child = await db.collection('jaba_batches').findOne({ _id: new ObjectId(id) })
    if (!child) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!child.parentBatchId) {
      return NextResponse.json({ error: 'Only flavoured output batches can be deleted here' }, { status: 400 })
    }

    const qty = Number(child.infusedQuantityLitres ?? child.totalLitres) || 0
    const parentId = child.parentBatchId

    await db.collection('jaba_batches').deleteOne({ _id: new ObjectId(id) })

    const parent = await db.collection('jaba_batches').findOne({ _id: new ObjectId(parentId) })
    if (parent) {
      const newAllocated = Math.max(0, (Number(parent.infusedAllocatedLitres) || 0) - qty)
      const produced = Number(parent.totalLitres) || 0
      const neutralLeft = Math.max(0, produced - newAllocated)
      const simpleInfusionStatuses = new Set(['Processed', 'Ready for Infusion', 'Partially Infused', 'Fully Infused'])
      const nextParentStatus = simpleInfusionStatuses.has(parent.status)
        ? newAllocated <= 1e-6 && neutralLeft >= produced - 1e-6
          ? 'Processed'
          : neutralLeft <= 1e-6
            ? 'Fully Infused'
            : newAllocated > 0
              ? 'Partially Infused'
              : 'Processed'
        : parent.status

      await db.collection('jaba_batches').updateOne(
        { _id: new ObjectId(parentId) },
        {
          $set: {
            infusedAllocatedLitres: newAllocated,
            'outputSummary.remainingLitres': neutralLeft,
            infusionAllocationStatus:
              newAllocated <= 1e-6 ? 'none' : neutralLeft <= 1e-6 ? 'full' : 'partial',
            status: nextParentStatus,
            updatedAt: new Date(),
          },
        }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Flavour output DELETE]', error)
    return NextResponse.json({ error: error.message || 'Delete failed' }, { status: 500 })
  }
}
