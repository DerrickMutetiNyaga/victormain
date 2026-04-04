import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { auth } from '@/lib/auth-jaba'
import { getUserByEmail } from '@/lib/models/user'
import { requireJabaAction } from '@/lib/api-jaba-permissions'
import {
  NEUTRAL_BATCH_DISPLAY_FLAVOR,
  normalizeBatchType,
  isLegacyFlavourFirstBatch,
  getInfusedAllocated,
  getNeutralRemainingLitres,
} from '@/lib/jaba-batch-utils'
import {
  JABA_FLAVOUR_LINES_COLLECTION,
  loadMergedFlavourRowsForParent,
} from '@/lib/jaba-flavour-lines'

export const runtime = 'nodejs'

function serializeBatchDoc(batch: any) {
  return {
    ...batch,
    _id: batch._id.toString(),
    id: batch._id.toString(),
    date: batch.date instanceof Date ? batch.date.toISOString() : batch.date,
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

// PUT update batch by ID (supports QC updates)
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
      qcStatus,
      qcStage,
      qcNotes,
      qcChecklist,
      status,
      // Allow partial updates for QC
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

    // QC-specific updates
    if (qcStatus !== undefined) {
      updateData.qcStatus = qcStatus
    }
    if (qcStage !== undefined) {
      updateData.qcStage = qcStage
    }
    if (qcNotes !== undefined) {
      updateData.qcNotes = qcNotes
    }
    if (qcChecklist !== undefined) {
      updateData.qcChecklist = qcChecklist
    }
    if (qcStage === 'initial' && qcStatus === 'Pass') {
      // After initial QC passes, update status to ready for packaging
      updateData.status = 'QC Passed - Ready for Packaging'
    }
    if (qcStage === 'final' && qcStatus === 'Pass') {
      // After final QC passes, batch is ready for dispatch
      updateData.status = 'Ready for Distribution'
    }
    if (qcStatus === 'Fail') {
      updateData.status = 'QC Failed'
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
      updateData.batchNumber = batchNumber
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
          
          const afterStock = beforeStock - delta
          await db.collection('jaba_rawMaterials').updateOne(
            { _id: material._id },
            { 
              $set: { 
                currentStock: afterStock,
                updatedAt: new Date()
              }
            }
          )
          
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
              $set: { 
                currentStock: afterStock,
                updatedAt: new Date()
              }
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
      
      updateData.ingredients = ingredients
    }
    if (tankNumber !== undefined) {
      updateData.tankNumber = tankNumber.trim()
    }
    if (productionDate !== undefined) {
      updateData.productionDate = new Date(productionDate)
    }

    // Update batch
    await db.collection('jaba_batches').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )
    
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

    return NextResponse.json({
      batch: {
        ...serialized,
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

// DELETE batch by ID - restores materials to inventory
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireJabaAction('production.batches', 'delete')
  if ('response' in authResult) return authResult.response

  try {
    const session = await auth()
    const userEmail = session?.user?.email
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await getUserByEmail(userEmail)
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can delete batches' }, { status: 403 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Batch ID is required' },
        { status: 400 }
      )
    }

    console.log('[Batches API] Deleting batch ID:', id)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Find batch to get ingredients
    const batch = await db.collection('jaba_batches').findOne({ _id: new ObjectId(id) })
    
    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    const batchIdsToDelete = new Set<string>([id])
    const batchNumbersToDelete = new Set<string>([String(batch.batchNumber || '')])
    const flavourLineIdsToDelete = new Set<string>()

    if (!batch.parentBatchId) {
      const legacyChildren = await db.collection('jaba_batches').find({ parentBatchId: id }).toArray()
      for (const child of legacyChildren) {
        batchIdsToDelete.add(String(child._id))
        batchNumbersToDelete.add(String(child.batchNumber || ''))
      }
      const lines = await db
        .collection(JABA_FLAVOUR_LINES_COLLECTION)
        .find({ parentBatchId: id })
        .project({ _id: 1 })
        .toArray()
      for (const line of lines) {
        flavourLineIdsToDelete.add(String(line._id))
      }
    }

    // Restore materials for every batch row we are deleting.
    const batchDocsToDelete = await db
      .collection('jaba_batches')
      .find({ _id: { $in: Array.from(batchIdsToDelete).map((x) => new ObjectId(x)) } })
      .toArray()

    for (const b of batchDocsToDelete) {
      if (!b.ingredients || !Array.isArray(b.ingredients) || b.ingredients.length === 0) continue
      for (const ingredient of b.ingredients) {
        const materialName = ingredient.material
        const quantity = Number(ingredient.quantity)
        if (!materialName || quantity <= 0) continue

        let material
        if (ingredient.materialId) {
          try {
            material = await db.collection('jaba_rawMaterials').findOne({
              _id: new ObjectId(ingredient.materialId),
            })
          } catch {
            material = await db.collection('jaba_rawMaterials').findOne({
              name: { $regex: new RegExp(`^${materialName}$`, 'i') },
            })
          }
        } else {
          material = await db.collection('jaba_rawMaterials').findOne({
            name: { $regex: new RegExp(`^${materialName}$`, 'i') },
          })
        }
        if (!material) continue

        const newStock = material.currentStock + quantity
        await db.collection('jaba_rawMaterials').updateOne(
          { _id: material._id },
          { $set: { currentStock: newStock, updatedAt: new Date() } }
        )
      }
    }

    // Delete packaging outputs linked to this batch graph.
    const packagingOr: Record<string, unknown>[] = [
      { batchId: { $in: Array.from(batchIdsToDelete) } },
      { batchNumber: { $in: Array.from(batchNumbersToDelete).filter(Boolean) } },
    ]
    if (flavourLineIdsToDelete.size > 0) {
      packagingOr.push({ flavourLineId: { $in: Array.from(flavourLineIdsToDelete) } })
    }
    await db.collection('jaba_packagingOutput').deleteMany({ $or: packagingOr })

    // Remove delivery-note items linked to this batch; delete notes that become empty.
    const linkedBatchNumbers = new Set(Array.from(batchNumbersToDelete).filter(Boolean))
    const linkedFlavourLineIds = new Set(Array.from(flavourLineIdsToDelete))
    const notes = await db.collection('jaba_deliveryNotes').find({}).toArray()
    for (const note of notes) {
      const items = Array.isArray(note.items) ? note.items : []
      const keptItems = items.filter((item: any) => {
        const itemBatch = String(item?.batchNumber || '')
        const itemFl = String(item?.flavourLineId || '')
        return !linkedBatchNumbers.has(itemBatch) && !(itemFl && linkedFlavourLineIds.has(itemFl))
      })
      if (keptItems.length === items.length) continue

      if (keptItems.length === 0) {
        await db.collection('jaba_deliveryNotes').deleteOne({ _id: note._id })
      } else {
        const nextTotalCost = keptItems.reduce((sum: number, it: any) => {
          const explicit = Number(it.totalCost)
          if (!Number.isNaN(explicit) && explicit > 0) return sum + explicit
          return sum + ((Number(it.quantity) || 0) * (Number(it.pricePerUnit) || 0))
        }, 0)
        await db.collection('jaba_deliveryNotes').updateOne(
          { _id: note._id },
          { $set: { items: keptItems, totalCost: nextTotalCost, updatedAt: new Date() } }
        )
      }
    }

    // Delete movement logs linked to batch ids / numbers.
    await db.collection('jaba_inventory_movements').deleteMany({
      $or: [
        { batchId: { $in: Array.from(batchIdsToDelete) } },
        { batchNumber: { $in: Array.from(batchNumbersToDelete).filter(Boolean) } },
      ],
    })

    // Remove flavour lines for neutral parent deletion.
    if (!batch.parentBatchId) {
      await db.collection(JABA_FLAVOUR_LINES_COLLECTION).deleteMany({ parentBatchId: id })
    }

    // Delete selected batch and any legacy child batches.
    const result = await db.collection('jaba_batches').deleteMany({
      _id: { $in: Array.from(batchIdsToDelete).map((x) => new ObjectId(x)) },
    })
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    console.log(`[Batches API] ✅ Batch deleted successfully: ${batch.batchNumber} (ID: ${id})`)

    return NextResponse.json(
      { 
        success: true,
        message: 'Batch and linked records deleted; materials restored to inventory'
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

