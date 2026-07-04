import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const logs = await db
      .collection('jaba_inventory_movements')
      .find({})
      .sort({ timestamp: -1, createdAt: -1, _id: -1 })
      .limit(300)
      .toArray()

    const formatted = logs.map((log: any) => ({
      id: log._id?.toString(),
      materialName: String(log.materialName || 'N/A'),
      batchNumber: String(log.batchNumber || 'N/A'),
      quantityUsed: Number(log.quantity) || 0,
      unit: String(log.unit || ''),
      remainingStock: Number(log.afterStock) || 0,
      approvedBy: String(log.userId || 'System'),
      reason: String(log.reason || ''),
      date: (log.timestamp instanceof Date ? log.timestamp : log.createdAt instanceof Date ? log.createdAt : new Date()).toISOString(),
    }))

    return NextResponse.json({ logs: formatted })
  } catch (error: any) {
    console.error('[Raw Materials Usage Logs API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch usage logs', details: error.message || String(error) },
      { status: 500 }
    )
  }
}
