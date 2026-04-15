/**
 * Cross-check signals from Mongo (batches vs packaging vs delivery) for AI Intelligence.
 * Invoked only from super_admin AI context; keeps logic in one place.
 */
import clientPromise from '@/lib/mongodb'
import type { DataQualityIssue, WastageSignal } from '@/lib/jaba-ai-intelligence-types'

const ML: Record<string, number> = {
  '250ml': 0.25,
  '500ml': 0.5,
  '1L': 1,
  '2L': 2,
}

function containerLitres(size: string, qty: number): number {
  const k = String(size || '').trim()
  const factor = ML[k] ?? 0
  return factor * Math.max(0, qty)
}

export async function fetchWastageAndDataQualityFromDb(): Promise<{
  wastage: WastageSignal[]
  dataQuality: DataQualityIssue[]
}> {
  const wastage: WastageSignal[] = []
  const dataQuality: DataQualityIssue[] = []

  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    const [batches, packagingOutputs, deliveryNotes, rawMaterials] = await Promise.all([
      db.collection('jaba_batches').find({}).sort({ date: -1 }).limit(400).toArray(),
      db.collection('jaba_packagingOutput').find({}).sort({ createdAt: -1 }).limit(800).toArray(),
      db.collection('jaba_deliveryNotes').find({}).sort({ date: -1 }).limit(500).toArray(),
      db.collection('jaba_rawMaterials').find({}).limit(2000).toArray(),
    ])

    const packByBatch = new Map<string, number>()
    for (const po of packagingOutputs) {
      const bid = String((po as any).batchId || '')
      if (!bid) continue
      let L = 0
      const containers = (po as any).containers
      if (Array.isArray(containers)) {
        for (const c of containers) {
          L += containerLitres(c.size, parseFloat(c.quantity) || 0)
        }
      }
      packByBatch.set(bid, (packByBatch.get(bid) || 0) + L)
    }

    let mismatchCount = 0
    for (const b of batches) {
      const id = String((b as any)._id)
      const litres = parseFloat((b as any).totalLitres) || 0
      if (litres < 50) continue
      const packed = packByBatch.get(id) || 0
      if (packed <= 0) continue
      const ratio = Math.abs(litres - packed) / litres
      if (ratio > 0.22 && litres > 100) {
        mismatchCount += 1
        if (mismatchCount <= 5) {
          wastage.push({
            id: `w-pack-litres-${id}`,
            severity: ratio > 0.4 ? 'critical' : 'warning',
            title: 'Production litres vs packaged volume mismatch',
            detail: `Batch ${(b as any).batchNumber || id.slice(-6)}: ~${Math.round(litres)}L produced vs ~${packed.toFixed(1)}L inferred from packaging containers. Verify yields, recording, or partial packaging.`,
            sources: ['jaba_batches', 'jaba_packagingOutput'],
          })
        }
      }
    }

    const now = Date.now()
    const weekMs = 7 * 24 * 60 * 60 * 1000
    let overdue = 0
    for (const n of deliveryNotes) {
      const st = String((n as any).status || '')
      if (st.toLowerCase() !== 'pending') continue
      const d = (n as any).date instanceof Date ? (n as any).date : new Date((n as any).date)
      if (Number.isNaN(d.getTime())) continue
      if (now - d.getTime() > weekMs) {
        overdue += 1
        if (overdue <= 3) {
          wastage.push({
            id: `w-overdue-dn-${String((n as any)._id)}`,
            severity: 'warning',
            title: 'Stale pending delivery note',
            detail: `Note ${(n as any).noteId || ''} for ${(n as any).distributorName || 'distributor'} is still Pending after 7+ days. Confirm dispatch or update status.`,
            sources: ['jaba_deliveryNotes'],
          })
        }
      }
    }

    const emptyFlavor = batches.some((b) => !String((b as any).flavor || '').trim())
    if (emptyFlavor) {
      dataQuality.push({
        id: 'dq-flavor-empty',
        severity: 'info',
        title: 'Some batches have no flavour',
        detail: 'Empty flavour fields skew flavour mix and margin intelligence — complete batch metadata.',
      })
    }

    const seenLower = new Map<string, string>()
    for (const b of batches) {
      const f = String((b as any).flavor || '').trim()
      if (!f) continue
      const k = f.toLowerCase()
      if (seenLower.has(k) && seenLower.get(k) !== f) {
        dataQuality.push({
          id: 'dq-flavor-naming',
          severity: 'info',
          title: 'Possible flavour naming inconsistency',
          detail: `Same flavour may appear as "${seenLower.get(k)}" and "${f}" — align naming for cleaner analytics.`,
        })
        break
      }
      seenLower.set(k, f)
    }

    let missingMin = 0
    for (const m of rawMaterials) {
      const name = String((m as any).name || '')
      const min = parseFloat((m as any).minStock)
      if (name && (Number.isNaN(min) || min === 0)) missingMin += 1
    }
    if (missingMin > 0) {
      dataQuality.push({
        id: 'dq-min-stock',
        severity: 'warning',
        title: 'Materials missing minimum stock',
        detail: `${missingMin} material(s) have no minimum stock configured — restock alerts may be incomplete.`,
      })
    }

    const emptyContainers = packagingOutputs.filter((po) => {
      const c = (po as any).containers
      return !Array.isArray(c) || c.length === 0
    }).length
    if (emptyContainers > 0) {
      dataQuality.push({
        id: 'dq-packaging-lines',
        severity: 'info',
        title: 'Packaging outputs without container lines',
        detail: `${emptyContainers} packaging record(s) have no container breakdown — volume reconciliation is harder.`,
      })
    }
  } catch (e) {
    console.error('[jaba-ai-wastage-db]', e)
  }

  return { wastage, dataQuality }
}
