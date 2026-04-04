import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireJabaAction } from '@/lib/api-jaba-permissions'
import { normalizeBatchType, getNeutralRemainingLitres } from '@/lib/jaba-batch-utils'
import {
  JABA_FLAVOUR_LINES_COLLECTION,
  parentStatusAfterFlavourAllocation,
} from '@/lib/jaba-flavour-lines'

export const runtime = 'nodejs'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireJabaAction('production.batches', 'edit')
  if ('response' in authResult) return authResult.response

  try {
    const { id } = await params
    const body = await request.json()
    const newQty = Number(body.quantityLitres ?? body.infusedQuantityLitres ?? body.allocatedLitres)
    const flavorName = typeof body.flavorName === 'string' ? body.flavorName.trim() : undefined
    const notes = body.notes !== undefined ? String(body.notes).trim() || null : undefined
    const status = typeof body.status === 'string' ? body.status : undefined

    if (!id || Number.isNaN(newQty) || newQty <= 0) {
      return NextResponse.json({ error: 'Valid quantityLitres is required' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    const line = await db.collection(JABA_FLAVOUR_LINES_COLLECTION).findOne({ _id: new ObjectId(id) })
    if (line) {
      const parent = await db.collection('jaba_batches').findOne({ _id: new ObjectId(String(line.parentBatchId)) })
      if (!parent) {
        return NextResponse.json({ error: 'Parent batch missing' }, { status: 400 })
      }
      const p = parent as Record<string, any>

      const oldQty = Number(line.allocatedLitres) || 0
      const delta = newQty - oldQty
      const parentRemaining = getNeutralRemainingLitres(p)
      if (delta > parentRemaining + 1e-6) {
        return NextResponse.json(
          { error: `Increase of ${delta}L exceeds parent unallocated ${parentRemaining.toFixed(2)}L` },
          { status: 400 }
        )
      }

      const newParentAllocated = (Number(p.infusedAllocatedLitres) || 0) + delta
      const produced = Number(p.totalLitres) || 0
      const neutralLeft = Math.max(0, produced - newParentAllocated)

      const setLine: Record<string, unknown> = {
        allocatedLitres: newQty,
        updatedAt: new Date(),
      }
      if (flavorName) setLine.flavourName = flavorName
      if (notes !== undefined) setLine.notes = notes
      if (status && ['Allocated', 'Infusing'].includes(status)) setLine.status = status

      await db.collection(JABA_FLAVOUR_LINES_COLLECTION).updateOne({ _id: new ObjectId(id) }, { $set: setLine })

      const nextParentStatus = parentStatusAfterFlavourAllocation(
        String(p.status),
        neutralLeft,
        newParentAllocated
      )

      await db.collection('jaba_batches').updateOne(
        { _id: new ObjectId(String(line.parentBatchId)) },
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
    }

    const child = await db.collection('jaba_batches').findOne({ _id: new ObjectId(id) })
    if (!child) {
      return NextResponse.json({ error: 'Flavour line not found' }, { status: 404 })
    }
    const ch = child as Record<string, any>
    if (!ch.parentBatchId || normalizeBatchType(ch) !== 'flavoured') {
      return NextResponse.json({ error: 'Not a flavoured output batch' }, { status: 400 })
    }

    const parent = await db.collection('jaba_batches').findOne({ _id: new ObjectId(ch.parentBatchId) })
    if (!parent) {
      return NextResponse.json({ error: 'Parent batch missing' }, { status: 400 })
    }
    const par = parent as Record<string, any>

    const oldQty = Number(ch.infusedQuantityLitres ?? ch.totalLitres) || 0
    const delta = newQty - oldQty
    const parentRemaining = getNeutralRemainingLitres(par)
    if (delta > parentRemaining + 1e-6) {
      return NextResponse.json(
        { error: `Increase of ${delta}L exceeds parent remaining ${parentRemaining.toFixed(2)}L` },
        { status: 400 }
      )
    }

    const newParentAllocated = (Number(par.infusedAllocatedLitres) || 0) + delta
    const produced = Number(par.totalLitres) || 0
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

    const nextParentStatus = parentStatusAfterFlavourAllocation(
      String(par.status),
      neutralLeft,
      newParentAllocated
    )

    await db.collection('jaba_batches').updateOne(
      { _id: new ObjectId(ch.parentBatchId) },
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

    const line = await db.collection(JABA_FLAVOUR_LINES_COLLECTION).findOne({ _id: new ObjectId(id) })
    if (line) {
      const qty = Number(line.allocatedLitres) || 0
      const parentId = String(line.parentBatchId)
      await db.collection(JABA_FLAVOUR_LINES_COLLECTION).deleteOne({ _id: new ObjectId(id) })

      const parent = await db.collection('jaba_batches').findOne({ _id: new ObjectId(parentId) })
      if (parent) {
        const newAllocated = Math.max(0, (Number(parent.infusedAllocatedLitres) || 0) - qty)
        const produced = Number(parent.totalLitres) || 0
        const neutralLeft = Math.max(0, produced - newAllocated)
        const nextParentStatus = parentStatusAfterFlavourAllocation(
          String(parent.status),
          neutralLeft,
          newAllocated
        )
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
    }

    const child = await db.collection('jaba_batches').findOne({ _id: new ObjectId(id) })
    if (!child) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!child.parentBatchId) {
      return NextResponse.json({ error: 'Only flavoured outputs can be deleted here' }, { status: 400 })
    }

    const qty = Number(child.infusedQuantityLitres ?? child.totalLitres) || 0
    const parentId = child.parentBatchId

    await db.collection('jaba_batches').deleteOne({ _id: new ObjectId(id) })

    const parent = await db.collection('jaba_batches').findOne({ _id: new ObjectId(parentId) })
    if (parent) {
      const newAllocated = Math.max(0, (Number(parent.infusedAllocatedLitres) || 0) - qty)
      const produced = Number(parent.totalLitres) || 0
      const neutralLeft = Math.max(0, produced - newAllocated)
      const nextParentStatus = parentStatusAfterFlavourAllocation(
        String(parent.status),
        neutralLeft,
        newAllocated
      )

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
