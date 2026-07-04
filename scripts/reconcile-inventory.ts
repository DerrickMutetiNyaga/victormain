/**
 * Inventory Reconciliation Script
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT DOES
 *   1. Backs up bar_inventory + bar_stock_movements to /backups/
 *   2. Scans bar_stock_movements for duplicate movements.
 *      A "duplicate" = two or more rows with the same logical fingerprint:
 *        reference + productId + actionType + quantity + reason
 *      (This is the exact signature left by the POST+callback double-deduction bug.)
 *   3. Computes the net over-deduction per product:
 *        excess_deducted = (count-1) * qty  for every duplicate 'deduct' group
 *        excess_restored = (count-1) * qty  for every duplicate 'restore' group
 *        stock_correction = excess_deducted - excess_restored
 *   4. In DRY-RUN mode  → prints the full report and writes it to /backups/, touches nothing.
 *   5. In APPLY mode    → applies $inc corrections to bar_inventory,
 *                          marks extra movement rows with isDuplicate:true,
 *                          backfills dedupeKey on every movement row so the
 *                          new idempotency guard in inventory-ops.ts takes over.
 *   6. Writes a JSON report alongside the backup.
 *   7. Idempotent: rows already tagged isDuplicate:true are skipped on re-run.
 *
 * USAGE
 *   Dry-run  (default, safe):  npx tsx scripts/reconcile-inventory.ts
 *   Apply:                     npx tsx scripts/reconcile-inventory.ts --apply
 *
 * REQUIREMENTS
 *   MONGODB_URI must be set in .env or the environment.
 */

import 'dotenv/config'
import dns from 'dns'
import { MongoClient, ObjectId } from 'mongodb'
import * as fs from 'fs'
import * as path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawMovement {
  _id: any
  reference?: string
  orderId?: string
  productId?: string
  productName?: string
  actionType?: 'deduct' | 'restore'
  movementType?: 'outflow' | 'inflow'
  quantity?: number
  reason?: string
  dedupeKey?: string
  isDuplicate?: boolean
  date?: Date | string
  createdAt?: Date | string
  timestamp?: Date | string
  type?: string
  [key: string]: any
}

interface RawProduct {
  _id: any
  name: string
  stock: number
  type?: string
  deleted?: boolean
  [key: string]: any
}

interface DuplicateGroup {
  fingerprint: string
  reference: string
  productId: string
  productName: string
  actionType: 'deduct' | 'restore'
  quantity: number
  reason: string
  totalOccurrences: number
  duplicateCount: number
  excessQty: number
  keepId: string
  dropIds: string[]
  dates: string[]
}

interface ProductCorrection {
  productId: string
  productName: string
  currentStock: number
  excessDeducted: number
  excessRestored: number
  stockCorrection: number
  correctedStock: number
  groups: DuplicateGroup[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalised action type: uses actionType when present (order movements),
 * falls back to movementType for supplier delivery / manual adjustment rows.
 */
function normaliseAction(m: RawMovement): 'deduct' | 'restore' {
  if (m.actionType === 'deduct' || m.actionType === 'restore') return m.actionType
  return m.movementType === 'outflow' ? 'deduct' : 'restore'
}

/**
 * Fingerprint that uniquely identifies one logical stock event.
 * Format:  <reference>:<productId>:<action>:<quantity>:<reason>
 */
function fingerprint(m: RawMovement): string {
  const ref = (m.reference ?? m.orderId ?? '').toString().trim()
  const pid = (m.productId ?? '').toString().trim()
  const act = normaliseAction(m)
  const qty = String(Math.abs(Number(m.quantity ?? 0)))
  const rsn = (m.reason ?? '').toString().trim()
  return `${ref}:${pid}:${act}:${qty}:${rsn}`
}

function isoDate(d: Date | string | undefined): string {
  if (!d) return 'unknown'
  try { return new Date(d).toISOString().replace('T', ' ').slice(0, 19) } catch { return String(d) }
}

function pad(n: number, w: number): string { return String(n).padStart(w, ' ') }

// ─── Core reconciliation ──────────────────────────────────────────────────────

async function reconcile(dryRun: boolean): Promise<void> {
  const MODE = dryRun ? 'DRY-RUN' : 'APPLY'

  console.log()
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log(`║        Inventory Reconciliation Script  [${MODE}${' '.repeat(18 - MODE.length)}]  ║`)
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()

  if (!process.env.MONGODB_URI) {
    console.error('❌  MONGODB_URI environment variable is required.')
    console.error('    Create a .env file or export MONGODB_URI=... before running.')
    process.exit(1)
  }

  // Force Google public DNS so the mongodb+srv:// SRV lookup works on Windows
  // (some local/corporate DNS resolvers refuse SRV record queries)
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1'])

  const client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS:          45000,
    connectTimeoutMS:         30000,
    retryWrites: true,
    retryReads:  true,
  })

  try {
    await client.connect()
    console.log('✅  Connected to MongoDB\n')
  } catch (err: any) {
    console.error('❌  Could not connect to MongoDB:', err.message)
    process.exit(1)
  }

  const db = client.db('infusion_jaba')

  // ── Step 1: Backup ──────────────────────────────────────────────────────────
  console.log('━━━  STEP 1 — Backup  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupDir = path.join(process.cwd(), 'backups')
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })

  const allProducts: RawProduct[] = await db.collection('bar_inventory')
    .find({ type: 'bar' }).toArray() as RawProduct[]

  const allMovements: RawMovement[] = await db.collection('bar_stock_movements')
    .find({ type: 'bar' }).toArray() as RawMovement[]

  const backupPath = path.join(backupDir, `inventory-backup-${ts}.json`)
  fs.writeFileSync(backupPath, JSON.stringify({
    exportedAt: new Date().toISOString(),
    totalProducts: allProducts.length,
    totalMovements: allMovements.length,
    bar_inventory: allProducts,
    bar_stock_movements: allMovements,
  }, null, 2))

  console.log(`  📦  ${allProducts.length} products, ${allMovements.length} movements`)
  console.log(`  💾  Backup → ${backupPath}\n`)

  // ── Step 2: Detect duplicate movements ─────────────────────────────────────
  console.log('━━━  STEP 2 — Detect duplicate movements  ━━━━━━━━━━━━━━━━━━━━')

  // Skip rows already tagged as duplicates by a previous run (idempotency)
  const eligible = allMovements.filter(m => m.isDuplicate !== true)
  console.log(`  🔎  Scanning ${eligible.length} eligible movements (${allMovements.length - eligible.length} already tagged, skipped)\n`)

  const groups = new Map<string, RawMovement[]>()
  for (const m of eligible) {
    const key = fingerprint(m)
    const arr = groups.get(key) ?? []
    arr.push(m)
    groups.set(key, arr)
  }

  const duplicateGroups: DuplicateGroup[] = []
  for (const [fp, docs] of groups) {
    if (docs.length < 2) continue

    // Sort oldest-first so we always keep the chronologically first occurrence
    const sorted = [...docs].sort((a, b) => {
      const da = new Date(a.date ?? a.createdAt ?? a.timestamp ?? 0).getTime()
      const db2 = new Date(b.date ?? b.createdAt ?? b.timestamp ?? 0).getTime()
      return da - db2
    })

    const first = sorted[0]
    const act = normaliseAction(first)
    const qty = Math.abs(Number(first.quantity ?? 0))

    duplicateGroups.push({
      fingerprint: fp,
      reference: (first.reference ?? first.orderId ?? '').toString(),
      productId: (first.productId ?? '').toString(),
      productName: first.productName ?? 'Unknown',
      actionType: act,
      quantity: qty,
      reason: first.reason ?? '',
      totalOccurrences: sorted.length,
      duplicateCount: sorted.length - 1,
      excessQty: (sorted.length - 1) * qty,
      keepId: sorted[0]._id.toString(),
      dropIds: sorted.slice(1).map(d => d._id.toString()),
      dates: sorted.map(d => isoDate(d.date ?? d.createdAt ?? d.timestamp)),
    })
  }

  if (duplicateGroups.length === 0) {
    console.log('  ✅  No duplicate movements found — inventory is already clean.\n')
    await client.close()
    return
  }

  console.log(`  ⚠️   Found ${duplicateGroups.length} duplicate group(s)\n`)

  // ── Step 3: Compute per-product corrections ─────────────────────────────────
  console.log('━━━  STEP 3 — Compute stock corrections  ━━━━━━━━━━━━━━━━━━━━━\n')

  const productIndex = new Map<string, RawProduct>()
  for (const p of allProducts) {
    productIndex.set(p._id.toString(), p)
  }

  const corrections = new Map<string, ProductCorrection>()

  for (const g of duplicateGroups) {
    const pid = g.productId
    if (!pid) continue

    if (!corrections.has(pid)) {
      const prod = productIndex.get(pid)
      corrections.set(pid, {
        productId: pid,
        productName: g.productName || prod?.name || 'Unknown',
        currentStock: Number(prod?.stock ?? 0),
        excessDeducted: 0,
        excessRestored: 0,
        stockCorrection: 0,
        correctedStock: 0,
        groups: [],
      })
    }

    const c = corrections.get(pid)!
    c.groups.push(g)
    if (g.actionType === 'deduct') {
      c.excessDeducted += g.excessQty
    } else {
      c.excessRestored += g.excessQty
    }
  }

  for (const c of corrections.values()) {
    // excess deductions took too much out  → add them back   (+)
    // excess restores put too much back in → remove the extra (-)
    c.stockCorrection = c.excessDeducted - c.excessRestored
    c.correctedStock  = c.currentStock + c.stockCorrection
    if (c.correctedStock < 0) {
      console.warn(`  ⚠️   "${c.productName}" corrected stock would be negative (${c.correctedStock}). Clamping to 0.`)
      c.correctedStock = 0
      c.stockCorrection = -c.currentStock
    }
  }

  const changed = [...corrections.values()].filter(c => c.stockCorrection !== 0)

  // ── Step 4: Print report to terminal ────────────────────────────────────────
  console.log('━━━  DUPLICATE MOVEMENTS DETAIL  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  for (const g of duplicateGroups.sort((a, b) => a.productName.localeCompare(b.productName))) {
    console.log(`  Product    : ${g.productName}`)
    console.log(`  Reference  : ${g.reference}`)
    console.log(`  Action     : ${g.actionType}  │  Qty/event: ${g.quantity}  │  Reason: ${g.reason}`)
    console.log(`  Occurrences: ${g.totalOccurrences}  │  Duplicates: ${g.duplicateCount}  │  Excess qty: ${g.excessQty}`)
    console.log(`  Timestamps : ${g.dates.join('  ·  ')}`)
    console.log(`  Keep  _id  : ${g.keepId}`)
    for (const id of g.dropIds) {
      console.log(`  Drop  _id  : ${id}`)
    }
    console.log()
  }

  console.log('━━━  STOCK CORRECTIONS SUMMARY  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  if (changed.length === 0) {
    console.log('  ✅  All duplicate movements cancel out — no stock values need changing.\n')
  } else {
    const colW = [30, 10, 14, 10, 12]
    const header = [
      'Product'.padEnd(colW[0]),
      'Current'.padStart(colW[1]),
      'Correction'.padStart(colW[2]),
      'Corrected'.padStart(colW[3]),
      'Excess Ded'.padStart(colW[4]),
    ].join('  ')
    console.log(`  ${header}`)
    console.log(`  ${'-'.repeat(header.length)}`)

    for (const c of changed.sort((a, b) => a.productName.localeCompare(b.productName))) {
      const sign = c.stockCorrection > 0 ? `+${c.stockCorrection}` : `${c.stockCorrection}`
      const row = [
        c.productName.slice(0, colW[0]).padEnd(colW[0]),
        pad(c.currentStock, colW[1]),
        sign.padStart(colW[2]),
        pad(c.correctedStock, colW[3]),
        pad(c.excessDeducted, colW[4]),
      ].join('  ')
      console.log(`  ${row}`)
    }
    console.log()
  }

  // ── Step 5: Write JSON report ────────────────────────────────────────────────
  const reportPath = path.join(backupDir, `inventory-reconciliation-report-${ts}.json`)
  const report = {
    generatedAt: new Date().toISOString(),
    mode: MODE,
    summary: {
      totalMovementsScanned: eligible.length,
      alreadyTaggedSkipped: allMovements.length - eligible.length,
      duplicateGroupsFound: duplicateGroups.length,
      productsWithStockCorrection: changed.length,
      totalExcessDeductions: duplicateGroups
        .filter(g => g.actionType === 'deduct')
        .reduce((s, g) => s + g.excessQty, 0),
    },
    duplicateGroups: duplicateGroups.map(g => ({
      fingerprint: g.fingerprint,
      reference: g.reference,
      productId: g.productId,
      productName: g.productName,
      actionType: g.actionType,
      quantity: g.quantity,
      reason: g.reason,
      totalOccurrences: g.totalOccurrences,
      duplicateCount: g.duplicateCount,
      excessQty: g.excessQty,
      keepId: g.keepId,
      dropIds: g.dropIds,
      dates: g.dates,
    })),
    productCorrections: [...corrections.values()].map(c => ({
      productId: c.productId,
      productName: c.productName,
      currentStock: c.currentStock,
      excessDeducted: c.excessDeducted,
      excessRestored: c.excessRestored,
      stockCorrection: c.stockCorrection,
      correctedStock: c.correctedStock,
    })),
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`  📄  Report → ${reportPath}\n`)

  // ── Step 6: DRY-RUN exit ────────────────────────────────────────────────────
  if (dryRun) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  DRY-RUN complete — zero changes written to the database.')
    console.log(`  ${changed.length} product(s) would be corrected.`)
    console.log(`  ${duplicateGroups.reduce((s, g) => s + g.duplicateCount, 0)} duplicate movement row(s) would be tagged.`)
    console.log()
    console.log('  To apply:  npx tsx scripts/reconcile-inventory.ts --apply')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    await client.close()
    return
  }

  // ── Step 7: Apply stock corrections ─────────────────────────────────────────
  console.log('━━━  STEP 7 — Apply stock corrections  ━━━━━━━━━━━━━━━━━━━━━━━\n')

  let productsUpdated = 0
  for (const c of changed) {
    let oid: ObjectId
    try { oid = new ObjectId(c.productId) } catch {
      console.warn(`  ⚠️   Invalid productId ${c.productId} — skipping`)
      continue
    }

    await db.collection('bar_inventory').updateOne(
      { _id: oid },
      { $inc: { stock: c.stockCorrection }, $set: { updatedAt: new Date(), lastReconciledAt: new Date() } }
    )
    const sign = c.stockCorrection > 0 ? `+${c.stockCorrection}` : `${c.stockCorrection}`
    console.log(`  ✅  ${c.productName}:  ${c.currentStock} → ${c.correctedStock}  (${sign})`)
    productsUpdated++
  }
  if (productsUpdated === 0) console.log('  ✅  No stock corrections needed.\n')
  else console.log()

  // ── Step 8: Tag duplicate movement rows ─────────────────────────────────────
  console.log('━━━  STEP 8 — Tag duplicate movement rows  ━━━━━━━━━━━━━━━━━━━\n')

  let movementsTagged = 0
  let movementsKeepTagged = 0

  for (const g of duplicateGroups) {
    // Set dedupeKey on the keeper so the new idempotency guard recognises it
    await db.collection('bar_stock_movements').updateOne(
      { _id: new ObjectId(g.keepId) },
      { $set: { dedupeKey: g.fingerprint, reconciledAt: new Date() } }
    )
    movementsKeepTagged++

    // Mark the extras as duplicates (they stay in the log for audit trail)
    if (g.dropIds.length > 0) {
      await db.collection('bar_stock_movements').updateMany(
        { _id: { $in: g.dropIds.map(id => new ObjectId(id)) } },
        {
          $set: {
            dedupeKey: g.fingerprint,
            isDuplicate: true,
            reconciledAt: new Date(),
            reconciledNote: 'Duplicate of original movement — tagged by inventory reconciliation script',
          },
        }
      )
      movementsTagged += g.dropIds.length
    }
  }

  // Backfill dedupeKey on ALL other bar movements that don't have one yet
  // (so the idempotency guard in inventory-ops.ts covers them going forward)
  console.log('  🏷️   Backfilling dedupeKey on remaining movements (no dedupeKey set)...')
  const withoutKey: RawMovement[] = await db.collection('bar_stock_movements')
    .find({ type: 'bar', dedupeKey: { $exists: false }, isDuplicate: { $ne: true } })
    .toArray() as RawMovement[]

  let backfilled = 0
  for (const m of withoutKey) {
    const fp = fingerprint(m)
    await db.collection('bar_stock_movements').updateOne(
      { _id: m._id },
      { $set: { dedupeKey: fp } }
    )
    backfilled++
  }

  console.log(`  ✅  ${movementsTagged} duplicate row(s) tagged isDuplicate:true`)
  console.log(`  ✅  ${movementsKeepTagged} keeper row(s) tagged with dedupeKey`)
  console.log(`  ✅  ${backfilled} remaining row(s) backfilled with dedupeKey\n`)

  // ── Final summary ────────────────────────────────────────────────────────────
  console.log('━━━  APPLY COMPLETE  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log(`  Products stock-corrected        : ${productsUpdated}`)
  console.log(`  Duplicate movements tagged      : ${movementsTagged}`)
  console.log(`  Movements backfilled (dedupeKey): ${backfilled}`)
  console.log(`  Backup                          : ${backupPath}`)
  console.log(`  Report                          : ${reportPath}`)
  console.log()

  await client.close()
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const isApply = args.includes('--apply')

reconcile(!isApply).catch(err => {
  console.error('\n❌  Fatal error:', err?.message ?? err)
  process.exit(1)
})
