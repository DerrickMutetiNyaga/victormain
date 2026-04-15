import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// GET stock movements from database
export async function GET(request: Request) {
  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    console.log('[Stock Movements API] Fetching movements...')

    const movements: any[] = []

    // 1. Get packaging outputs (IN movements - products coming into finished goods)
    const packagingOutputs = await db.collection('jaba_packagingOutput')
      .find({})
      .sort({ createdAt: -1 })
      .toArray()

    console.log(`[Stock Movements API] Found ${packagingOutputs.length} packaging outputs`)

    packagingOutputs.forEach((po: any) => {
      // Get batch info
      const batchNumber = po.batchNumber || 'N/A'
      const totalBottles = po.containers?.reduce((sum: number, c: any) => sum + (parseFloat(c.quantity) || 0), 0) || 0

      if (totalBottles > 0) {
        movements.push({
          _id: `pkg-${po._id.toString()}`,
          type: 'IN',
          productType: 'Finished Goods',
          batchId: po.batchId,
          batchNumber: batchNumber,
          packageNumber: po.packageNumber || '',
          quantity: totalBottles,
          unit: 'bottles',
          reason: 'Packaging completed',
          date: po.packagingDate instanceof Date ? po.packagingDate : new Date(po.packagingDate),
          user: po.supervisor || 'System',
          notes: `Packaged on line ${po.packagingLine || 'N/A'}`,
          source: 'packaging',
        })
      }
    })

    // 2. Get delivery notes (OUT movements - products going out for distribution)
    const deliveryNotes = await db.collection('jaba_deliveryNotes')
      .find({})
      .sort({ date: -1, createdAt: -1 })
      .toArray()

    console.log(`[Stock Movements API] Found ${deliveryNotes.length} delivery notes`)

    deliveryNotes.forEach((note: any) => {
      if (note.items && Array.isArray(note.items)) {
        note.items.forEach((item: any) => {
          movements.push({
            _id: `del-${note._id.toString()}-${item.batchNumber || 'unknown'}`,
            type: 'OUT',
            productType: item.productType || item.productName || 'Finished Goods',
            batchId: item.batchId,
            batchNumber: item.batchNumber || 'N/A',
            packageNumber: item.packageNumber || '',
            quantity: parseFloat(item.quantity) || 0,
            unit: 'bottles',
            reason: 'Distribution',
            date: note.date instanceof Date ? note.date : new Date(note.date),
            user: note.driver || note.distributorName || 'System',
            notes: `Delivered to ${note.distributorName || 'N/A'}`,
            source: 'distribution',
            distributorName: note.distributorName,
          })
        })
      }
    })

    // 3. Get batches for production IN movements (when batches are created/processed)
    const batches = await db.collection('jaba_batches')
      .find({})
      .sort({ date: -1, createdAt: -1 })
      .toArray()

    console.log(`[Stock Movements API] Found ${batches.length} batches`)

    batches.forEach((batch: any) => {
      if (batch.status === 'Ready for Distribution' || batch.status === 'Partially Packaged') {
        const totalLitres = batch.totalLitres || 0
        if (totalLitres > 0) {
          movements.push({
            _id: `batch-${batch._id.toString()}`,
            type: 'IN',
            productType: batch.flavor || batch.productCategory || 'Production',
            batchId: batch._id.toString(),
            batchNumber: batch.batchNumber || 'N/A',
            quantity: totalLitres,
            unit: 'litres',
            reason: 'Production completed',
            date: batch.date instanceof Date ? batch.date : new Date(batch.date),
            user: batch.supervisor || 'System',
            notes: `Batch ${batch.batchNumber} ready for packaging`,
            source: 'production',
          })
        }
      }
    })

    // Sort by date (newest first)
    movements.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime()
      const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime()
      return dateB - dateA
    })

    // Format dates for response
    const formattedMovements = movements.map((mov) => ({
      ...mov,
      date: mov.date instanceof Date ? mov.date.toISOString() : mov.date,
    }))

    console.log(`[Stock Movements API] ✅ Returning ${formattedMovements.length} movements`)

    return NextResponse.json({ movements: formattedMovements })
  } catch (error: any) {
    console.error('[Stock Movements API] ❌ Error fetching movements:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch stock movements',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}
