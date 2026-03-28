import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireJabaAction } from '@/lib/api-jaba-permissions'
import {
  NEUTRAL_BATCH_DISPLAY_FLAVOR,
  normalizeBatchType,
  isLegacyFlavourFirstBatch,
  getNeutralRemainingLitres,
  getInfusedAllocated,
} from '@/lib/jaba-batch-utils'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const authResult = await requireJabaAction('production.batches', 'view')
  if ('response' in authResult) return authResult.response
  try {
    const { searchParams } = new URL(request.url)
    const nextNumber = searchParams.get('nextNumber')
    
    // If requesting next batch number, return sequential number for current year
    if (nextNumber === 'true') {
      const currentYear = new Date().getFullYear()
      const yearPrefix = `BCH-${currentYear}-`
      
      console.log('Getting next batch number for year:', currentYear)
      
      let client
      try {
        client = await clientPromise
        console.log('Connected to MongoDB')
      } catch (connectError: any) {
        console.error('MongoDB connection error:', connectError)
        throw new Error(`MongoDB connection failed: ${connectError.message}. Please check your connection string and network access.`)
      }
      
      const db = client.db('infusion_jaba')
      
      // Find all batches for the current year
      const batches = await db.collection('jaba_batches')
        .find({ batchNumber: { $regex: `^${yearPrefix}` } })
        .toArray()
      
      // Extract the numeric part from each batch number and find the maximum
      let maxNumber = 0
      batches.forEach(batch => {
        const match = batch.batchNumber.match(new RegExp(`^${yearPrefix}(\\d+)$`))
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > maxNumber) {
            maxNumber = num
          }
        }
      })
      
      // Next number is maxNumber + 1, or 1 if no batches exist for this year
      const nextNum = maxNumber + 1
      const nextBatchNumber = `${yearPrefix}${String(nextNum).padStart(5, '0')}`
      
      console.log(`Next batch number: ${nextBatchNumber} (current max: ${maxNumber})`)
      
      return NextResponse.json({ 
        nextBatchNumber,
        year: currentYear,
        sequenceNumber: nextNum
      })
    }
    
    // Otherwise, return list of batches (existing functionality)
    const flavor = searchParams.get('flavor')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    console.log('Connecting to MongoDB...')
    let client
    try {
      client = await clientPromise
      console.log('Connected to MongoDB')
    } catch (connectError: any) {
      console.error('MongoDB connection error:', connectError)
      throw new Error(`MongoDB connection failed: ${connectError.message}. Please check your connection string and network access.`)
    }
    
    const db = client.db('infusion_jaba')
    console.log('Using database: infusion_jaba')
    
    const rootQuery: any = {
      $or: [{ parentBatchId: null }, { parentBatchId: { $exists: false } }],
    }

    if (status && status !== 'all') {
      rootQuery.status = status
    }

    console.log('Querying jaba_batches (roots):', JSON.stringify(rootQuery))
    let roots = await db.collection('jaba_batches').find(rootQuery).sort({ date: -1 }).toArray()

    const rootIds = roots.map((r) => r._id.toString())
    const allChildren =
      rootIds.length > 0
        ? await db
            .collection('jaba_batches')
            .find({ parentBatchId: { $in: rootIds } })
            .sort({ infusionDate: -1, createdAt: -1 })
            .toArray()
        : []

    const childrenByParent = new Map<string, any[]>()
    for (const c of allChildren) {
      const pid = String(c.parentBatchId)
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
      childrenByParent.get(pid)!.push(c)
    }

    const serializeDates = (batch: any) => ({
      ...batch,
      id: batch._id.toString(),
      _id: batch._id.toString(),
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
    })

    if (flavor && flavor !== 'all') {
      roots = roots.filter((r) => {
        const id = r._id.toString()
        const kids = childrenByParent.get(id) || []
        if (r.flavor === flavor) return true
        return kids.some((k) => k.flavor === flavor)
      })
    }

    if (search) {
      const q = search.toLowerCase()
      roots = roots.filter((r) => {
        const id = r._id.toString()
        const kids = childrenByParent.get(id) || []
        if ((r.batchNumber || '').toLowerCase().includes(q)) return true
        if ((r.flavor || '').toLowerCase().includes(q)) return true
        return kids.some(
          (k) =>
            (k.batchNumber || '').toLowerCase().includes(q) || (k.flavor || '').toLowerCase().includes(q)
        )
      })
    }

    const formattedBatches = roots.map((batch) => {
      const id = batch._id.toString()
      const bt = normalizeBatchType(batch)
      const legacy = isLegacyFlavourFirstBatch(batch)
      const kids = (childrenByParent.get(id) || []).map(serializeDates)
      const infused = getInfusedAllocated(batch)
      const neutralRemainingLitres =
        bt === 'neutral' && !batch.parentBatchId ? getNeutralRemainingLitres(batch) : 0

      return {
        ...serializeDates(batch),
        batchType: bt,
        legacyFlavourFirstBatch: legacy,
        infusedAllocatedLitres: infused,
        neutralRemainingLitres,
        flavourOutputCount: kids.length,
        flavourOutputs: kids,
      }
    })

    console.log(`Found ${formattedBatches.length} root batches`)

    return NextResponse.json({ batches: formattedBatches })
  } catch (error: any) {
    console.error('Error fetching batches:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch batches',
        details: error.message || String(error),
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const authResult = await requireJabaAction('production.addBatch', 'add')
  if ('response' in authResult) return authResult.response

  try {
    const body = await request.json()
    const {
      batchNumber,
      date,
      totalLitres,
      supervisor,
      shift,
      tankNumber,
      status,
      ingredients,
      notes,
    } = body

    // Validate required fields (neutral/base batch — no flavour at creation)
    if (!batchNumber || !date || !totalLitres || !supervisor || !shift || !tankNumber) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const flavor = NEUTRAL_BATCH_DISPLAY_FLAVOR

    console.log('[Batches API] Creating new batch:', batchNumber)

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Validate and deduct materials IMMEDIATELY on batch creation
    const inventoryMovements: any[] = []
    
    if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
      // First pass: Validate all materials have sufficient stock
      for (const ingredient of ingredients) {
        const materialName = ingredient.material
        const quantity = Number(ingredient.quantity)
        
        if (!materialName || quantity <= 0) {
          continue
        }

        // Find material by name or ID
        let material
        if (ingredient.materialId) {
          try {
            material = await db.collection('jaba_rawMaterials').findOne({ 
              _id: new ObjectId(ingredient.materialId) 
            })
          } catch (e) {
            material = await db.collection('jaba_rawMaterials').findOne({ 
              name: { $regex: new RegExp(`^${materialName}$`, 'i') }
            })
          }
        } else {
          material = await db.collection('jaba_rawMaterials').findOne({ 
            name: { $regex: new RegExp(`^${materialName}$`, 'i') }
          })
        }

        if (!material) {
          return NextResponse.json(
            { error: `Raw material "${materialName}" not found in inventory` },
            { status: 400 }
          )
        }

        // Validate stock availability BEFORE creating batch
        if (material.currentStock < quantity) {
          return NextResponse.json(
            { 
              error: `Insufficient stock for "${materialName}". Available: ${material.currentStock} ${material.unit}, Required: ${quantity} ${material.unit}` 
            },
            { status: 400 }
          )
        }
      }

      // Second pass: Deduct materials from inventory (atomic operation)
      for (const ingredient of ingredients) {
        const materialName = ingredient.material
        const quantity = Number(ingredient.quantity)
        
        if (!materialName || quantity <= 0) {
          continue
        }

        let material
        if (ingredient.materialId) {
          try {
            material = await db.collection('jaba_rawMaterials').findOne({ 
              _id: new ObjectId(ingredient.materialId) 
            })
          } catch (e) {
            material = await db.collection('jaba_rawMaterials').findOne({ 
              name: { $regex: new RegExp(`^${materialName}$`, 'i') }
            })
          }
        } else {
          material = await db.collection('jaba_rawMaterials').findOne({ 
            name: { $regex: new RegExp(`^${materialName}$`, 'i') }
          })
        }

        if (material) {
          const beforeStock = material.currentStock
          const afterStock = Math.max(0, beforeStock - quantity)
          
          // Deduct from inventory
          await db.collection('jaba_rawMaterials').updateOne(
            { _id: material._id },
            { 
              $set: { 
                currentStock: afterStock,
                updatedAt: new Date()
              }
            }
          )
          
          // Create inventory movement record for audit
          const movement = {
            type: 'DEDUCTION',
            reason: 'BATCH_CREATED',
            batchId: null, // Will be set after batch is created
            batchNumber: batchNumber,
            materialId: material._id.toString(),
            materialName: materialName,
            quantity: quantity,
            unit: material.unit,
            beforeStock: beforeStock,
            afterStock: afterStock,
            userId: 'system', // TODO: Get from auth session
            timestamp: new Date(),
            createdAt: new Date(),
          }
          inventoryMovements.push(movement)
          
          console.log(`[Batches API] ✅ Deducted ${quantity} ${material.unit} of ${materialName}. Stock: ${beforeStock} → ${afterStock}`)
        }
      }
    }

    // Prepare batch document
    const vol = Number(totalLitres)
    const batchData = {
      batchNumber,
      date: new Date(date),
      flavor,
      batchType: 'neutral' as const,
      parentBatchId: null as null,
      infusedAllocatedLitres: 0,
      infusionAllocationStatus: 'none' as const,
      notes: typeof notes === 'string' ? notes.trim() || null : null,
      productCategory: 'Infusion Jaba',
      expectedLitres: vol,
      totalLitres: vol,
      bottles500ml: 0,
      bottles1L: 0,
      bottles2L: 0,
      status: status || 'Processing',
      qcStatus: 'Pending',
      supervisor,
      shift,
      tankNumber: tankNumber.trim(),
      ingredients: ingredients || [],
      locked: false,
      outputSummary: {
        totalBottles: 0,
        remainingLitres: vol,
        breakdown: [],
      },
      createdAt: new Date(),
    }

    // Insert batch
    const result = await db.collection('jaba_batches').insertOne(batchData)
    const batchId = result.insertedId.toString()
    
    // Update inventory movements with batchId
    if (inventoryMovements.length > 0) {
      for (const movement of inventoryMovements) {
        movement.batchId = batchId
        await db.collection('jaba_inventory_movements').insertOne(movement)
      }
    }
    
    console.log(`[Batches API] ✅ Batch created successfully: ${batchNumber} (ID: ${batchId})`)

    return NextResponse.json(
      { 
        success: true,
        batch: {
          ...batchData,
          _id: result.insertedId.toString(),
          id: result.insertedId.toString(),
        }
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[Batches API] ❌ Error creating batch:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create batch',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// PUT update batch
export async function PUT(request: Request) {
  const authResult = await requireJabaAction('production.batches', 'edit')
  if ('response' in authResult) return authResult.response

  try {
    const body = await request.json()
    const {
      id,
      batchNumber,
      date,
      flavor,
      expectedLitres,
      totalLitres,
      supervisor,
      shift,
      status,
      ingredients,
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Batch ID is required' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!batchNumber || !date || !totalLitres || !supervisor || !shift) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('[Batches API] Updating batch:', batchNumber, 'ID:', id)

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

    const resolvedFlavor =
      flavor !== undefined && String(flavor).trim()
        ? String(flavor).trim()
        : (existing.flavor as string) || NEUTRAL_BATCH_DISPLAY_FLAVOR

    const newTotal = Number(totalLitres)
    const infused = Number((existing as any).infusedAllocatedLitres) || 0

    // Prepare update data
    const updateData: any = {
      batchNumber,
      date: new Date(date),
      flavor: resolvedFlavor,
      productCategory: 'Infusion Jaba',
      totalLitres: newTotal,
      supervisor,
      shift,
      status: status || existing.status,
      ingredients: ingredients || existing.ingredients,
      updatedAt: new Date(),
    }

    if (!(existing as any).parentBatchId) {
      updateData['outputSummary.remainingLitres'] = Math.max(0, newTotal - infused)
    }
    
    // Handle expectedLitres - preserve if exists, or set if provided
    if (expectedLitres !== undefined) {
      updateData.expectedLitres = Number(expectedLitres)
    } else if (!existing.expectedLitres) {
      // If expectedLitres wasn't provided and doesn't exist, set it to totalLitres
      // This handles older batches that don't have expectedLitres
      updateData.expectedLitres = Number(totalLitres)
    }
    // If expectedLitres exists and wasn't provided, don't overwrite it

    // Update batch
    await db.collection('jaba_batches').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )
    
    console.log(`[Batches API] ✅ Batch updated successfully: ${batchNumber}`)

    return NextResponse.json(
      { 
        success: true,
        batch: {
          ...updateData,
          _id: id,
          id: id,
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

