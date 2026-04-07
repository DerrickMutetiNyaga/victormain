import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireJabaAction } from '@/lib/api-jaba-permissions'
import { sendJabaSmsForEvent } from '@/lib/jaba-sms'

export const runtime = 'nodejs'

class ApiError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

// POST create delivery note
export async function POST(request: Request) {
  const authResult = await requireJabaAction('distribution.create', 'add')
  if ('response' in authResult) return authResult.response

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
    const mongoSession = client.startSession()
    try {
      let createdNote: any = null
      await mongoSession.withTransaction(async () => {
        console.log('[Delivery Notes API] Validating stock availability for delivery note:', noteId)

        const packagingOutputs = await db.collection('jaba_packagingOutput').find({}, { session: mongoSession }).toArray()
        const allBatches = await db.collection('jaba_batches').find({}, { session: mongoSession }).toArray()
        const batchIdToBatchNumber = new Map<string, string>()
        allBatches.forEach((batch: any) => {
          batchIdToBatchNumber.set(batch._id.toString(), batch.batchNumber)
        })
        const existingDeliveryNotes = await db.collection('jaba_deliveryNotes').find({}, { session: mongoSession }).toArray()

        for (const item of itemsWithQuantities) {
          const requestedQty = Number(item.quantity) || 0
          if (requestedQty <= 0) continue
          const itemFlavourLineId = item.flavourLineId ? String(item.flavourLineId) : ''

          let totalPackaged = 0
          packagingOutputs.forEach((output: any) => {
            const outputBatchNumber =
              batchIdToBatchNumber.get(output.batchId?.toString() || '') ||
              output.batchNumber ||
              (output.batch && output.batch.batchNumber)
            const outputFl = output.flavourLineId != null ? String(output.flavourLineId) : ''
            const matchFlavour = itemFlavourLineId ? outputFl === itemFlavourLineId : !outputFl
            if (!matchFlavour || outputBatchNumber !== item.batchNumber || !Array.isArray(output.containers)) return
            output.containers.forEach((container: any) => {
              if (container.size === item.size) totalPackaged += Number(container.quantity) || 0
            })
          })

          let alreadyDistributed = 0
          existingDeliveryNotes.forEach((note: any) => {
            if (!Array.isArray(note.items)) return
            note.items.forEach((noteItem: any) => {
              const noteFl = noteItem.flavourLineId != null ? String(noteItem.flavourLineId) : ''
              const matchFlavour = itemFlavourLineId ? noteFl === itemFlavourLineId : !noteFl
              if (noteItem.batchNumber === item.batchNumber && noteItem.size === item.size && matchFlavour) {
                alreadyDistributed += Number(noteItem.quantity) || 0
              }
            })
          })

          const availableQuantity = Math.max(0, totalPackaged - alreadyDistributed)
          if (requestedQty > availableQuantity) {
            throw new ApiError(
              `Insufficient stock for ${item.productName || item.size} (Batch: ${item.batchNumber}). Available: ${availableQuantity.toLocaleString()}, Requested: ${requestedQty.toLocaleString()}`,
              400
            )
          }
        }

        const existing = await db.collection('jaba_deliveryNotes').findOne({ noteId: noteId.trim() }, { session: mongoSession })
        if (existing) throw new ApiError('Delivery note with this ID already exists', 400)

        const totalCost = itemsWithQuantities.reduce((sum: number, item: any) => {
          const itemCost = (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0)
          return sum + itemCost
        }, 0)

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
            flavourLineId: item.flavourLineId ? String(item.flavourLineId) : undefined,
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
          paymentStatus: 'Unpaid',
          paymentDate: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        const result = await db.collection('jaba_deliveryNotes').insertOne(deliveryNoteData, { session: mongoSession })
        createdNote = {
          ...deliveryNoteData,
          _id: result.insertedId.toString(),
          id: result.insertedId.toString(),
        }
      })

      console.log(`[Delivery Notes API] ✅ Delivery note created successfully: ${noteId}`)
      await sendJabaSmsForEvent(
        'distributionCreated',
        `Jaba: Distribution created. Note ${noteId}, distributor ${distributorName}, items ${itemsWithQuantities.length}.`
      )
      return NextResponse.json({ success: true, deliveryNote: createdNote }, { status: 201 })
    } finally {
      await mongoSession.endSession()
    }
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
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
  const authResult = await requireJabaAction('distribution.main', 'view')
  if ('response' in authResult) return authResult.response

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
  const authResult = await requireJabaAction('distribution.main', 'edit')
  if ('response' in authResult) return authResult.response

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

    const mongoSession = client.startSession()
    try {
      let updatedNote: any = null
      await mongoSession.withTransaction(async () => {
        const existing = await db.collection('jaba_deliveryNotes').findOne({ _id: new ObjectId(id) }, { session: mongoSession })
        if (!existing) throw new ApiError('Delivery note not found', 404)
        const previousStatus = String(existing.status || '').toLowerCase()

        const updateData: any = { updatedAt: new Date() }

        // Handle full update (when items are provided)
        if (items && Array.isArray(items)) {
          const itemsWithQuantities = items.filter((item: any) => item.quantity > 0)
          if (itemsWithQuantities.length === 0) {
            throw new ApiError('At least one item must have a quantity greater than 0', 400)
          }

          const packagingOutputs = await db.collection('jaba_packagingOutput').find({}, { session: mongoSession }).toArray()
          const allBatches = await db.collection('jaba_batches').find({}, { session: mongoSession }).toArray()
          const batchIdToBatchNumber = new Map<string, string>()
          allBatches.forEach((batch: any) => {
            batchIdToBatchNumber.set(batch._id.toString(), batch.batchNumber)
          })
          const otherDeliveryNotes = await db.collection('jaba_deliveryNotes').find(
            { _id: { $ne: new ObjectId(id) } },
            { session: mongoSession }
          ).toArray()
          const oldItems = existing.items || []

          for (const item of itemsWithQuantities) {
            const requestedQty = Number(item.quantity) || 0
            if (requestedQty <= 0) continue
            const itemFlavourLineId = item.flavourLineId ? String(item.flavourLineId) : ''

            const oldItem = oldItems.find((old: any) =>
              old.batchNumber === item.batchNumber &&
              old.size === item.size &&
              (String(old.flavourLineId || '') === itemFlavourLineId) &&
              (old.finishedGoodId === item.finishedGoodId || old.packageNumber === item.packageNumber)
            )
            const oldQty = oldItem ? (Number(oldItem.quantity) || 0) : 0

            let totalPackaged = 0
            packagingOutputs.forEach((output: any) => {
              const outputBatchNumber =
                batchIdToBatchNumber.get(output.batchId?.toString() || '') ||
                output.batchNumber ||
                (output.batch && output.batch.batchNumber)
              const outputFl = output.flavourLineId != null ? String(output.flavourLineId) : ''
              const matchFlavour = itemFlavourLineId ? outputFl === itemFlavourLineId : !outputFl
              if (!matchFlavour || outputBatchNumber !== item.batchNumber || !Array.isArray(output.containers)) return
              output.containers.forEach((container: any) => {
                if (container.size === item.size) totalPackaged += Number(container.quantity) || 0
              })
            })

            let alreadyDistributed = 0
            otherDeliveryNotes.forEach((note: any) => {
              if (!Array.isArray(note.items)) return
              note.items.forEach((noteItem: any) => {
                const noteFl = noteItem.flavourLineId != null ? String(noteItem.flavourLineId) : ''
                const matchFlavour = itemFlavourLineId ? noteFl === itemFlavourLineId : !noteFl
                if (noteItem.batchNumber === item.batchNumber && noteItem.size === item.size && matchFlavour) {
                  alreadyDistributed += Number(noteItem.quantity) || 0
                }
              })
            })

            const availableQuantity = Math.max(0, totalPackaged - alreadyDistributed + oldQty)
            if (requestedQty > availableQuantity) {
              throw new ApiError(
                `Insufficient stock for ${item.productName || item.size} (Batch: ${item.batchNumber}). Available: ${availableQuantity.toLocaleString()}, Requested: ${requestedQty.toLocaleString()}`,
                400
              )
            }
          }

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
            flavourLineId: item.flavourLineId ? String(item.flavourLineId) : undefined,
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

        if (status !== undefined) updateData.status = status

        await db.collection('jaba_deliveryNotes').updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData },
          { session: mongoSession }
        )

        const updated = await db.collection('jaba_deliveryNotes').findOne({ _id: new ObjectId(id) }, { session: mongoSession })
        const nextStatus = String(updated?.status || '').toLowerCase()
        if (previousStatus !== 'delivered' && nextStatus === 'delivered') {
          await sendJabaSmsForEvent(
            'distributionDelivered',
            `Jaba: Delivery completed. Note ${updated?.noteId || id}, distributor ${updated?.distributorName || ''}.`
          )
        }
        updatedNote = {
          ...updated,
          _id: updated!._id.toString(),
          id: updated!._id.toString(),
          date: updated!.date instanceof Date ? updated!.date.toISOString() : updated!.date,
          createdAt: updated!.createdAt instanceof Date ? updated!.createdAt.toISOString() : updated!.createdAt,
          updatedAt: updated!.updatedAt instanceof Date ? updated!.updatedAt.toISOString() : updated!.updatedAt,
          paymentDate: updated!.paymentDate instanceof Date ? updated!.paymentDate.toISOString() : updated!.paymentDate,
        }
      })

      console.log(`[Delivery Notes API] ✅ Delivery note updated: ${id}`)
      return NextResponse.json({
        success: true,
        deliveryNote: updatedNote,
      })
    } finally {
      await mongoSession.endSession()
    }
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
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
  const authResult = await requireJabaAction('distribution.main', 'delete')
  if ('response' in authResult) return authResult.response

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