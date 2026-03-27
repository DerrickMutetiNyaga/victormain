import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// GET batches that are packaged and ready for distribution
export async function GET(request: Request) {
  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    console.log('[Finished Goods API] Fetching packaged batches...')

    // Get all packaging outputs
    const packagingOutputs = await db.collection('jaba_packagingOutput')
      .find({})
      .sort({ createdAt: -1 })
      .toArray()

    console.log(`[Finished Goods API] Found ${packagingOutputs.length} packaging outputs`)

    // Get unique batch IDs from packaging outputs
    const batchIds = [...new Set(packagingOutputs.map((po: any) => po.batchId).filter(Boolean))]
    
    if (batchIds.length === 0) {
      return NextResponse.json({ batches: [] })
    }

    // Get batches that have been packaged
    const batches = await db.collection('jaba_batches')
      .find({ 
        _id: { $in: batchIds.map((id: string) => new ObjectId(id)) }
      })
      .sort({ date: -1, createdAt: -1 })
      .toArray()

    console.log(`[Finished Goods API] Found ${batches.length} packaged batches`)

    // Get all delivery notes to calculate distributed quantities
    const deliveryNotes = await db.collection('jaba_deliveryNotes')
      .find({})
      .toArray()

    console.log(`[Finished Goods API] Found ${deliveryNotes.length} delivery notes`)

    // Process batches with packaging and distribution data
    const batchesWithData = batches.map((batch: any) => {
      const batchId = batch._id.toString()
      
      // Get all packaging outputs for this batch
      const batchPackagingOutputs = packagingOutputs.filter(
        (po: any) => po.batchId === batchId
      )

      // Calculate packaged quantities by size from containers
      let total500ml = 0
      let total1L = 0
      let total2L = 0
      const otherSizes: { size: string; quantity: number }[] = []

      batchPackagingOutputs.forEach((po: any) => {
        if (po.containers && Array.isArray(po.containers)) {
          po.containers.forEach((container: any) => {
            const qty = parseFloat(container.quantity) || 0
            if (container.size === '500ml') {
              total500ml += qty
            } else if (container.size === '1L') {
              total1L += qty
            } else if (container.size === '2L') {
              total2L += qty
            } else {
              const existing = otherSizes.find(s => s.size === container.size)
              if (existing) {
                existing.quantity += qty
              } else {
                otherSizes.push({ size: container.size, quantity: qty })
              }
            }
          })
        }
      })

      // Calculate distributed quantities from delivery notes
      let distributed500ml = 0
      let distributed1L = 0
      let distributed2L = 0

      deliveryNotes.forEach((note: any) => {
        if (note.items && Array.isArray(note.items)) {
          note.items.forEach((item: any) => {
            if (item.batchNumber === batch.batchNumber) {
              const qty = parseFloat(item.quantity) || 0
              if (item.size === '500ml') {
                distributed500ml += qty
              } else if (item.size === '1L') {
                distributed1L += qty
              } else if (item.size === '2L') {
                distributed2L += qty
              }
            }
          })
        }
      })

      // Calculate remaining quantities
      const remaining500ml = Math.max(0, total500ml - distributed500ml)
      const remaining1L = Math.max(0, total1L - distributed1L)
      const remaining2L = Math.max(0, total2L - distributed2L)
      const totalBottles = total500ml + total1L + total2L
      const distributedBottles = distributed500ml + distributed1L + distributed2L
      const remainingBottles = remaining500ml + remaining1L + remaining2L

      // Determine status - only Available or Sold Out (goal is to distribute all)
      let status = 'Available'
      if (remainingBottles === 0) {
        status = 'Sold Out'
      }

      return {
        _id: batch._id.toString(),
        id: batch._id.toString(),
        batchNumber: batch.batchNumber || '',
        flavor: batch.flavor || '',
        productType: batch.productCategory || 'Infusion Jaba',
        date: batch.date instanceof Date ? batch.date.toISOString() : batch.date,
        total500ml: {
          original: total500ml,
          distributed: distributed500ml,
          remaining: remaining500ml,
        },
        total1L: {
          original: total1L,
          distributed: distributed1L,
          remaining: remaining1L,
        },
        total2L: {
          original: total2L,
          distributed: distributed2L,
          remaining: remaining2L,
        },
        totalBottles: {
          original: totalBottles,
          distributed: distributedBottles,
          remaining: remainingBottles,
        },
        status,
        packagingOutputs: batchPackagingOutputs.map((po: any) => ({
          _id: po._id.toString(),
          packageNumber: po.packageNumber || '',
          packagingDate: po.packagingDate instanceof Date ? po.packagingDate.toISOString() : po.packagingDate,
          packagingLine: po.packagingLine || '',
        })),
      }
    })

    console.log(`[Finished Goods API] ✅ Returning ${batchesWithData.length} batches with packaging data`)

    return NextResponse.json({ batches: batchesWithData })
  } catch (error: any) {
    console.error('[Finished Goods API] ❌ Error fetching finished goods:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch finished goods',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}
