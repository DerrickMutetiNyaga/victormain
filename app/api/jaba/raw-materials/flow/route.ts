import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { requireJabaAction } from '@/lib/api-jaba-permissions'

export const runtime = 'nodejs'

type FlowDirection = 'in' | 'out' | 'transfer'

type FlowEntry = {
  id: string
  at: string
  direction: FlowDirection
  source: string
  materialName: string
  quantity: number
  unit: string
  reference: string
  detail: string
  afterStock: number | null
  category: 'supplier' | 'batch' | 'packaging' | 'production' | 'other'
}

function pickDate(d: unknown): Date {
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d
  if (typeof d === 'string' || typeof d === 'number') {
    const t = new Date(d)
    if (!Number.isNaN(t.getTime())) return t
  }
  return new Date()
}

export async function GET(request: Request) {
  const authResult = await requireJabaAction('production.rawMaterials', 'view')
  if ('response' in authResult) return authResult.response

  try {
    const { searchParams } = new URL(request.url)
    const directionFilter = (searchParams.get('direction') || 'all').toLowerCase()
    const materialQ = (searchParams.get('material') || '').trim().toLowerCase()
    const fromStr = searchParams.get('from')
    const toStr = searchParams.get('to')
    const limit = Math.min(2500, Math.max(50, parseInt(searchParams.get('limit') || '800', 10) || 800))

    const fromDate = fromStr ? new Date(fromStr) : null
    const toDate = toStr ? new Date(toStr) : null
    if (fromDate && Number.isNaN(fromDate.getTime())) {
      return NextResponse.json({ error: 'Invalid "from" date' }, { status: 400 })
    }
    if (toDate && Number.isNaN(toDate.getTime())) {
      return NextResponse.json({ error: 'Invalid "to" date' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const supplierQuery: Record<string, unknown> = {}
    if (fromDate || toDate) {
      supplierQuery.date = {}
      if (fromDate) (supplierQuery.date as Record<string, Date>).$gte = fromDate
      if (toDate) {
        const end = new Date(toDate)
        end.setHours(23, 59, 59, 999)
        ;(supplierQuery.date as Record<string, Date>).$lte = end
      }
    }

    const movementQuery: Record<string, unknown> = {}
    if (fromDate || toDate) {
      const range: Record<string, Date> = {}
      if (fromDate) range.$gte = fromDate
      if (toDate) {
        const end = new Date(toDate)
        end.setHours(23, 59, 59, 999)
        range.$lte = end
      }
      movementQuery.$or = [{ timestamp: range }, { createdAt: range }]
    }

    const [supplierRows, movementRows] = await Promise.all([
      db
        .collection('jaba_supplierHistory')
        .find(Object.keys(supplierQuery).length ? supplierQuery : {})
        .sort({ date: -1, _id: -1 })
        .limit(1200)
        .toArray(),
      db
        .collection('jaba_inventory_movements')
        .find(Object.keys(movementQuery).length ? movementQuery : {})
        .sort({ timestamp: -1, createdAt: -1, _id: -1 })
        .limit(2000)
        .toArray(),
    ])

    const entries: FlowEntry[] = []

    for (const row of supplierRows) {
      const r = row as Record<string, unknown>
      const type = String(r.type || '').trim()
      const qty = Number(r.quantity) || 0
      const unit = String(r.unit || '')
      const itemName = String(r.itemName || 'N/A')
      const supplierName = String(r.supplierName || '')
      const d = pickDate(r.date)

      let direction: FlowDirection = 'out'
      if (type.toLowerCase() === 'restock') direction = 'in'
      else if (type.toLowerCase() === 'usage') direction = 'out'

      const refParts = [String(r.batchNumber || '').trim(), String(r.lotNumber || '').trim()].filter(Boolean)
      entries.push({
        id: `sh-${String(r._id)}`,
        at: d.toISOString(),
        direction,
        source: direction === 'in' ? 'Supplier (restock)' : 'Supplier (usage)',
        materialName: itemName,
        quantity: Math.abs(qty),
        unit,
        reference: supplierName + (refParts.length ? ` · ${refParts.join(' / ')}` : ''),
        detail: type ? `${type}${r.cost != null ? ` · cost ${r.cost}` : ''}` : '',
        afterStock: null,
        category: 'supplier',
      })
    }

    for (const row of movementRows) {
      const r = row as Record<string, unknown>
      const ts = r.timestamp ? pickDate(r.timestamp) : pickDate(r.createdAt)
      const type = String(r.type || '')
      const reason = String(r.reason || '')
      const materialName = String(r.materialName || 'N/A')
      const qty = Number(r.quantity) || 0
      const unit = String(r.unit || '')
      const batchNumber = String(r.batchNumber || '')
      const packageNumber = String((r as { packageNumber?: string }).packageNumber || '')

      let direction: FlowDirection = 'out'
      let source = 'Production'
      let category: FlowEntry['category'] = 'batch'

      if (type === 'TRANSFER' || reason === 'NEUTRAL_INFUSED') {
        direction = 'transfer'
        source = 'Production (internal)'
        category = 'production'
      } else if (type === 'DEDUCTION') {
        direction = 'out'
        if (reason === 'PACKAGING') {
          source = 'Packaging'
          category = 'packaging'
        } else if (reason === 'BATCH_CREATED') {
          source = 'Batch (material use)'
          category = 'batch'
        } else {
          source = `Batch (${reason || 'deduction'})`
          category = 'batch'
        }
      } else if (type === 'ADJUSTMENT') {
        direction = 'in'
        if (reason === 'PACKAGING_DELETED' || reason === 'PACKAGING_REVERSED') {
          source = 'Packaging (reversal)'
          category = 'packaging'
        } else if (reason === 'BATCH_EDITED') {
          source = 'Batch (stock returned)'
          category = 'batch'
        } else {
          source = `Adjustment (${reason || 'correction'})`
          category = 'other'
        }
      } else {
        direction = 'out'
        source = `${type || 'Movement'}${reason ? ` · ${reason}` : ''}`
        category = 'other'
      }

      const ref =
        packageNumber && batchNumber
          ? `${packageNumber} · batch ${batchNumber}`
          : packageNumber
            ? packageNumber
            : batchNumber
              ? `Batch ${batchNumber}`
              : String(r.batchId || '')

      const after = r.afterStock !== undefined && r.afterStock !== null ? Number(r.afterStock) : null

      entries.push({
        id: `mv-${String(r._id)}`,
        at: ts.toISOString(),
        direction,
        source,
        materialName,
        quantity: Math.abs(qty),
        unit,
        reference: ref,
        detail: [type, reason].filter(Boolean).join(' · '),
        afterStock: Number.isFinite(after) ? after : null,
        category,
      })
    }

    let filtered = entries
    if (directionFilter === 'in') {
      filtered = filtered.filter((e) => e.direction === 'in')
    } else if (directionFilter === 'out') {
      filtered = filtered.filter((e) => e.direction === 'out')
    } else if (directionFilter === 'transfer') {
      filtered = filtered.filter((e) => e.direction === 'transfer')
    }

    if (materialQ) {
      filtered = filtered.filter(
        (e) =>
          e.materialName.toLowerCase().includes(materialQ) ||
          e.reference.toLowerCase().includes(materialQ) ||
          e.detail.toLowerCase().includes(materialQ)
      )
    }

    filtered.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    const trimmed = filtered.slice(0, limit)

    const summary = {
      totalLines: trimmed.length,
      inCount: filtered.filter((e) => e.direction === 'in').length,
      outCount: filtered.filter((e) => e.direction === 'out').length,
      transferCount: filtered.filter((e) => e.direction === 'transfer').length,
    }

    return NextResponse.json({ entries: trimmed, summary, limit })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[raw-materials/flow]', error)
    return NextResponse.json({ error: 'Failed to load material flow', details: msg }, { status: 500 })
  }
}
