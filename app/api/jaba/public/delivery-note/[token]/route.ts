import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

function sanitizePublicDeliveryNote(doc: Record<string, unknown>) {
  const items = Array.isArray(doc.items) ? doc.items : []
  return {
    noteId: String(doc.noteId ?? ''),
    distributorName: String(doc.distributorName ?? ''),
    date:
      doc.date instanceof Date
        ? doc.date.toISOString()
        : doc.date
          ? String(doc.date)
          : null,
    status: doc.status != null ? String(doc.status) : 'Pending',
    paymentStatus: doc.paymentStatus != null ? String(doc.paymentStatus) : 'Unpaid',
    vehicle: doc.vehicle != null ? String(doc.vehicle) : undefined,
    driver: doc.driver != null ? String(doc.driver) : undefined,
    driverPhone: doc.driverPhone != null ? String(doc.driverPhone) : undefined,
    notes: doc.notes != null ? String(doc.notes) : undefined,
    totalCost: typeof doc.totalCost === 'number' ? doc.totalCost : Number(doc.totalCost) || 0,
    items: items.map((item: Record<string, unknown>) => ({
      productName: item.productName != null ? String(item.productName) : '',
      flavor: item.flavor != null ? String(item.flavor) : '',
      productType: item.productType != null ? String(item.productType) : '',
      size: item.size != null ? String(item.size) : '',
      batchNumber: item.batchNumber != null ? String(item.batchNumber) : '',
      packageNumber: item.packageNumber != null ? String(item.packageNumber) : '',
      quantity: Number(item.quantity) || 0,
      pricePerUnit: Number(item.pricePerUnit) || 0,
      totalCost: Number(item.totalCost) || 0,
    })),
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params
    const t = String(token || '').trim()
    if (t.length < 6 || t.length > 128) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const note = await db.collection('jaba_deliveryNotes').findOne({
      $or: [{ viewToken: t }, { publicShortToken: t }],
    })
    if (!note) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ deliveryNote: sanitizePublicDeliveryNote(note as Record<string, unknown>) })
  } catch (error) {
    console.error('[Public delivery note API]', error)
    return NextResponse.json({ error: 'Failed to load delivery note' }, { status: 500 })
  }
}
