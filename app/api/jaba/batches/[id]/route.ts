import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireJabaAction, requireJabaSuperAdminDb } from '@/lib/api-jaba-permissions'
import {
  NEUTRAL_BATCH_DISPLAY_FLAVOR,
  normalizeBatchType,
  isLegacyFlavourFirstBatch,
  getInfusedAllocated,
  getNeutralRemainingLitres,
} from '@/lib/jaba-batch-utils'
import { JABA_FLAVOUR_LINES_COLLECTION } from '@/lib/jaba-flavour-lines'
import { loadMergedFlavourRowsForParent } from '@/lib/jaba-flavour-lines-server'
import { requireDeleteOtp } from '@/lib/jaba-delete-otp-guard'
import { purgeJabaBatchGraphByRootId } from '@/lib/jaba-purge-batch-graph'
import { JABA_PURGE_MONGODB_TRANSACTIONS_REQUIRED_CODE } from '@/lib/jaba-purge-constants'
import { enrichIngredientsCosts } from '@/lib/jaba-ingredient-costs'
import {
  JABA_DUPLICATE_BATCH_NUMBER_MESSAGE,
  isMongoDuplicateKeyError,
  normalizeJabaBatchNumber,
} from '@/lib/jaba-batch-number'

export const runtime = 'nodejs'

function serializeBatchDoc(batch: any) {
  return {
    ...batch,
    _id: batch._id.toString(),
    id: batch._id.toString(),
    date: batch.date instanceof Date ? batch.date.toISOString() : batch.date,
    productionDate:
      batch.productionDate instanceof Date
        ? batch.productionDate.toISOString()
        : batch.productionDate,
    infusionDate:
      batch.infusionDate instanceof Date ? batch.infusionDate.toISOString() : batch.infusionDate,
    productionStartTime:
      batch.productionStartTime instanceof Date
        ? batch.productionStartTime.toISOString()
        : batch.productionStartTime,
    productionEndTime:
      batch.productionEndTime instanceof Date
        ? batch.productionEndTime.toISOString()
        : batch.productionEndTime,
    packagingTime:
      batch.packagingTime instanceof Date ? batch.packagingTime.toISOString() : batch.packagingTime,
    createdAt: batch.createdAt instanceof Date ? batch.createdAt.toISOString() : batch.createdAt,
    updatedAt: batch.updatedAt instanceof Date ? batch.updatedAt.toISOString() : batch.updatedAt,
  }
}

// PUT update batch by ID
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireJabaAction('production.batches', 'edit')
  if ('response' in authResult) return authResult.response

  try {
    const { id } = await params
    const body = await request.json()
    const {
      status,
      batchNumber,
      date,
      flavor,
      totalLitres,
      supervisor,
      shift,
      ingredients,
      tankNumber,
      productionDate,
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Batch ID is required' },
        { status: 400 }
      )
    }

    console.log('[Batches API] Updating batch ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if batch exists
    const existing = await db.collection('jaba_batches').findOne({ _id: new ObjectId(id) })
    if (!existing) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    // Prevent editing if batch is processed (locked)
    if (existing.status === 'Processed' || existing.locked === true) {
      return NextResponse.json(
        { error: 'Cannot edit a processed batch. Batch is locked after processing.' },
        { status: 403 }
      )
    }

    // Prepare update data - allow partial updates
    const updateData: any = {
      updatedAt: new Date(),
    }

    // Standard batch field updates (if provided)
    if (status !== undefined) {
      updateData.status = status
      
      // Lock batch when status becomes "Processed"
      if (status === 'Processed') {
        updateData.locked = true
        console.log(`[Batches API] 🔒 Batch ${id} locked (status: Processed)`)
      }
    }
    if (batchNumber !== undefined) {
      const normalizedEdit = normalizeJabaBatchNumber(batchNumber)
      if (!normalizedEdit) {
        return NextResponse.json({ error: 'Batch number cannot be empty' }, { status: 400 })
      }
      const taken = await db.collection('jaba_batches').findOne({
        batchNumber: normalizedEdit,
        _id: { $ne: new ObjectId(id) },
      })
      if (taken) {
        return NextResponse.json(
          {
            error: JABA_DUPLICATE_BATCH_NUMBER_MESSAGE,
            code: 'DUPLICATE_BATCH_NUMBER',
          },
          { status: 409 }
        )
      }
      updateData.batchNumber = normalizedEdit
    }
    if (date !== undefined) {
      updateData.date = new Date(date)
    }
    if (flavor !== undefined) {
      updateData.flavor = flavor
    }
    // Allow setting expectedLitres explicitly (for fixing older batches)
    if (body.expectedLitres !== undefined) {
      updateData.expectedLitres = Number(body.expectedLitres)
    }
    if (totalLitres !== undefined) {
      const newTotalLitres = Number(totalLitres)
      const infused = Number((existing as any).infusedAllocatedLitres) || 0
      if (!existing.parentBatchId && newTotalLitres + 1e-6 < infused) {
        return NextResponse.json(
          {
            error: `Produced volume (${newTotalLitres}L) cannot be less than already allocated to flavours (${infused.toFixed(2)}L).`,
          },
          { status: 400 }
        )
      }

      if (!existing.expectedLitres && !updateData.expectedLitres) {
        if (status === 'Processed' || existing.status === 'Processing') {
          updateData.expectedLitres = existing.totalLitres || newTotalLitres
        }
      }

      updateData.totalLitres = newTotalLitres
      if (!existing.parentBatchId) {
        updateData['outputSummary.remainingLitres'] = Math.max(0, newTotalLitres - infused)
      } else {
        updateData['outputSummary.remainingLitres'] = newTotalLitres
      }
    }
    // Handle production variance reason
    if (body.productionVarianceReason !== undefined) {
      updateData.productionVarianceReason = body.productionVarianceReason?.trim() || null
    }
    if (supervisor !== undefined) {
      updateData.supervisor = supervisor
    }
    if (shift !== undefined) {
      updateData.shift = shift
    }
    if (ingredients !== undefined && Array.isArray(ingredients)) {
      // Calculate material deltas and adjust inventory accordingly
      const oldIngredients = existing.ingredients || []
      const newIngredients = ingredients
      const inventoryMovements: any[] = []
      
      // Create maps for easier comparison
      const oldMap = new Map<string, { materialId?: string; quantity: number; unit: string }>()
      const newMap = new Map<string, { materialId?: string; quantity: number; unit: string }>()
      
      oldIngredients.forEach((ing: any) => {
        const key = ing.materialId || ing.material
        oldMap.set(key, {
          materialId: ing.materialId,
          quantity: Number(ing.quantity) || 0,
          unit: ing.unit || ''
        })
      })
      
      newIngredients.forEach((ing: any) => {
        const key = ing.materialId || ing.material
        newMap.set(key, {
          materialId: ing.materialId,
          quantity: Number(ing.quantity) || 0,
          unit: ing.unit || ''
        })
      })
      
      // Process all materials (old and new) to find deltas
      const allMaterialKeys = new Set([...oldMap.keys(), ...newMap.keys()])
      
      for (const materialKey of allMaterialKeys) {
        const oldIng = oldMap.get(materialKey)
        const newIng = newMap.get(materialKey)
        const oldQty = oldIng?.quantity || 0
        const newQty = newIng?.quantity || 0
        const delta = newQty - oldQty
        
        if (delta === 0) continue // No change
        
        // Find material
        let material
        const materialId = newIng?.materialId || oldIng?.materialId
        const materialName = newIngredients.find((ing: any) => (ing.materialId || ing.material) === materialKey)?.material ||
                            oldIngredients.find((ing: any) => (ing.materialId || ing.material) === materialKey)?.material
        
        if (materialId) {
          try {
            material = await db.collection('jaba_rawMaterials').findOne({ 
              _id: new ObjectId(materialId) 
            })
          } catch (e) {
            material = await db.collection('jaba_rawMaterials').findOne({ 
              name: { $regex: new RegExp(`^${materialName}$`, 'i') }
            })
          }
        } else if (materialName) {
          material = await db.collection('jaba_rawMaterials').findOne({ 
            name: { $regex: new RegExp(`^${materialName}$`, 'i') }
          })
        }
        
        if (!material) {
          console.warn(`[Batches API] Material not found for key: ${materialKey}`)
          continue
        }
        
        const beforeStock = material.currentStock
        
        if (delta > 0) {
          // Need to deduct more (newQty > oldQty)
          if (beforeStock < delta) {
            return NextResponse.json(
              { 
                error: `Insufficient stock for "${material.name}". Available: ${beforeStock} ${material.unit}, Required additional: ${delta} ${material.unit}` 
              },
              { status: 400 }
            )
          }
          const deductResult = await db.collection('jaba_rawMaterials').updateOne(
            { _id: material._id, currentStock: { $gte: delta } },
            {
              $inc: { currentStock: -delta },
              $set: { updatedAt: new Date() }
            }
          )
          if (deductResult.modifiedCount !== 1) {
            return NextResponse.json(
              { error: `Stock changed while editing batch for "${material.name}". Please refresh and try again.` },
              { status: 409 }
            )
          }
          const afterStock = beforeStock - delta
          
          inventoryMovements.push({
            type: 'DEDUCTION',
            reason: 'BATCH_EDITED',
            batchId: id,
            batchNumber: existing.batchNumber,
            materialId: material._id.toString(),
            materialName: material.name,
            quantity: delta,
            unit: material.unit,
            beforeStock: beforeStock,
            afterStock: afterStock,
            userId: 'system',
            timestamp: new Date(),
            createdAt: new Date(),
          })
          
          console.log(`[Batches API] Deducted ${delta} ${material.unit} of ${material.name}. Stock: ${beforeStock} → ${afterStock}`)
        } else {
          // Need to refund (newQty < oldQty or material removed)
          const refundQty = Math.abs(delta)
          const afterStock = beforeStock + refundQty
          await db.collection('jaba_rawMaterials').updateOne(
            { _id: material._id },
            {
              $inc: { currentStock: refundQty },
              $set: { updatedAt: new Date() }
            }
          )
          
          inventoryMovements.push({
            type: 'ADJUSTMENT',
            reason: 'BATCH_EDITED',
            batchId: id,
            batchNumber: existing.batchNumber,
            materialId: material._id.toString(),
            materialName: material.name,
            quantity: refundQty, // Positive for refund
            unit: material.unit,
            beforeStock: beforeStock,
            afterStock: afterStock,
            userId: 'system',
            timestamp: new Date(),
            createdAt: new Date(),
          })
          
          console.log(`[Batches API] Refunded ${refundQty} ${material.unit} of ${material.name}. Stock: ${beforeStock} → ${afterStock}`)
        }
      }
      
      // Save inventory movements
      if (inventoryMovements.length > 0) {
        await db.collection('jaba_inventory_movements').insertMany(inventoryMovements)
      }
      
      updateData.ingredients = await enrichIngredientsCosts(db, ingredients)
    }
    if (tankNumber !== undefined) {
      updateData.tankNumber = tankNumber.trim()
    }
    if (productionDate !== undefined) {
      updateData.productionDate = new Date(productionDate)
    }

    // Update batch
    try {
      await db.collection('jaba_batches').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      )
    } catch (updErr: unknown) {
      if (isMongoDuplicateKeyError(updErr)) {
        return NextResponse.json(
          {
            error: JABA_DUPLICATE_BATCH_NUMBER_MESSAGE,
            code: 'DUPLICATE_BATCH_NUMBER',
          },
          { status: 409 }
        )
      }
      throw updErr
    }

    console.log(`[Batches API] ✅ Batch updated successfully: ${id}`)

    // Fetch updated batch
    const updated = await db.collection('jaba_batches').findOne({ _id: new ObjectId(id) })

    return NextResponse.json(
      { 
        success: true,
        batch: {
          ...updated,
          _id: updated!._id.toString(),
          id: updated!._id.toString(),
          date: updated!.date instanceof Date ? updated!.date.toISOString() : updated!.date,
        }
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[Batches API] ❌ Error updating batch:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update batch',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// GET batch by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireJabaAction('production.batches', 'view')
  if ('response' in authResult) return authResult.response

  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Batch ID is required' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    const batch = await db.collection('jaba_batches').findOne({ _id: new ObjectId(id) })

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    const bdoc = batch as Record<string, any>
    const sid = batch._id.toString()
    let flavourOutputs: any[] = []
    let parentBatchSummary: any = null

    if (!batch.parentBatchId) {
      const lineMongoIds = await db
        .collection(JABA_FLAVOUR_LINES_COLLECTION)
        .find({ parentBatchId: sid })
        .project({ _id: 1 })
        .toArray()
      const legacyKids = await db.collection('jaba_batches').find({ parentBatchId: sid }).toArray()
      const lineIds = lineMongoIds.map((d) => d._id.toString())
      const packOr: Record<string, unknown>[] = [{ batchId: sid }]
      if (legacyKids.length > 0) {
        packOr.push({ batchId: { $in: legacyKids.map((k) => k._id.toString()) } })
      }
      if (lineIds.length > 0) packOr.push({ flavourLineId: { $in: lineIds } })
      const packagingOutputs = await db.collection('jaba_packagingOutput').find({ $or: packOr }).toArray()
      const deliveryNotes = await db.collection('jaba_deliveryNotes').find({}).toArray()
      flavourOutputs = await loadMergedFlavourRowsForParent(db, sid, packagingOutputs, deliveryNotes)
    } else {
      const parent = await db.collection('jaba_batches').findOne({
        _id: new ObjectId(String(batch.parentBatchId)),
      })
      if (parent) {
        const ps = serializeBatchDoc(parent)
        const p = parent as Record<string, any>
        parentBatchSummary = {
          ...ps,
          batchType: normalizeBatchType(p),
          infusedAllocatedLitres: getInfusedAllocated(p),
          neutralRemainingLitres: getNeutralRemainingLitres(p),
          legacyFlavourFirstBatch: isLegacyFlavourFirstBatch(p),
        }
      }
    }

    const bt = normalizeBatchType(bdoc)
    const serialized = serializeBatchDoc(batch)
    const ingredientsDisplay = await enrichIngredientsCosts(db, serialized.ingredients || [])

    return NextResponse.json({
      batch: {
        ...serialized,
        ingredients: ingredientsDisplay,
        batchType: bt,
        legacyFlavourFirstBatch: isLegacyFlavourFirstBatch(bdoc),
        infusedAllocatedLitres: !batch.parentBatchId ? getInfusedAllocated(bdoc) : undefined,
        neutralRemainingLitres: !batch.parentBatchId ? getNeutralRemainingLitres(bdoc) : undefined,
        flavourOutputs,
        parentBatch: parentBatchSummary,
        displayFlavorLabel: batch.flavor || NEUTRAL_BATCH_DISPLAY_FLAVOR,
      },
    })
  } catch (error: any) {
    console.error('[Batches API] ❌ Error fetching batch:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch batch',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// DELETE batch by ID — super_admin only (DB role + OTP). Same bar as bulk root purge.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminGate = await requireJabaSuperAdminDb({
    forbiddenMessage: 'Only super admins can delete batches',
  })
  if ('response' in adminGate) return adminGate.response

  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Batch ID is required' },
        { status: 400 }
      )
    }

    const otpCheck = await requireDeleteOtp(request, 'delete_batch', id)
    if ('response' in otpCheck) return otpCheck.response

    console.log('[Batches API] Deleting batch ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const purge = await purgeJabaBatchGraphByRootId(db, id)
    if (!purge.ok) {
      if ('notFound' in purge && purge.notFound) {
        return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      }
      if ('error' in purge) {
        const code = purge.code
        const status =
          code === JABA_PURGE_MONGODB_TRANSACTIONS_REQUIRED_CODE ? 503 : 500
        return NextResponse.json(
          {
            error: purge.error || 'Failed to delete batch',
            ...(code ? { code } : {}),
          },
          { status }
        )
      }
      return NextResponse.json({ error: 'Failed to delete batch' }, { status: 500 })
    }

    console.log(`[Batches API] ✅ Batch deleted successfully: ${purge.batchNumber} (ID: ${id})`)

    return NextResponse.json(
      {
        success: true,
        message: 'Batch and linked records deleted; materials restored to inventory',
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[Batches API] ❌ Error deleting batch:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete batch',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

