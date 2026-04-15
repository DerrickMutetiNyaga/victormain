/**
 * Rule-based operational intelligence for Jaba (no LLM required).
 */
import type {
  AiRecommendation,
  ExecutiveSummary,
  HealthStatus,
  JabaAiCharts,
  JabaAiKpis,
  SmartAlert,
} from '@/lib/jaba-ai-intelligence-types'

function avg(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function buildExecutiveAndAlerts(
  kpis: JabaAiKpis,
  charts: JabaAiCharts,
  extras: { flowEntryCount: number; usageLogCount: number }
): { executive: ExecutiveSummary; alerts: SmartAlert[] } {
  const alerts: SmartAlert[] = []

  // --- Risk: low raw materials
  if (kpis.lowStockMaterialsCount > 0) {
    alerts.push({
      id: 'low-raw-materials',
      severity: kpis.lowStockMaterialsCount > 3 ? 'critical' : 'warning',
      title: 'Low raw materials',
      detail: `${kpis.lowStockMaterialsCount} material(s) at or below minimum stock. Review restock and supplier lead times.`,
      metric: String(kpis.lowStockMaterialsCount),
    })
  }

  // --- Low packaging materials (derived category heuristic)
  if (kpis.lowPackagingMaterialsCount > 0) {
    alerts.push({
      id: 'low-packaging',
      severity: 'warning',
      title: 'Low packaging / consumables',
      detail: `${kpis.lowPackagingMaterialsCount} packaging-related material(s) may need reorder to avoid line stoppages.`,
      metric: String(kpis.lowPackagingMaterialsCount),
    })
  }

  // --- Slow-moving finished goods (high on-hand vs low completed deliveries)
  const totalStock = kpis.finishedGoodsStockTotalBottles
  if (totalStock > 600 && kpis.completedDistributions < 15) {
    alerts.push({
      id: 'slow-movement',
      severity: 'warning',
      title: 'Slow-moving finished stock',
      detail:
        'Finished goods inventory is elevated while historical completed distributions are comparatively low. Validate sales pull-through and dispatch cadence.',
      metric: `${Math.round(totalStock)} bottles`,
    })
  }

  // --- High production vs weak dispatch (last 7d shape)
  const recentDist = charts.weeklyDistribution.slice(-4)
  const distQty = recentDist.reduce((s, w) => s + w.quantity, 0)
  const recentLitres = charts.dailyProduction.slice(-3).reduce((s, d) => s + d.litres, 0)
  if (recentLitres > 0 && distQty === 0 && kpis.pendingDistributions === 0) {
    alerts.push({
      id: 'prod-dispatch-gap',
      severity: 'info',
      title: 'Production vs dispatch',
      detail:
        'Production output is present but recorded distribution quantities are low for the recent window. Check dispatch logging and delivery notes.',
    })
  }

  // --- Packaging backlog (legacy “QC Pending” status in DB)
  if (kpis.batchesAwaitingPackaging >= 5) {
    alerts.push({
      id: 'packaging-backlog',
      severity: 'warning',
      title: 'Packaging backlog',
      detail: `${kpis.batchesAwaitingPackaging} batches awaiting packaging. Consider staffing or prioritization for packaging lines.`,
      metric: String(kpis.batchesAwaitingPackaging),
    })
  }

  // --- Material usage spike
  const mu = charts.materialUsage.map((m) => m.usage)
  if (mu.length >= 5) {
    const last2 = mu.slice(-2)
    const baseline = avg(mu.slice(0, -2))
    const spike = last2.reduce((a, b) => a + b, 0) / 2
    if (baseline > 0 && spike > baseline * 1.45) {
      alerts.push({
        id: 'material-usage-spike',
        severity: 'warning',
        title: 'Unusually high material usage',
        detail:
          'Ingredient usage in recent batches is elevated vs the prior week. Verify batch yields, spillage, or recipe adherence.',
        metric: `${Math.round(spike)} vs ${Math.round(baseline)} avg`,
      })
    }
  }

  // --- Bottle size imbalance
  const sizes = charts.topBottleSizes
  const stockSum = sizes.reduce((s, x) => s + x.stockBottles, 0) || 1
  const dispSum = sizes.reduce((s, x) => s + x.dispatchedBottles, 0) || 1
  for (const row of sizes) {
    const stockShare = row.stockBottles / stockSum
    const moveShare = row.dispatchedBottles / dispSum
    if (row.stockBottles > 200 && stockShare > 0.45 && moveShare < 0.2 && dispSum > 30) {
      alerts.push({
        id: `bottle-imbalance-${row.size}`,
        severity: 'info',
        title: 'Stock imbalance by bottle size',
        detail: `${row.size} represents a large share of finished stock but a smaller share of recent dispatch volume. Rebalance production or push campaigns to the right SKU mix.`,
      })
      break
    }
  }

  // --- Distributor concentration
  const top = charts.topDistributors[0]
  if (top && top.share >= 0.5 && charts.topDistributors.length >= 2) {
    alerts.push({
      id: 'distributor-concentration',
      severity: 'warning',
      title: 'Distributor demand concentration',
      detail: `${top.name} represents ~${Math.round(top.share * 100)}% of recorded distributor volume. Diversify routes to reduce dependency risk.`,
      metric: top.name,
    })
  }

  // --- Slow-moving SKU (finished goods proxy)
  for (const row of sizes) {
    if (row.stockBottles > 100 && row.dispatchedBottles < row.stockBottles * 0.05) {
      alerts.push({
        id: `slow-sku-${row.size}`,
        severity: 'info',
        title: 'Slow-moving bottle size',
        detail: `${row.size} shows high remaining stock vs dispatch volume. Consider promotions or redistribution.`,
      })
      break
    }
  }

  // --- Flow / usage visibility
  if (extras.flowEntryCount === 0 && extras.usageLogCount === 0) {
    alerts.push({
      id: 'data-visibility',
      severity: 'info',
      title: 'Limited material movement logs',
      detail: 'Flow or usage logs returned empty. Intelligence improves as inventory movements are recorded.',
    })
  }

  // --- Executive scoring (simple heuristic)
  let score = 78
  if (kpis.lowStockMaterialsCount > 0) score -= 12
  if (kpis.batchesAwaitingPackaging > 8) score -= 8
  if (top && top.share >= 0.55) score -= 7
  const mu2 = charts.materialUsage.map((m) => m.usage)
  if (mu2.length >= 5) {
    const baseline = avg(mu2.slice(0, -2))
    const spike = avg(mu2.slice(-2))
    if (baseline > 0 && spike > baseline * 1.45) score -= 6
  }
  score = Math.max(35, Math.min(96, Math.round(score)))

  let healthStatus: HealthStatus = 'stable'
  if (score >= 85) healthStatus = 'strong'
  else if (score >= 68) healthStatus = 'stable'
  else if (score >= 50) healthStatus = 'attention'
  else healthStatus = 'critical'

  const healthLabel =
    healthStatus === 'strong'
      ? 'Operations are in a healthy range with manageable risks.'
      : healthStatus === 'stable'
        ? 'Operations are stable with a few areas to monitor.'
        : healthStatus === 'attention'
          ? 'Several signals need attention this week.'
          : 'Critical operational risks detected — prioritize mitigation.'

  const biggestRisk =
    kpis.lowStockMaterialsCount > 0
      ? `Material availability: ${kpis.lowStockMaterialsCount} items at or below minimum stock.`
      : kpis.batchesAwaitingPackaging >= 5
        ? `Packaging backlog: ${kpis.batchesAwaitingPackaging} batches waiting before packaging.`
        : top && top.share >= 0.45
          ? `Channel risk: high volume concentration with ${top.name}.`
          : 'Maintain visibility on dispatch and packaging as volumes grow.'

  const topFlavor = charts.topFlavours[0]
  const biggestOpportunity = topFlavor
    ? `Scale ${topFlavor.flavor} — strongest mix of batches and litres in recent production.`
    : 'Capture demand on your fastest-moving flavours and bottle sizes.'

  const actionToday =
    kpis.lowStockMaterialsCount > 0
      ? 'Approve restocks for low raw materials and confirm supplier ETAs.'
      : kpis.pendingDistributions > 0
        ? 'Clear pending distributions: confirm vehicles, drivers, and delivery windows.'
        : 'Review packaging schedule for today’s batches.'

  const actionThisWeek =
    kpis.lowPackagingMaterialsCount > 0 || kpis.lowStockMaterialsCount > 3
      ? 'Run a weekly procurement review for raw and packaging materials.'
      : top && top.share >= 0.45
        ? 'Diversify distributor outreach and rebalance territory allocation.'
        : 'Align production plan with distributor demand and stock movement.'

  const executive: ExecutiveSummary = {
    healthStatus,
    healthLabel,
    healthScore: score,
    biggestRisk,
    biggestOpportunity,
    actionToday,
    actionThisWeek,
  }

  return { executive, alerts }
}

export function buildRecommendations(
  kpis: JabaAiKpis,
  charts: JabaAiCharts,
  topMaterials: Array<{ name: string; category?: string; currentStock?: number; minStock?: number }>,
  flavorDistribution: Array<{ flavor: string; batches: number; litres: number }>
): AiRecommendation[] {
  const recs: AiRecommendation[] = []

  const lows = topMaterials.filter((m) => num(m.currentStock) <= num(m.minStock))
  for (const m of lows.slice(0, 3)) {
    recs.push({
      id: `restock-${m.name}`,
      category: 'restock',
      title: `Restock now: ${m.name}`,
      detail: `Current stock is at or below minimum. Schedule purchase or transfer before the next production block.`,
      priority: 'high',
    })
  }

  const hot = flavorDistribution[0]
  if (hot && hot.flavor && hot.flavor !== 'Unknown') {
    recs.push({
      id: 'produce-more',
      category: 'produce_more',
      title: `Produce more: ${hot.flavor}`,
      detail: 'This flavour leads batch and volume mix — align capacity and raw materials to demand.',
      priority: 'medium',
    })
  }

  const cold = flavorDistribution
    .filter((f) => f.batches > 0)
    .sort((a, b) => a.litres - b.litres)[0]
  if (cold && hot && cold.flavor !== hot.flavor) {
    recs.push({
      id: 'reduce-prod',
      category: 'reduce_production',
      title: `Reduce production of: ${cold.flavor}`,
      detail: 'Lowest litres in the flavour mix — trim runs unless there is a strategic stock build.',
      priority: 'low',
    })
  }

  if (kpis.batchesAwaitingPackaging >= 4) {
    recs.push({
      id: 'watch-packaging-queue',
      category: 'watch',
      title: 'Watch closely: packaging queue',
      detail: 'Multiple batches awaiting packaging — track throughput and line readiness.',
      priority: 'high',
    })
  }

  const supp = lows.find((m) => (m.category || '').toLowerCase().includes('raw'))
  if (supp) {
    recs.push({
      id: 'supplier-followup',
      category: 'supplier',
      title: 'Follow up with supplier',
      detail: `Low stock on ${supp.name} — confirm lead times and order confirmations.`,
      priority: 'medium',
    })
  }

  if (kpis.pendingDistributions > 0) {
    recs.push({
      id: 'push-dist',
      category: 'distribution',
      title: 'Push to distributors',
      detail: `${kpis.pendingDistributions} pending distribution(s) — align dispatch and in-transit updates.`,
      priority: 'medium',
    })
  }

  const imbalanced = charts.topBottleSizes.find((r) => {
    const tot = charts.topBottleSizes.reduce((s, x) => s + x.stockBottles, 0) || 1
    return r.stockBottles / tot > 0.4 && r.dispatchedBottles < r.stockBottles * 0.1
  })
  if (imbalanced) {
    recs.push({
      id: 'packaging-opt',
      category: 'packaging',
      title: 'Packaging optimisation',
      detail: `Rebalance ${imbalanced.size} fills vs demand to reduce warehouse congestion.`,
      priority: 'low',
    })
  }

  // Dedupe by id
  const seen = new Set<string>()
  return recs.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
}

function num(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const n = parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}
