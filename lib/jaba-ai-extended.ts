/**
 * Derived intelligence: profit proxies, forecasts, digests, comparisons, partner intel.
 */
import type {
  AiRecommendation,
  ComparisonBlock,
  DigestBundle,
  DistributorIntel,
  ExecutiveSummary,
  ForecastItem,
  JabaAiCharts,
  JabaAiKpis,
  NeedsAttentionItem,
  ProfitIntelligence,
  SmartAlert,
  SupplierIntel,
  WastageSignal,
} from '@/lib/jaba-ai-intelligence-types'

function num(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const n = parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

function deltaPct(a: number, b: number): number | null {
  if (b === 0) return null
  return Math.round(((a - b) / b) * 1000) / 10
}

export function enrichRecommendations(
  recs: AiRecommendation[],
  generatedAt: string,
  defaultSources: string[]
): AiRecommendation[] {
  return recs.map((r) => ({
    ...r,
    why:
      r.why ??
      (r.priority === 'high'
        ? 'Thresholds for operational risk or stock-out are currently met.'
        : 'Derived from recent production, stock, and distribution patterns in Jaba data.'),
    sources: r.sources ?? defaultSources,
    confidence: r.confidence ?? (r.priority === 'high' ? 'medium' : 'low'),
    dataFreshness: r.dataFreshness ?? generatedAt,
  }))
}

export function buildProfitIntelligence(
  kpis: JabaAiKpis,
  charts: JabaAiCharts,
  flavorDistribution: Array<{ flavor: string; batches: number; litres: number }>,
  fgBatches: unknown[],
  topMaterials: Array<{ name: string; cost?: number; quantityUsed?: number; category?: string }>,
  monthlyMaterial: Array<{ month: string; usage: number; cost: number }>
): ProfitIntelligence {
  const totalLitres = flavorDistribution.reduce((s, f) => s + num(f.litres), 0) || 1
  const totalMatCost = topMaterials.reduce((s, m) => s + num(m.cost), 0) || 1
  const costPerLitreProxy = totalMatCost / totalLitres

  const bestEstimatedMarginFlavours = flavorDistribution
    .filter((f) => f.flavor && f.flavor !== 'Unknown')
    .map((f) => {
      const share = num(f.litres) / totalLitres
      const intensity = num(f.litres) / Math.max(1, f.batches)
      const score = Math.round(
        share * 100 * Math.log1p(intensity) * (1 / (1 + costPerLitreProxy / 1000))
      )
      return {
        flavor: f.flavor,
        score,
        note: `~${share * 100}% of recent flavour litres with ${f.batches} batch runs. Ingredient cost is allocated at a plant average — use as a directional signal only.`,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)

  const flavourStock = new Map<string, { rem: number; dist: number }>()
  for (const row of fgBatches) {
    const b = row as Record<string, unknown>
    const fl = String(b.flavor || 'Unknown')
    let rem = 0
    for (const sz of ['250ml', '500ml', '1L', '2L'] as const) {
      const block = b[`total${sz}`] as { remaining?: number } | undefined
      rem += num(block?.remaining)
    }
    const tb = b.totalBottles as { distributed?: number } | undefined
    const dist = num(tb?.distributed)
    const cur = flavourStock.get(fl) || { rem: 0, dist: 0 }
    cur.rem += rem
    cur.dist += dist
    flavourStock.set(fl, cur)
  }

  const notWorthPushing: ProfitIntelligence['notWorthPushing'] = []
  for (const [fl, v] of flavourStock) {
    if (fl === 'Unknown') continue
    if (v.rem > 400 && v.rem > v.dist * 5) {
      notWorthPushing.push({
        flavor: fl,
        reason: 'High remaining finished stock vs recorded distribution pull-through — pushing more production may tie cash without velocity.',
      })
    }
  }
  notWorthPushing.sort((a, b) => a.flavor.localeCompare(b.flavor))

  const highVolumeLowValueStock: ProfitIntelligence['highVolumeLowValueStock'] = charts.topBottleSizes
    .filter((r) => r.stockBottles > 200 && r.dispatchedBottles < r.stockBottles * 0.08)
    .map((r) => ({
      label: r.size,
      bottles: r.stockBottles,
      note: 'High warehouse concentration vs dispatch — working capital may be trapped in this SKU format.',
    }))

  const weight = (sz: string) => ({ '250ml': 1, '500ml': 2, '1L': 4, '2L': 8 }[sz] ?? 1)
  const expensiveIdleStock: ProfitIntelligence['expensiveIdleStock'] = []
  for (const row of fgBatches.slice(0, 40)) {
    const b = row as Record<string, unknown>
    const fl = String(b.flavor || '')
    let rem = 0
    for (const sz of ['250ml', '500ml', '1L', '2L'] as const) {
      const block = b[`total${sz}`] as { remaining?: number } | undefined
      rem += num(block?.remaining) * weight(sz)
    }
    if (rem > 80) {
      expensiveIdleStock.push({
        label: `${fl || 'Batch'} ${String(b.batchNumber || '')}`.trim(),
        estRelativeValue: Math.round(rem),
        note: 'Relative idle value score from remaining bottles × format weight — not a financial statement.',
      })
    }
  }
  expensiveIdleStock.sort((a, b) => b.estRelativeValue - a.estRelativeValue).splice(8)

  const risingCostMaterials: ProfitIntelligence['risingCostMaterials'] = []
  if (monthlyMaterial.length >= 2) {
    const last = monthlyMaterial[monthlyMaterial.length - 1]
    const prev = monthlyMaterial[monthlyMaterial.length - 2]
    const lastCpu = last.usage > 0 ? last.cost / last.usage : 0
    const prevCpu = prev.usage > 0 ? prev.cost / prev.usage : 0
    if (prevCpu > 0 && lastCpu > prevCpu * 1.12) {
      risingCostMaterials.push({
        name: 'Blended materials (month-over-month)',
        pctChangeVsPrior: Math.round(((lastCpu - prevCpu) / prevCpu) * 1000) / 10,
        note: 'Average cost per unit of usage moved up vs the prior month — review supplier pricing and yields.',
      })
    }
  }

  for (const m of topMaterials.slice(0, 5)) {
    if (num(m.cost) === 0 && num(m.quantityUsed) > 0) {
      risingCostMaterials.push({
        name: m.name,
        pctChangeVsPrior: null,
        note: 'High usage but recorded cost is zero — buying price may be missing for margin analysis.',
      })
    }
  }

  return {
    bestEstimatedMarginFlavours,
    notWorthPushing: notWorthPushing.slice(0, 5),
    highVolumeLowValueStock,
    expensiveIdleStock,
    risingCostMaterials: risingCostMaterials.slice(0, 6),
  }
}

export function buildForecasts(
  kpis: JabaAiKpis,
  charts: JabaAiCharts,
  topMaterials: Array<{ name: string; currentStock?: number; quantityUsed?: number; unit?: string }>,
  _monthlyMaterial: Array<{ usage: number }>
): ForecastItem[] {
  const out: ForecastItem[] = []

  for (const m of topMaterials.slice(0, 5)) {
    const stock = num(m.currentStock)
    const burn = num(m.quantityUsed) / 30
    if (stock > 0 && burn > 0.01) {
      const days = Math.floor(stock / burn)
      if (days < 21) {
        out.push({
          id: `fc-${m.name}`,
          label: m.name,
          prediction: `At recent usage, stock may reach critical in ~${days} days (rule-of-thumb).`,
          horizonDays: days,
          confidence: 'low',
        })
      }
    }
  }

  const maxSize = charts.topBottleSizes.reduce((m, r) => (r.stockBottles > m ? r.stockBottles : m), 0) || 1
  for (const row of charts.topBottleSizes) {
    if (row.stockBottles > 0 && row.stockBottles < maxSize * 0.12 && row.dispatchedBottles > row.stockBottles) {
      out.push({
        id: `fc-bottle-${row.size}`,
        label: row.size,
        prediction: 'This bottle format has relatively low remaining stock vs others — plan packaging replenishment.',
        horizonDays: 14,
        confidence: 'low',
      })
    }
  }

  const recentDist = charts.weeklyDistribution.slice(-2).reduce((s, w) => s + num(w.quantity), 0)
  const priorDist = charts.weeklyDistribution.slice(-4, -2).reduce((s, w) => s + num(w.quantity), 0)
  if (recentDist > 0 || priorDist > 0) {
    out.push({
      id: 'fc-demand',
      label: 'Dispatch volume',
      prediction: `Short-term demand proxy: recent window ${Math.round(recentDist)} units vs prior ${Math.round(priorDist)}.`,
      horizonDays: 7,
      confidence: 'medium',
    })
  }

  const slow = charts.topFlavours.find((f) => f.batches > 1 && f.litres < charts.topFlavours[0].litres * 0.25)
  if (slow) {
    out.push({
      id: 'fc-slow-fl',
      label: slow.flavor,
      prediction: 'If the current trend continues, this flavour may remain slow-moving vs the rest of the mix.',
      horizonDays: 30,
      confidence: 'low',
    })
  }

  return out.slice(0, 10)
}

export function buildComparisons(
  charts: JabaAiCharts,
  monthlyProduction: Array<{ month: string; litres: number }>,
  monthlyDistribution: Array<{ month: string; items: number }>
): ComparisonBlock {
  const dp = charts.dailyProduction
  let todayVsYesterday: ComparisonBlock['todayVsYesterday'] = null
  if (dp.length >= 2) {
    const y = dp[dp.length - 2]
    const t = dp[dp.length - 1]
    todayVsYesterday = {
      litres: {
        yesterday: num(y.litres),
        today: num(t.litres),
        deltaPct: deltaPct(num(t.litres), num(y.litres)),
      },
      batches: {
        yesterday: num(y.batches),
        today: num(t.batches),
        deltaPct: deltaPct(num(t.batches), num(y.batches)),
      },
    }
  }

  let thisWeekVsLastWeek: ComparisonBlock['thisWeekVsLastWeek'] = null
  const wp = charts.weeklyProduction
  const wd = charts.weeklyDistribution
  if (wp.length >= 2 && wd.length >= 2) {
    const mid = Math.floor(wp.length / 2)
    const midD = Math.floor(wd.length / 2)
    const lastWeek = wp.slice(0, mid).reduce((s, w) => s + num(w.litres), 0)
    const thisWeek = wp.slice(mid).reduce((s, w) => s + num(w.litres), 0)
    const dLastW = wd.slice(0, midD).reduce((s, w) => s + num(w.quantity), 0)
    const dThisW = wd.slice(midD).reduce((s, w) => s + num(w.quantity), 0)
    thisWeekVsLastWeek = {
      litres: {
        lastWeek,
        thisWeek,
        deltaPct: deltaPct(thisWeek, lastWeek),
      },
      deliveries: {
        lastWeek: dLastW,
        thisWeek: dThisW,
        deltaPct: deltaPct(dThisW, dLastW),
      },
    }
  }

  let thisMonthVsLastMonth: ComparisonBlock['thisMonthVsLastMonth'] = null
  if (monthlyProduction.length >= 2 && monthlyDistribution.length >= 2) {
    const mp = monthlyProduction[monthlyProduction.length - 1]?.litres ?? 0
    const mpPrev = monthlyProduction[monthlyProduction.length - 2]?.litres ?? 0
    const md = monthlyDistribution[monthlyDistribution.length - 1]?.items ?? 0
    const mdPrev = monthlyDistribution[monthlyDistribution.length - 2]?.items ?? 0
    thisMonthVsLastMonth = {
      productionLitres: {
        lastMonth: mpPrev,
        thisMonth: mp,
        deltaPct: deltaPct(mp, mpPrev),
      },
      distributionItems: {
        lastMonth: mdPrev,
        thisMonth: md,
        deltaPct: deltaPct(md, mdPrev),
      },
    }
  }

  return { todayVsYesterday, thisWeekVsLastWeek, thisMonthVsLastMonth }
}

export function buildDigests(
  kpis: JabaAiKpis,
  executive: ExecutiveSummary,
  alerts: SmartAlert[],
  profit: ProfitIntelligence
): DigestBundle {
  const crit = alerts.filter((a) => a.severity === 'critical').length
  const todaySummary = `Health ${executive.healthStatus} (score ${executive.healthScore}). ${kpis.batchesToday} batches today, ${Math.round(
    kpis.litresProducedToday
  )}L, ${kpis.pendingDistributions} pending distributions, ${kpis.lowStockMaterialsCount} low-stock materials.`
  const weeklyOperational = `QC queue ${kpis.batchesInQC}. Finished goods ~${kpis.finishedGoodsStockTotalBottles} bottles on hand. ${
    profit.bestEstimatedMarginFlavours[0]
      ? `Leading flavour by mix: ${profit.bestEstimatedMarginFlavours[0].flavor}.`
      : ''
  }`
  const weeklyRisk = `Active rule alerts: ${alerts.length} (${crit} critical). Focus: ${executive.biggestRisk}`
  const weeklyOpportunity = executive.biggestOpportunity
  return { todaySummary, weeklyOperational, weeklyRisk, weeklyOpportunity }
}

export function buildSupplierIntel(
  flowEntries: Array<Record<string, unknown>>,
  lowStockNames: string[]
): SupplierIntel {
  const restockBySupplier = new Map<string, number>()
  for (const e of flowEntries) {
    if (String(e.direction) !== 'in') continue
    const ref = String(e.reference || '')
    const supplier = ref.split('·')[0]?.trim() || ref
    if (!supplier) continue
    restockBySupplier.set(supplier, (restockBySupplier.get(supplier) || 0) + 1)
  }
  const total = [...restockBySupplier.values()].reduce((a, b) => a + b, 0) || 1
  const supplierRestockConcentration = [...restockBySupplier.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([supplierName, n]) => ({
      supplierName,
      sharePct: Math.round((n / total) * 1000) / 10,
      note: 'Share of recent in-bound flow lines (supplier restock signals).',
    }))

  const suppliersLinkedToStockRisk = lowStockNames.slice(0, 4).map((material) => ({
    supplierName: 'Review PO history',
    material,
    note: 'Material is at risk — cross-check last restock lead times in supplier history.',
  }))

  return {
    suppliersLinkedToStockRisk,
    supplierRestockConcentration,
    supplierDelaySignals: [
      { note: 'For delay analytics, compare supplier history dates vs expected lead times in procurement records.' },
    ],
  }
}

export function buildDistributorIntel(
  charts: JabaAiCharts,
  monthlyDistribution: Array<{ month: string; items: number }>
): DistributorIntel {
  const topByVolume = charts.topDistributors.map((d) => ({
    name: d.name,
    totalItems: d.totalItems,
    share: d.share,
  }))
  const decliningOrders: DistributorIntel['decliningOrders'] = []
  if (monthlyDistribution.length >= 2) {
    const a = monthlyDistribution[monthlyDistribution.length - 1]?.items ?? 0
    const b = monthlyDistribution[monthlyDistribution.length - 2]?.items ?? 0
    if (b > 0 && a < b * 0.9) {
      decliningOrders.push({
        name: 'All channels (aggregate)',
        note: `Distribution items this month (~${a}) are below prior month (~${b}). Investigate demand or fulfilment.`,
      })
    }
  }
  const top = charts.topDistributors[0]
  const overdependenceWarning =
    top && top.share >= 0.48
      ? `${top.name} represents ~${Math.round(top.share * 100)}% of recorded distributor volume.`
      : null
  return { topByVolume, decliningOrders, overdependenceWarning }
}

export function buildNeedsAttentionToday(
  kpis: JabaAiKpis,
  lowNames: string[],
  wastageSignals: WastageSignal[],
  dataQuality: { issues: Array<{ id: string; title: string; detail: string; severity: string }> },
  alerts: SmartAlert[]
): NeedsAttentionItem[] {
  const items: NeedsAttentionItem[] = []

  for (const name of lowNames.slice(0, 3)) {
    items.push({
      id: `na-mat-${name}`,
      urgency: 'critical',
      title: `Material below minimum: ${name}`,
      detail: 'Restock or confirm inbound before the next production block.',
      category: 'material',
      sources: ['dashboard', 'material-reports'],
    })
  }

  if (kpis.batchesInQC >= 2) {
    items.push({
      id: 'na-qc',
      urgency: kpis.batchesInQC >= 6 ? 'critical' : 'high',
      title: `${kpis.batchesInQC} batches in QC`,
      detail: 'Prioritise QC completion to unblock packaging and dispatch.',
      category: 'qc',
      sources: ['dashboard', 'batch-reports'],
    })
  }

  for (const w of wastageSignals.filter((x) => x.severity === 'critical').slice(0, 2)) {
    items.push({
      id: `na-${w.id}`,
      urgency: 'critical',
      title: w.title,
      detail: w.detail,
      category: 'wastage',
      sources: w.sources,
    })
  }

  for (const a of alerts.filter((x) => x.severity === 'critical').slice(0, 2)) {
    if (items.some((i) => i.title === a.title)) continue
    items.push({
      id: `na-alert-${a.id}`,
      urgency: 'critical',
      title: a.title,
      detail: a.detail,
      category: 'stock',
      sources: ['rule-engine'],
    })
  }

  for (const dq of dataQuality.issues.filter((i) => i.severity === 'warning').slice(0, 1)) {
    items.push({
      id: `na-dq-${dq.id}`,
      urgency: 'high',
      title: dq.title,
      detail: dq.detail,
      category: 'data',
      sources: ['data-quality'],
    })
  }

  return items.slice(0, 12)
}

export function mergeWastageSignals(apiHeuristics: WastageSignal[], dbSignals: WastageSignal[]): WastageSignal[] {
  const seen = new Set<string>()
  const out: WastageSignal[] = []
  for (const w of [...dbSignals, ...apiHeuristics]) {
    if (seen.has(w.id)) continue
    seen.add(w.id)
    out.push(w)
  }
  return out.slice(0, 20)
}

/** Heuristic wastage from API-only data (stock movements imbalance). */
export function buildApiWastageSignals(
  stockMovements: Array<Record<string, unknown>>,
  charts: JabaAiCharts
): WastageSignal[] {
  const out: WastageSignal[] = []
  let pkg = 0
  let dist = 0
  for (const m of stockMovements) {
    const src = String(m.source || '')
    const q = num(m.quantity)
    if (src === 'packaging') pkg += q
    if (src === 'distribution') dist += q
  }
  if (pkg > 500 && dist > 0 && dist < pkg * 0.15) {
    out.push({
      id: 'w-stock-move-imbalance',
      severity: 'warning',
      title: 'Packaged units vs distribution outs',
      detail:
        'Stock movement history shows many packaging IN events vs fewer distribution OUTs in the loaded window — validate that deliveries are logged consistently.',
      sources: ['stock-movements'],
    })
  }

  const mu = charts.materialUsage.map((x) => num(x.usage))
  if (mu.length >= 4) {
    const base = mu.slice(0, -2).reduce((a, b) => a + b, 0) / (mu.length - 2)
    const tail = mu.slice(-2).reduce((a, b) => a + b, 0) / 2
    if (base > 0 && tail > base * 1.35) {
      out.push({
        id: 'w-material-usage-anomaly',
        severity: 'warning',
        title: 'Material consumption run-rate up vs prior days',
        detail: 'Ingredient usage in the last two days is elevated vs the earlier week slice — check spillage, batch sizes, or recording.',
        sources: ['dashboard', 'materialUsageTrends'],
      })
    }
  }

  return out
}
