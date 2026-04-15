import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireJabaSuperAdmin } from '@/lib/jaba-ai-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Lightweight badge count for super-admin sidebar (plant ops signals).
 */
export async function GET() {
  const auth = await requireJabaSuperAdmin()
  if ('response' in auth) return auth.response

  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const [rawMaterials, batches] = await Promise.all([
      db.collection('jaba_rawMaterials').find({}).project({ currentStock: 1, minStock: 1 }).toArray(),
      db.collection('jaba_batches').find({}).project({ status: 1 }).toArray(),
    ])

    const lowStock = rawMaterials.filter((rm: any) => {
      const c = parseFloat(rm.currentStock) || 0
      const m = parseFloat(rm.minStock) || 0
      return c <= m
    }).length

    const packagingBacklog = batches.filter((b: any) => b.status === 'QC Pending').length

    let criticalCount = 0
    if (lowStock > 0) criticalCount++
    if (packagingBacklog >= 5) criticalCount++
    if (lowStock > 3) criticalCount++

    return NextResponse.json({ count: Math.min(99, criticalCount) })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
