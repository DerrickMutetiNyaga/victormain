import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// POST create delivery note
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      noteId,
      distributorId,
      distributorName,
      items,
      vehicle,
      driver,
      driverPhone,
      notes,
      date,
    } = body

    // Validate required fields
    if (!noteId || !distributorId || !distributorName || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: noteId, distributorId, distributorName, and items are required' },
        { status: 400 }
      )
    }

    // Validate items have quantities
    const itemsWithQuantities = items.filter((item: any) => item.quantity > 0)
    if (itemsWithQuantities.length === 0) {
      return NextResponse.json(
        { error: 'At least one item must have a quantity greater than 0' },
        { status: 400 }
      )
    }

    // Initialize database connection FIRST
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // CRITICAL: Validate quantities against available stock before creating delivery note
    console.log('[Delivery Notes API] Validating stock availability for delivery note:', noteId)
    
    try {
      // Get all packaging outputs to calculate available quantities
      const packagingOutputs = await db.collection('jaba_packagingOutput').find({}).toArray()
      
      // Get all batches to map batchId to batchNumber
      const allBatches = await db.collection('jaba_batches').find({}).toArray()
      const batchIdToBatchNumber = new Map<string, string>()
      allBatches.forEach((batch: any) => {
        batchIdToBatchNumber.set(batch._id.toString(), batch.batchNumber)
      })
      
      // Get all existing delivery notes to calculate already distributed quantities
      const existingDeliveryNotes = await db.collection('jaba_deliveryNotes').find({}).toArray()
      
      // Validate each item
      for (const item of itemsWithQuantities) {
        const requestedQty = Number(item.quantity) || 0
        if (requestedQty <= 0) continue
        
        // Calculate total packaged for this batch + size
        let totalPackaged = 0
        packagingOutputs.forEach((output: any) => {
          // Match by batchNumber - get batchNumber from batchId
          const outputBatchNumber = batchIdToBatchNumber.get(output.batchId?.toString() || '') || 
                                   output.batchNumber || 
                                   (output.batch && output.batch.batchNumber)
          
          if (outputBatchNumber === item.batchNumber && output.containers && Array.isArray(output.containers)) {
            output.containers.forEach((container: any) => {
              if (container.size === item.size) {
                totalPackaged += Number(container.quantity) || 0
              }
            })
          }
        })
        
        // Calculate already distributed for this batch + size
        let alreadyDistributed = 0
        existingDeliveryNotes.forEach((note: any) => {
          if (note.items && Array.isArray(note.items)) {
            note.items.forEach((noteItem: any) => {
              if (noteItem.batchNumber === item.batchNumber && noteItem.size === item.size) {
                alreadyDistributed += Number(noteItem.quantity) || 0
              }
            })
          }
        })
        
        // Calculate available quantity
        const availableQuantity = Math.max(0, totalPackaged - alreadyDistributed)
        
        // Validate
        if (requestedQty > availableQuantity) {
          return NextResponse.json(
            { 
              error: `Insufficient stock for ${item.productName || item.size} (Batch: ${item.batchNumber}). Available: ${availableQuantity.toLocaleString()}, Requested: ${requestedQty.toLocaleString()}` 
            },
            { status: 400 }
          )
        }
      }
    } catch (validationError: any) {
      console.error('[Delivery Notes API] Error during stock validation:', validationError)
      return NextResponse.json(
        {
          error: 'Failed to validate stock availability',
          details: validationError.message || String(validationError),
        },
        { status: 500 }
      )
    }

    console.log('[Delivery Notes API] Stock validation passed. Creating delivery note:', noteId)

    // Check if note ID already exists
    const existing = await db.collection('jaba_deliveryNotes').findOne({ noteId: noteId.trim() })
    if (existing) {
      return NextResponse.json(
        { error: 'Delivery note with this ID already exists' },
        { status: 400 }
      )
    }

    // Calculate total cost from items
    const totalCost = itemsWithQuantities.reduce((sum: number, item: any) => {
      const itemCost = (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0)
      return sum + itemCost
    }, 0)

    // Prepare delivery note document
    const deliveryNoteData = {
      noteId: noteId.trim(),
      distributorId: distributorId.trim(),
      distributorName: distributorName.trim(),
      items: itemsWithQuantities.map((item: any) => ({
        finishedGoodId: item.finishedGoodId,
        productName: item.productName || '',
        flavor: item.flavor || '',
        productType: item.productType || '',
        size: item.size,
        batchNumber: item.batchNumber || '',
        packageNumber: item.packageNumber || '',
        quantity: Number(item.quantity),
        pricePerUnit: Number(item.pricePerUnit) || 0,
        totalCost: (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0),
      })),
      totalCost: totalCost,
      vehicle: vehicle?.trim() || undefined,
      driver: driver?.trim() || undefined,
      driverPhone: driverPhone?.trim() || undefined,
      notes: notes?.trim() || undefined,
      date: date ? new Date(date) : new Date(),
      status: 'Pending',
      paymentStatus: 'Unpaid', // Payment tracking: Unpaid, Partial, Paid
      paymentDate: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Insert delivery note
    const result = await db.collection('jaba_deliveryNotes').insertOne(deliveryNoteData)
    
    console.log(`[Delivery Notes API] ✅ Delivery note created successfully: ${noteId} (ID: ${result.insertedId})`)

    return NextResponse.json(
      {
        success: true,
        deliveryNote: {
          ...deliveryNoteData,
          _id: result.insertedId.toString(),
          id: result.insertedId.toString(),
        }
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[Delivery Notes API] ❌ Error creating delivery note:', error)
    console.error('[Delivery Notes API] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    return NextResponse.json(
      {
        error: 'Failed to create delivery note',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// GET delivery notes
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const distributorId = searchParams.get('distributorId')
    const status = searchParams.get('status')

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const query: any = {}
    if (distributorId) {
      query.distributorId = distributorId
    }
    if (status) {
      query.status = status
    }

    const deliveryNotes = await db.collection('jaba_deliveryNotes')
      .find(query)
      .sort({ date: -1, createdAt: -1 })
      .toArray()

    const formattedNotes = deliveryNotes.map(note => ({
      ...note,
      _id: note._id.toString(),
      id: note._id.toString(),
      date: note.date instanceof Date ? note.date.toISOString() : note.date,
      createdAt: note.createdAt instanceof Date ? note.createdAt.toISOString() : note.createdAt,
      updatedAt: note.updatedAt instanceof Date ? note.updatedAt.toISOString() : note.updatedAt,
    }))

    return NextResponse.json({ deliveryNotes: formattedNotes })
  } catch (error: any) {
    console.error('[Delivery Notes API] ❌ Error fetching delivery notes:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch delivery notes',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// PUT update delivery note (for payment status, status, or full update)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { 
      id, 
      paymentStatus, 
      paymentDate, 
      status,
      // Full update fields
      noteId,
      distributorId,
      distributorName,
      items,
      vehicle,
      driver,
      driverPhone,
      notes,
      totalCost,
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Delivery note ID is required' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if delivery note exists
    const existing = await db.collection('jaba_deliveryNotes').findOne({ 
      _id: new ObjectId(id) 
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Delivery note not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    }

    // Handle full update (when items are provided)
    if (items && Array.isArray(items)) {
      const itemsWithQuantities = items.filter((item: any) => item.quantity > 0)
      if (itemsWithQuantities.length === 0) {
        return NextResponse.json(
          { error: 'At least one item must have a quantity greater than 0' },
          { status: 400 }
        )
      }

      // CRITICAL: Validate quantities against available stock (accounting for old quantities being restored)
      console.log('[Delivery Notes API] Validating stock availability for delivery note update:', id)
      
      // Get all packaging outputs to calculate available quantities
      const packagingOutputs = await db.collection('jaba_packagingOutput').find({}).toArray()
      
      // Get all batches to map batchId to batchNumber
      const allBatches = await db.collection('jaba_batches').find({}).toArray()
      const batchIdToBatchNumber = new Map<string, string>()
      allBatches.forEach((batch: any) => {
        batchIdToBatchNumber.set(batch._id.toString(), batch.batchNumber)
      })
      
      // Get all existing delivery notes (excluding current one) to calculate already distributed quantities
      const otherDeliveryNotes = await db.collection('jaba_deliveryNotes').find({ 
        _id: { $ne: new ObjectId(id) }
      }).toArray()
      
      // Calculate old quantities from existing note (these will be restored to available stock)
      const oldItems = existing.items || []
      
      // Validate each new item
      for (const item of itemsWithQuantities) {
        const requestedQty = Number(item.quantity) || 0
        if (requestedQty <= 0) continue
        
        // Find old quantity for this item (if it exists)
        const oldItem = oldItems.find((old: any) => 
          old.batchNumber === item.batchNumber && 
          old.size === item.size &&
          (old.finishedGoodId === item.finishedGoodId || old.packageNumber === item.packageNumber)
        )
        const oldQty = oldItem ? (Number(oldItem.quantity) || 0) : 0
        
        // Calculate total packaged for this batch + size
        let totalPackaged = 0
        packagingOutputs.forEach((output: any) => {
          // Match by batchNumber - get batchNumber from batchId
          const outputBatchNumber = batchIdToBatchNumber.get(output.batchId?.toString() || '') || 
                                   output.batchNumber || 
                                   (output.batch && output.batch.batchNumber)
          
          if (outputBatchNumber === item.batchNumber && output.containers && Array.isArray(output.containers)) {
            output.containers.forEach((container: any) => {
              if (container.size === item.size) {
                totalPackaged += Number(container.quantity) || 0
              }
            })
          }
        })
        
        // Calculate already distributed from OTHER delivery notes (excluding current one)
        let alreadyDistributed = 0
        otherDeliveryNotes.forEach((note: any) => {
          if (note.items && Array.isArray(note.items)) {
            note.items.forEach((noteItem: any) => {
              if (noteItem.batchNumber === item.batchNumber && noteItem.size === item.size) {
                alreadyDistributed += Number(noteItem.quantity) || 0
              }
            })
          }
        })
        
        // Calculate available quantity (old quantity will be restored, so add it back)
        const availableQuantity = Math.max(0, totalPackaged - alreadyDistributed + oldQty)
        
        // Validate new quantity doesn't exceed available
        if (requestedQty > availableQuantity) {
          return NextResponse.json(
            { 
              error: `Insufficient stock for ${item.productName || item.size} (Batch: ${item.batchNumber}). Available: ${availableQuantity.toLocaleString()}, Requested: ${requestedQty.toLocaleString()}` 
            },
            { status: 400 }
          )
        }
      }

      // Calculate total cost from items
      const calculatedTotalCost = itemsWithQuantities.reduce((sum: number, item: any) => {
        const itemCost = (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0)
        return sum + itemCost
      }, 0)

      updateData.noteId = noteId?.trim() || existing.noteId
      updateData.distributorId = distributorId?.trim() || existing.distributorId
      updateData.distributorName = distributorName?.trim() || existing.distributorName
      updateData.items = itemsWithQuantities.map((item: any) => ({
        finishedGoodId: item.finishedGoodId,
        productName: item.productName || '',
        flavor: item.flavor || '',
        productType: item.productType || '',
        size: item.size,
        batchNumber: item.batchNumber || '',
        packageNumber: item.packageNumber || '',
        quantity: Number(item.quantity),
        pricePerUnit: Number(item.pricePerUnit) || 0,
        totalCost: (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0),
      }))
      updateData.totalCost = totalCost !== undefined ? Number(totalCost) : calculatedTotalCost
      updateData.vehicle = vehicle?.trim() || undefined
      updateData.driver = driver?.trim() || undefined
      updateData.driverPhone = driverPhone?.trim() || undefined
      updateData.notes = notes?.trim() || undefined
    }

    // Handle payment status update
    if (paymentStatus !== undefined) {
      updateData.paymentStatus = paymentStatus
      if (paymentStatus === 'Paid' && !paymentDate) {
        updateData.paymentDate = new Date()
      } else if (paymentStatus === 'Paid' && paymentDate) {
        updateData.paymentDate = new Date(paymentDate)
      } else if (paymentStatus !== 'Paid') {
        updateData.paymentDate = undefined
      }
    }

    // Handle status update
    if (status !== undefined) {
      updateData.status = status
    }

    // Update delivery note
    await db.collection('jaba_deliveryNotes').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )

    console.log(`[Delivery Notes API] ✅ Delivery note updated: ${id}`)

    // Fetch updated note
    const updated = await db.collection('jaba_deliveryNotes').findOne({ 
      _id: new ObjectId(id) 
    })

    return NextResponse.json({
      success: true,
      deliveryNote: {
        ...updated,
        _id: updated!._id.toString(),
        id: updated!._id.toString(),
        date: updated!.date instanceof Date ? updated!.date.toISOString() : updated!.date,
        createdAt: updated!.createdAt instanceof Date ? updated!.createdAt.toISOString() : updated!.createdAt,
        updatedAt: updated!.updatedAt instanceof Date ? updated!.updatedAt.toISOString() : updated!.updatedAt,
        paymentDate: updated!.paymentDate instanceof Date ? updated!.paymentDate.toISOString() : updated!.paymentDate,
      }
    })
  } catch (error: any) {
    console.error('[Delivery Notes API] ❌ Error updating delivery note:', error)
    return NextResponse.json(
      {
        error: 'Failed to update delivery note',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

// DELETE delivery note
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Delivery note ID is required' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    // Check if delivery note exists
    const existing = await db.collection('jaba_deliveryNotes').findOne({ 
      _id: new ObjectId(id) 
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Delivery note not found' },
        { status: 404 }
      )
    }

    // Delete delivery note
    await db.collection('jaba_deliveryNotes').deleteOne({ 
      _id: new ObjectId(id) 
    })

    console.log(`[Delivery Notes API] ✅ Delivery note deleted: ${id}`)

    return NextResponse.json({
      success: true,
      message: 'Delivery note deleted successfully'
    })
  } catch (error: any) {
    console.error('[Delivery Notes API] ❌ Error deleting delivery note:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete delivery note',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}