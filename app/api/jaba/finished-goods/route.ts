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

    type SizeTriplet = { original: number; distributed: number; remaining: number }

    const flavourKey = (poOrItem: any) =>
      String(poOrItem.flavourLineId || poOrItem.flavourName || poOrItem.flavor || '__base__')

    const addContainerToRow = (row: { l250: number; l500: number; l1: number; l2: number }, container: any) => {
      const qty = parseFloat(container.quantity) || 0
      if (container.size === '250ml') row.l250 += qty
      else if (container.size === '500ml') row.l500 += qty
      else if (container.size === '1L') row.l1 += qty
      else if (container.size === '2L') row.l2 += qty
    }

    const addDistToRow = (row: { l250: number; l500: number; l1: number; l2: number }, item: any) => {
      const qty = parseFloat(item.quantity) || 0
      if (item.size === '250ml') row.l250 += qty
      else if (item.size === '500ml') row.l500 += qty
      else if (item.size === '1L') row.l1 += qty
      else if (item.size === '2L') row.l2 += qty
    }

    const rowToSizes = (
      p: { l250: number; l500: number; l1: number; l2: number },
      d: { l250: number; l500: number; l1: number; l2: number }
    ): {
      total250ml: SizeTriplet
      total500ml: SizeTriplet
      total1L: SizeTriplet
      total2L: SizeTriplet
    } => ({
      total250ml: {
        original: p.l250,
        distributed: d.l250,
        remaining: Math.max(0, p.l250 - d.l250),
      },
      total500ml: {
        original: p.l500,
        distributed: d.l500,
        remaining: Math.max(0, p.l500 - d.l500),
      },
      total1L: {
        original: p.l1,
        distributed: d.l1,
        remaining: Math.max(0, p.l1 - d.l1),
      },
      total2L: {
        original: p.l2,
        distributed: d.l2,
        remaining: Math.max(0, p.l2 - d.l2),
      },
    })

    // Process batches with packaging and distribution data
    const batchesWithData = batches.map((batch: any) => {
      const batchId = batch._id.toString()
      
      // Get all packaging outputs for this batch
      const batchPackagingOutputs = packagingOutputs.filter(
        (po: any) => po.batchId === batchId
      )

      // Calculate packaged quantities by size from containers
      let total250ml = 0
      let total500ml = 0
      let total1L = 0
      let total2L = 0
      const otherSizes: { size: string; quantity: number }[] = []

      /** Per-flavour packaged bottle counts */
      const packByFlavour = new Map<string, { l250: number; l500: number; l1: number; l2: number }>()
      const firstLabelByKey = new Map<string, string>()

      batchPackagingOutputs.forEach((po: any) => {
        const fk = flavourKey(po)
        if (!firstLabelByKey.has(fk)) {
          const hint = [po.flavourName, po.flavor, po.displayFlavor].find((x: any) => typeof x === 'string' && x.trim())
          if (hint) firstLabelByKey.set(fk, hint.trim())
        }
        let row = packByFlavour.get(fk)
        if (!row) {
          row = { l250: 0, l500: 0, l1: 0, l2: 0 }
          packByFlavour.set(fk, row)
        }
        if (po.containers && Array.isArray(po.containers)) {
          po.containers.forEach((container: any) => {
            const qty = parseFloat(container.quantity) || 0
            if (container.size === '250ml') {
              total250ml += qty
            } else if (container.size === '500ml') {
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
            addContainerToRow(row, container)
          })
        }
      })

      // Calculate distributed quantities from delivery notes
      let distributed250ml = 0
      let distributed500ml = 0
      let distributed1L = 0
      let distributed2L = 0

      const distByFlavour = new Map<string, { l250: number; l500: number; l1: number; l2: number }>()

      deliveryNotes.forEach((note: any) => {
        if (note.items && Array.isArray(note.items)) {
          note.items.forEach((item: any) => {
            if (item.batchNumber === batch.batchNumber) {
              const qty = parseFloat(item.quantity) || 0
              if (item.size === '250ml') {
                distributed250ml += qty
              } else if (item.size === '500ml') {
                distributed500ml += qty
              } else if (item.size === '1L') {
                distributed1L += qty
              } else if (item.size === '2L') {
                distributed2L += qty
              }
              const fk = flavourKey(item)
              if (!firstLabelByKey.has(fk)) {
                const hint = typeof item.flavor === 'string' && item.flavor.trim() ? item.flavor.trim() : ''
                if (hint) firstLabelByKey.set(fk, hint)
              }
              let dRow = distByFlavour.get(fk)
              if (!dRow) {
                dRow = { l250: 0, l500: 0, l1: 0, l2: 0 }
                distByFlavour.set(fk, dRow)
              }
              addDistToRow(dRow, item)
            }
          })
        }
      })

      const resolveFlavourLabel = (key: string): string => {
        if (key === '__base__') {
          return String(batch.displayFlavorLabel || batch.flavor || 'Neutral / unassigned')
        }
        const lines = batch.flavourOutputs || []
        const fo = lines.find(
          (row: any) => String(row._id) === key || String(row.id) === key
        )
        if (fo) {
          return String(fo.flavor || fo.flavourName || fo.lineCode || fo.batchNumber || key)
        }
        return firstLabelByKey.get(key) || String(batch.displayFlavorLabel || batch.flavor || key)
      }

      const flavourKeys = new Set<string>([...packByFlavour.keys(), ...distByFlavour.keys()])
      const byFlavour = Array.from(flavourKeys)
        .map((key) => {
          const p = packByFlavour.get(key) || { l250: 0, l500: 0, l1: 0, l2: 0 }
          const d = distByFlavour.get(key) || { l250: 0, l500: 0, l1: 0, l2: 0 }
          const sizes = rowToSizes(p, d)
          const orig =
            sizes.total250ml.original +
            sizes.total500ml.original +
            sizes.total1L.original +
            sizes.total2L.original
          const rem =
            sizes.total250ml.remaining +
            sizes.total500ml.remaining +
            sizes.total1L.remaining +
            sizes.total2L.remaining
          const dist =
            sizes.total250ml.distributed +
            sizes.total500ml.distributed +
            sizes.total1L.distributed +
            sizes.total2L.distributed
          return {
            key,
            label: resolveFlavourLabel(key),
            ...sizes,
            totalBottles: {
              original: orig,
              distributed: dist,
              remaining: rem,
            },
          }
        })
        .filter((row) => row.totalBottles.original > 0 || row.totalBottles.distributed > 0)
        .sort((a, b) => b.totalBottles.remaining - a.totalBottles.remaining)

      // Calculate remaining quantities
      const remaining250ml = Math.max(0, total250ml - distributed250ml)
      const remaining500ml = Math.max(0, total500ml - distributed500ml)
      const remaining1L = Math.max(0, total1L - distributed1L)
      const remaining2L = Math.max(0, total2L - distributed2L)
      const totalBottles = total250ml + total500ml + total1L + total2L
      const distributedBottles = distributed250ml + distributed500ml + distributed1L + distributed2L
      const remainingBottles = remaining250ml + remaining500ml + remaining1L + remaining2L

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
        total250ml: {
          original: total250ml,
          distributed: distributed250ml,
          remaining: remaining250ml,
        },
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
        byFlavour,
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
