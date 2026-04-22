/**
 * Server-authoritative FIFO allocation for Jaba delivery notes.
 * Never trust client batch/package numbers for stock math — derive from DB snapshots.
 */

export class JabaFifoAllocationError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'JabaFifoAllocationError'
    this.status = status
  }
}

/** KES amounts stored on notes — 2 decimal places, half-up. */
export function roundMoneyKes(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export type StaffDistributionLineInput = {
  flavor: string
  productType?: string
  productName?: string
  size: string
  flavourLineId?: string
  quantity: number
  pricePerUnit: number
}

export type FifoPackagedSlot = {
  slotId: string
  packagingOutputId: string
  batchId: string
  batchNumber: string
  packageNumber: string
  flavourLineId?: string
  flavorLabel: string
  /** Same scheme as legacy UI: fid:… or fl:… */
  flavourSeg: string
  size: string
  qtyPackaged: number
  /** Oldest-first production time (date → productionDate → infusionDate → createdAt) */
  batchFifoTime: number
  /** @deprecated use batchFifoTime — kept for any external debug dumps */
  batchSortAt: number
  poSortAt: number
  poOid: string
  productType: string
}

export type FifoSlotWithRemaining = FifoPackagedSlot & { remaining: number }

export type FifoDerivedDeliveryItem = {
  finishedGoodId: string
  productName: string
  flavor: string
  productType: string
  size: string
  batchNumber: string
  batchId: string
  packageNumber: string
  packagingOutputId: string
  flavourLineId?: string
  quantity: number
  pricePerUnit: number
  totalCost: number
}

export type FifoAllocationTraceLine = {
  staffLineIndex: number
  flavor: string
  flavourLineId?: string
  size: string
  requestedQty: number
  pricePerUnit: number
  slices: Array<{
    packagingOutputId: string
    batchId: string
    batchNumber: string
    packageNumber: string
    flavourLineId?: string
    size: string
    quantity: number
  }>
}

export function normalizeFlavorName(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function flavourSegFromPackaging(po: Record<string, unknown>, batchFlavor: string): string {
  if (po.flavourLineId != null && String(po.flavourLineId).trim() !== '') {
    return `fid:${String(po.flavourLineId)}`
  }
  const name = String(po.flavourName || batchFlavor || '').trim()
  return `fl:${normalizeFlavorName(name)}`
}

export function flavourSegFromStaffLine(line: StaffDistributionLineInput): string {
  if (line.flavourLineId != null && String(line.flavourLineId).trim() !== '') {
    return `fid:${String(line.flavourLineId)}`
  }
  return `fl:${normalizeFlavorName(line.flavor)}`
}

export function flavourSegFromDeliveryNoteItem(item: Record<string, unknown>): string {
  if (item.flavourLineId != null && String(item.flavourLineId).trim() !== '') {
    return `fid:${String(item.flavourLineId)}`
  }
  return `fl:${normalizeFlavorName(String(item.flavor || ''))}`
}

function mongoIdString(x: unknown): string {
  if (x == null) return ''
  if (typeof x === 'string') return x
  if (typeof x === 'object' && x !== null && 'toString' in x) return String((x as { toString(): string }).toString())
  return String(x)
}

function timeMs(d: unknown): number {
  if (d instanceof Date) return d.getTime()
  if (typeof d === 'string' || typeof d === 'number') {
    const t = new Date(d).getTime()
    return Number.isFinite(t) ? t : 0
  }
  return 0
}

/** BCH-2026-01310 → { year: 2026, seq: 1310 } — authoritative FIFO for Infusion Jaba batches */
export function parseJabaBatchOrdinal(batchNumber: string): { year: number; seq: number } | null {
  const m = String(batchNumber || '')
    .trim()
    .match(/^BCH-(\d{4})-(\d+)$/i)
  if (!m) return null
  return { year: parseInt(m[1], 10), seq: parseInt(m[2], 10) }
}

function batchFifoPrimaryTime(batch: Record<string, unknown>): number {
  const t =
    timeMs(batch.date) ||
    timeMs(batch.productionDate) ||
    timeMs(batch.infusionDate) ||
    timeMs(batch.createdAt) ||
    0
  return t
}

/** Mongo ObjectId 24-hex → insertion time (older id → smaller ms). */
function objectIdToCreationMs(hex: string): number {
  if (!/^[a-f0-9]{24}$/i.test(hex)) return 0
  return parseInt(hex.slice(0, 8), 16) * 1000
}

/**
 * Global ordering for packaged slots: exhaust lower batch numbers first, then production time,
 * then packaging doc order. Packaging completion time alone must not reorder batches.
 */
export function compareFifoPackagedSlots(a: FifoPackagedSlot, b: FifoPackagedSlot): number {
  const oa = parseJabaBatchOrdinal(a.batchNumber)
  const ob = parseJabaBatchOrdinal(b.batchNumber)
  if (oa && ob) {
    if (oa.year !== ob.year) return oa.year - ob.year
    if (oa.seq !== ob.seq) return oa.seq - ob.seq
  }

  if (a.batchFifoTime !== b.batchFifoTime) return a.batchFifoTime - b.batchFifoTime

  const lex = a.batchNumber.localeCompare(b.batchNumber, undefined, { numeric: true, sensitivity: 'base' })
  if (lex !== 0) return lex

  const idA = objectIdToCreationMs(a.batchId)
  const idB = objectIdToCreationMs(b.batchId)
  if (idA !== idB) return idA - idB

  if (a.poSortAt !== b.poSortAt) return a.poSortAt - b.poSortAt
  return a.poOid.localeCompare(b.poOid)
}

function groupKey(flavourSeg: string, size: string): string {
  return `${flavourSeg}@@${size}`
}

/** Same key as {@link FlavorSizePickupRow}.groupKey — use for UI line identity. */
export function staffFieldsToPickupGroupKey(line: {
  flavor: string
  flavourLineId?: string
  size: string
}): string {
  const seg = flavourSegFromStaffLine({
    flavor: line.flavor,
    flavourLineId: line.flavourLineId,
    productType: undefined,
    productName: undefined,
    size: line.size,
    quantity: 1,
    pricePerUnit: 0,
  })
  return groupKey(seg, normalizeSize(line.size))
}

const SIZES_ORDER = ['250ml', '500ml', '1L', '2L']

function normalizeSize(raw: string): string {
  const s = String(raw || '').trim()
  if (SIZES_ORDER.includes(s)) return s
  return s
}

function legacyAggKey(batchNumber: string, flavourSeg: string, size: string): string {
  return `${batchNumber}|${flavourSeg}|${size}`
}

/**
 * Build ordered packaged slots (per packaging output document × bottle size).
 */
export function buildPackagedSlots(packagingOutputs: unknown[], batches: unknown[]): FifoPackagedSlot[] {
  const batchById = new Map<string, Record<string, unknown>>()
  for (const b of batches as Record<string, unknown>[]) {
    const id = mongoIdString(b._id ?? b.id)
    if (id) batchById.set(id, b)
  }

  const slots: FifoPackagedSlot[] = []

  for (const po of packagingOutputs as Record<string, unknown>[]) {
    const batchId = String(po.batchId || '')
    const batch = batchById.get(batchId)
    if (!batch) continue
    const batchNumber = String(batch.batchNumber || po.batchNumber || '')
    if (!batchNumber) continue
    const batchFlavor = String(batch.flavor || '')
    const flavourSeg = flavourSegFromPackaging(po, batchFlavor)
    const flavorLabel = String(po.flavourName || batchFlavor || 'Unknown').trim()
    const productType = String(batch.productCategory || 'Juice')
    const pkgNumRaw = String(po.packageNumber || '').trim()
    const packageNumber =
      pkgNumRaw && pkgNumRaw.startsWith('PKG-') ? pkgNumRaw : String(po.batchNumber || batchNumber || '')

    const containers = Array.isArray(po.containers) ? po.containers : []
    const poOid = mongoIdString(po._id)
    if (!poOid) continue
    const batchFifoTime = batchFifoPrimaryTime(batch)
    const poSortAt = timeMs(po.createdAt) || timeMs(po.packagingDate) || 0

    for (const c of containers as Record<string, unknown>[]) {
      const size = normalizeSize(String(c.size || '500ml'))
      const qty = Number(c.quantity) || 0
      if (!(qty > 0)) continue
      const slotId = `${poOid}|${size}`
      slots.push({
        slotId,
        packagingOutputId: poOid,
        batchId,
        batchNumber,
        packageNumber,
        flavourLineId: po.flavourLineId != null ? String(po.flavourLineId) : undefined,
        flavorLabel,
        flavourSeg,
        size,
        qtyPackaged: qty,
        batchFifoTime,
        batchSortAt: batchFifoTime,
        poSortAt,
        poOid,
        productType,
      })
    }
  }

  slots.sort(compareFifoPackagedSlots)

  return slots
}

type AllocMaps = {
  /** slotId -> qty */
  direct: Map<string, number>
  /** legacyAggKey -> qty */
  legacy: Map<string, number>
}

function accumulateAllocationsFromNotes(
  deliveryNotes: unknown[],
  opts: { excludeNoteId?: string | null }
): AllocMaps {
  const direct = new Map<string, number>()
  const legacy = new Map<string, number>()
  const ex = opts.excludeNoteId ? String(opts.excludeNoteId) : ''

  for (const note of deliveryNotes as Record<string, unknown>[]) {
    const nid = mongoIdString(note._id)
    if (ex && nid === ex) continue
    const items = Array.isArray(note.items) ? note.items : []
    for (const raw of items as Record<string, unknown>[]) {
      const qty = Number(raw.quantity) || 0
      if (!(qty > 0)) continue
      const size = normalizeSize(String(raw.size || ''))
      const batchNumber = String(raw.batchNumber || '')
      const flavourSeg = flavourSegFromDeliveryNoteItem(raw)
      const poId = String(raw.packagingOutputId || '').trim()
      if (poId) {
        const slotId = `${poId}|${size}`
        direct.set(slotId, (direct.get(slotId) || 0) + qty)
      } else if (batchNumber) {
        const lk = legacyAggKey(batchNumber, flavourSeg, size)
        legacy.set(lk, (legacy.get(lk) || 0) + qty)
      }
    }
  }

  return { direct, legacy }
}

/**
 * Apply legacy (non–packaging-output-id) consumption FIFO within each (batch, flavourSeg, size) bucket,
 * then subtract direct allocations per slot. Returns remaining per slot (>= 0).
 */
export function computeFifoSlotRemainings(
  slots: FifoPackagedSlot[],
  deliveryNotes: unknown[],
  opts: { excludeNoteId?: string | null }
): FifoSlotWithRemaining[] {
  const { direct, legacy } = accumulateAllocationsFromNotes(deliveryNotes, opts)

  const legacyDebt = new Map<string, number>(legacy)
  const remainingBySlot = new Map<string, number>()

  for (const s of slots) {
    const lk = legacyAggKey(s.batchNumber, s.flavourSeg, s.size)
    const debt = legacyDebt.get(lk) || 0
    const take = Math.min(s.qtyPackaged, Math.max(0, debt))
    const afterLegacy = s.qtyPackaged - take
    legacyDebt.set(lk, Math.max(0, debt - take))
    const directTake = direct.get(s.slotId) || 0
    const rem = Math.max(0, afterLegacy - directTake)
    remainingBySlot.set(s.slotId, rem)
  }

  return slots.map((s) => ({
    ...s,
    remaining: remainingBySlot.get(s.slotId) || 0,
  }))
}

export type FlavorSizePickupRow = {
  groupKey: string
  flavourSeg: string
  displayFlavor: string
  productType: string
  size: string
  flavourLineId?: string
  /** Informational — server recomputes at save */
  availableBottles: number
}

/**
 * UI: all distributable combinations (flavour + size) with packaged stock remaining.
 */
export function listFlavorSizePickupGroups(
  packagingOutputs: unknown[],
  batches: unknown[],
  deliveryNotes: unknown[],
  opts?: { excludeNoteId?: string | null; allowedBatchIds?: Set<string> | null }
): FlavorSizePickupRow[] {
  let slots = buildPackagedSlots(packagingOutputs, batches)
  if (opts?.allowedBatchIds && opts.allowedBatchIds.size > 0) {
    const allow = opts.allowedBatchIds
    slots = slots.filter((s) => allow.has(s.batchId))
  }
  const withRem = computeFifoSlotRemainings(slots, deliveryNotes, { excludeNoteId: opts?.excludeNoteId })
  const byGroup = new Map<string, FifoSlotWithRemaining[]>()
  for (const s of withRem) {
    const gk = groupKey(s.flavourSeg, s.size)
    if (!byGroup.has(gk)) byGroup.set(gk, [])
    byGroup.get(gk)!.push(s)
  }

  const rows: FlavorSizePickupRow[] = []
  for (const [gk, groupSlots] of byGroup) {
    const avail = groupSlots.reduce((a, s) => a + s.remaining, 0)
    if (!(avail > 0)) continue
    const first = groupSlots[0]!
    rows.push({
      groupKey: gk,
      flavourSeg: first.flavourSeg,
      displayFlavor: first.flavorLabel,
      productType: first.productType,
      size: first.size,
      flavourLineId: first.flavourLineId,
      availableBottles: avail,
    })
  }

  rows.sort((a, b) => {
    if (a.displayFlavor !== b.displayFlavor) return a.displayFlavor.localeCompare(b.displayFlavor)
    const ia = SIZES_ORDER.indexOf(a.size)
    const ib = SIZES_ORDER.indexOf(b.size)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return a.size.localeCompare(b.size)
  })

  return rows
}

function validateStaffLine(line: StaffDistributionLineInput, index: number): void {
  const q = Number(line.quantity)
  if (!Number.isFinite(q) || !Number.isInteger(q) || q <= 0) {
    throw new JabaFifoAllocationError(`Line ${index + 1}: quantity must be a positive whole number`, 400)
  }
  const p = Number(line.pricePerUnit)
  if (!Number.isFinite(p) || p < 0 || p > 1e12) {
    throw new JabaFifoAllocationError(`Line ${index + 1}: invalid price per unit`, 400)
  }
  const size = normalizeSize(line.size)
  if (!size) {
    throw new JabaFifoAllocationError(`Line ${index + 1}: bottle size is required`, 400)
  }
  const hasLineId = line.flavourLineId != null && String(line.flavourLineId).trim() !== ''
  if (!hasLineId && !normalizeFlavorName(line.flavor)) {
    throw new JabaFifoAllocationError(`Line ${index + 1}: flavor is required`, 400)
  }
}

/**
 * Turn staff-visible lines (flavour + size + qty + price) into persisted delivery items + audit trace.
 * Ignores any batch/package hints on the input lines.
 */
export function deriveFifoDeliveryNotePayload(args: {
  staffLines: StaffDistributionLineInput[]
  packagingOutputs: unknown[]
  batches: unknown[]
  deliveryNotes: unknown[]
  /** When editing, exclude this note's _id string from consumption math */
  excludeNoteId?: string | null
}): { items: FifoDerivedDeliveryItem[]; totalCost: number; allocationTrace: FifoAllocationTraceLine[] } {
  const { staffLines, packagingOutputs, batches, deliveryNotes, excludeNoteId } = args
  const filtered = staffLines.filter((l) => (Number(l.quantity) || 0) > 0)
  if (filtered.length === 0) {
    throw new JabaFifoAllocationError('At least one line with quantity greater than 0 is required', 400)
  }

  filtered.forEach((l, i) => validateStaffLine(l, i))

  const slots = buildPackagedSlots(packagingOutputs, batches)
  const withRem = computeFifoSlotRemainings(slots, deliveryNotes, { excludeNoteId })
  const byGroup = new Map<string, FifoSlotWithRemaining[]>()
  for (const s of withRem) {
    const gk = groupKey(s.flavourSeg, s.size)
    if (!byGroup.has(gk)) byGroup.set(gk, [])
    byGroup.get(gk)!.push(s)
  }

  const working = new Map<string, number>()
  for (const s of withRem) working.set(s.slotId, s.remaining)

  const items: FifoDerivedDeliveryItem[] = []
  const allocationTrace: FifoAllocationTraceLine[] = []

  filtered.forEach((line, staffLineIndex) => {
    const seg = flavourSegFromStaffLine(line)
    const size = normalizeSize(line.size)
    const gk = groupKey(seg, size)
    const groupSlots = byGroup.get(gk)
    const need = Number(line.quantity) || 0
    const pricePerUnit = roundMoneyKes(Number(line.pricePerUnit) || 0)

    if (!groupSlots || groupSlots.length === 0) {
      throw new JabaFifoAllocationError(
        `No packaged stock exists for ${line.flavor || 'product'} (${size}).`,
        400
      )
    }

    const totalAvail = groupSlots.reduce((a, s) => a + (working.get(s.slotId) || 0), 0)
    if (need > totalAvail) {
      throw new JabaFifoAllocationError(
        `Insufficient stock for ${line.flavor || 'product'} (${size}). Available: ${totalAvail.toLocaleString()}, requested: ${need.toLocaleString()}.`,
        400
      )
    }

    const slices: FifoAllocationTraceLine['slices'] = []
    let left = need
    const ordered = [...groupSlots].sort(compareFifoPackagedSlots)

    for (const slot of ordered) {
      if (left <= 0) break
      const rem = working.get(slot.slotId) || 0
      if (rem <= 0) continue
      const take = Math.min(rem, left)
      if (take <= 0) continue
      working.set(slot.slotId, rem - take)
      left -= take

      const productName =
        String(line.productName || '').trim() ||
        `${String(line.productType || slot.productType || 'Juice')} of ${String(line.flavor || slot.flavorLabel).trim()}`

      items.push({
        finishedGoodId: `${slot.packagingOutputId}|${size}`,
        productName,
        flavor: String(line.flavor || slot.flavorLabel).trim(),
        productType: String(line.productType || slot.productType || 'Juice'),
        size,
        batchNumber: slot.batchNumber,
        batchId: slot.batchId,
        packageNumber: slot.packageNumber || '',
        packagingOutputId: slot.packagingOutputId,
        flavourLineId: slot.flavourLineId,
        quantity: take,
        pricePerUnit,
        totalCost: roundMoneyKes(take * pricePerUnit),
      })

      slices.push({
        packagingOutputId: slot.packagingOutputId,
        batchId: slot.batchId,
        batchNumber: slot.batchNumber,
        packageNumber: slot.packageNumber || '',
        flavourLineId: slot.flavourLineId,
        size,
        quantity: take,
      })
    }

    if (left > 0) {
      throw new JabaFifoAllocationError(
        `FIFO allocation failed for ${line.flavor} (${size}); remaining request: ${left}.`,
        500
      )
    }

    allocationTrace.push({
      staffLineIndex,
      flavor: String(line.flavor || '').trim(),
      flavourLineId: line.flavourLineId ? String(line.flavourLineId) : undefined,
      size,
      requestedQty: need,
      pricePerUnit,
      slices,
    })
  })

  const totalCost = roundMoneyKes(items.reduce((s, it) => s + it.totalCost, 0))

  return { items, totalCost, allocationTrace }
}

/** Collapse persisted note lines into staff lines for edit UI (same flavour+size+price → one row). */
export function collapseNoteItemsToStaffLines(
  items: unknown[]
): StaffDistributionLineInput[] {
  const arr = Array.isArray(items) ? items : []
  type Key = string
  const map = new Map<
    Key,
    { flavor: string; productType: string; productName: string; size: string; flavourLineId?: string; qty: number; price: number }
  >()

  for (const raw of arr as Record<string, unknown>[]) {
    const qty = Number(raw.quantity) || 0
    if (!(qty > 0)) continue
    const price = Number(raw.pricePerUnit) || 0
    const size = normalizeSize(String(raw.size || ''))
    const flavor = String(raw.flavor || '').trim()
    const productType = String(raw.productType || 'Juice')
    const productName = String(raw.productName || '').trim()
    const flavourLineId = raw.flavourLineId != null ? String(raw.flavourLineId) : undefined
    const fk = `${flavourLineId || `fl:${normalizeFlavorName(flavor)}`}|${size}|${price}`
    const prev = map.get(fk)
    if (prev) {
      prev.qty += qty
    } else {
      map.set(fk, { flavor, productType, productName: productName || `${productType} of ${flavor}`, size, flavourLineId, qty, price })
    }
  }

  return [...map.values()].map((v) => ({
    flavor: v.flavor,
    productType: v.productType,
    productName: v.productName,
    size: v.size,
    flavourLineId: v.flavourLineId,
    quantity: v.qty,
    pricePerUnit: v.price,
  }))
}
