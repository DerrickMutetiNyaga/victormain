/**
 * Fetches normalized AI context by calling existing Jaba HTTP APIs in parallel
 * (same handlers as the dashboard and reports UI). Used by /api/jaba/ai-context
 * and answer generation.
 */
import type { DataQualityIssue, JabaAiCharts, JabaAiContext, JabaAiKpis } from '@/lib/jaba-ai-intelligence-types'
import {
  buildApiWastageSignals,
  buildComparisons,
  buildDigests,
  buildDistributorIntel,
  buildForecasts,
  buildNeedsAttentionToday,
  buildProfitIntelligence,
  buildSupplierIntel,
  enrichRecommendations,
  mergeWastageSignals,
} from '@/lib/jaba-ai-extended'
import { fetchWastageAndDataQualityFromDb } from '@/lib/jaba-ai-wastage-db'
import {
  buildExecutiveAndAlerts,
  buildRecommendations,
} from '@/lib/jaba-ai-rules'

function originFromRequest(request: Request): string {
  const u = new URL(request.url)
  return u.origin
}

async function getJson(
  origin: string,
  cookie: string,
  path: string
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${origin}${path}`, {
      headers: { cookie },
      cache: 'no-store',
    })
    if (!res.ok) {
      return { ok: false, error: `${path} → ${res.status}` }
    }
    return { ok: true, data: await res.json() }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `${path} → ${msg}` }
  }
}

function num(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const n = parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

/** Aggregate bottle dispatch counts from distribution report recent deliveries */
function sumDispatchedBySize(
  recentDeliveries: Array<{ items?: Array<{ size?: string; quantity?: unknown }> }>
): Record<string, number> {
  const out: Record<string, number> = { '250ml': 0, '500ml': 0, '1L': 0, '2L': 0 }
  for (const note of recentDeliveries) {
    const items = note.items
    if (!Array.isArray(items)) continue
    for (const it of items) {
      const sz = String(it.size || '')
      const q = num(it.quantity)
      if (out[sz] !== undefined) out[sz] += q
    }
  }
  return out
}

export async function buildJabaAiContext(request: Request): Promise<JabaAiContext> {
  const origin = originFromRequest(request)
  const cookie = request.headers.get('cookie') ?? ''

  const paths = [
    ['/api/jaba/dashboard', 'dashboard'] as const,
    ['/api/jaba/production-reports?period=week&dateRange=thisMonth', 'production-reports'] as const,
    ['/api/jaba/batch-reports', 'batch-reports'] as const,
    ['/api/jaba/material-reports', 'material-reports'] as const,
    ['/api/jaba/distribution-reports', 'distribution-reports'] as const,
    ['/api/jaba/raw-materials/flow?limit=500', 'raw-materials/flow'] as const,
    ['/api/jaba/raw-materials/usage-logs', 'usage-logs'] as const,
    ['/api/jaba/finished-goods', 'finished-goods'] as const,
    ['/api/jaba/stock-movements', 'stock-movements'] as const,
    ['/api/jaba/delivery-notes', 'delivery-notes'] as const,
    ['/api/jaba/raw-materials', 'raw-materials'] as const,
  ]

  const results = await Promise.all(paths.map(([p]) => getJson(origin, cookie, p)))

  const byKey: Record<string, unknown> = {}
  const sources: string[] = []
  const sourceErrors: string[] = []

  results.forEach((r, i) => {
    const name = paths[i][1]
    if (r.ok) {
      sources.push(name)
      byKey[name] = r.data
    } else {
      sourceErrors.push(r.error)
    }
  })

  const dash = (byKey['dashboard'] ?? {}) as Record<string, unknown>
  const dashStats = (dash['dashboardStats'] ?? {}) as Record<string, unknown>

  const prod = (byKey['production-reports'] ?? {}) as Record<string, unknown>
  const weeklyProdApi = (prod['weeklyProduction'] ?? []) as Array<{
    day?: string
    litres?: number
    batches?: number
  }>

  const batchRep = (byKey['batch-reports'] ?? {}) as Record<string, unknown>
  const flavorDistribution = (batchRep['flavorDistribution'] ?? []) as Array<{
    flavor: string
    batches: number
    litres: number
    bottles?: number
  }>
  const batchWeekly = (batchRep['weeklyProduction'] ?? []) as Array<{
    date?: string
    batches?: number
    litres?: number
  }>
  const recentBatchesBatch = (batchRep['recentBatches'] ?? []) as Array<{
    date?: string
    status?: string
  }>
  const monthlyProductionBr = (batchRep['monthlyProduction'] ?? []) as Array<{
    month: string
    litres: number
  }>

  const mat = (byKey['material-reports'] ?? {}) as Record<string, unknown>
  const topMaterials = (mat['topMaterials'] ?? []) as Array<{
    name: string
    category?: string
    currentStock?: number
    minStock?: number
    cost?: number
    quantityUsed?: number
  }>
  const monthlyUsageMat = (mat['monthlyUsage'] ?? []) as Array<{ month: string; usage: number; cost: number }>

  const distRep = (byKey['distribution-reports'] ?? {}) as Record<string, unknown>
  const monthlyDistributionDist = (distRep['monthlyDistribution'] ?? []) as Array<{
    month: string
    deliveries: number
    items: number
  }>
  const topDistributorsRaw = (distRep['topDistributors'] ?? []) as Array<{
    name: string
    totalItems: number
    delivered: number
    totalDeliveries?: number
  }>
  const weeklyDistApi = (distRep['weeklyDistribution'] ?? []) as Array<{
    date?: string
    deliveries?: number
  }>
  const recentDeliveries = (distRep['recentDeliveries'] ?? []) as Array<{
    items?: Array<{ size?: string; quantity?: unknown }>
  }>

  const flow = (byKey['raw-materials/flow'] ?? {}) as { entries?: unknown[] }
  const flowEntries = Array.isArray(flow.entries) ? flow.entries : []

  const usageLogs = (byKey['usage-logs'] ?? {}) as { logs?: unknown[] }
  const logs = Array.isArray(usageLogs.logs) ? usageLogs.logs : []

  const smRaw = (byKey['stock-movements'] ?? {}) as { movements?: unknown[] }
  const stockMovementsList = Array.isArray(smRaw.movements)
    ? (smRaw.movements as Record<string, unknown>[])
    : []

  const dnRaw = (byKey['delivery-notes'] ?? {}) as { deliveryNotes?: unknown[] }
  const deliveryNotesList = Array.isArray(dnRaw.deliveryNotes) ? dnRaw.deliveryNotes : []

  const rawMat = (byKey['raw-materials'] ?? {}) as { materials?: unknown[] }
  const rawMaterialsList = Array.isArray(rawMat.materials) ? rawMat.materials : []

  const fg = (byKey['finished-goods'] ?? {}) as { batches?: unknown[] }
  const fgBatches = Array.isArray(fg.batches) ? fg.batches : []

  let finishedTotal = 0
  const stockBySize = { '250ml': 0, '500ml': 0, '1L': 0, '2L': 0 }
  for (const row of fgBatches) {
    const b = row as Record<string, unknown>
    for (const sz of ['250ml', '500ml', '1L', '2L'] as const) {
      const block = b[`total${sz}`] as { remaining?: number } | undefined
      const r = block?.remaining
      const n = num(r)
      stockBySize[sz] += n
      finishedTotal += n
    }
  }

  const dispatchedBySize = sumDispatchedBySize(recentDeliveries)
  const topBottleSizes = (['250ml', '500ml', '1L', '2L'] as const).map((size) => ({
    size,
    stockBottles: stockBySize[size],
    dispatchedBottles: dispatchedBySize[size] ?? 0,
  }))

  const lowStockMaterialsCount = num(dashStats['lowStockMaterials'])
  const packagingLow = topMaterials.filter((m) => {
    const c = (m.category || '').toLowerCase()
    return (
      c.includes('pack') ||
      c.includes('bottle') ||
      c.includes('label') ||
      c.includes('cap')
    ) && num(m.currentStock) <= num(m.minStock)
  }).length

  const kpis: JabaAiKpis = {
    totalBatches: num(dashStats['totalBatches']),
    batchesThisMonth: num(dashStats['batchesThisMonth']),
    batchesToday: num(dashStats['batchesToday']),
    litresProducedToday: num(dashStats['litresProducedToday']),
    totalLitresManufactured: num(dashStats['totalLitresManufactured']),
    batchesAwaitingPackaging: num(dashStats['batchesAwaitingPackaging']),
    finishedGoodsStockTotalBottles: Math.round(finishedTotal),
    finishedGoodsBySize: stockBySize,
    lowStockMaterialsCount,
    lowPackagingMaterialsCount: packagingLow,
    pendingDistributions: num(dashStats['pendingDistributions']),
    completedDistributions: num(dashStats['completedDistributions']),
  }

  const dailyProduction = (dash['dailyProductionData'] ?? []) as Array<{
    date?: string
    litres?: number
    batches?: number
  }>
  const materialUsageTrends = (dash['materialUsageTrends'] ?? []) as Array<{
    date?: string
    usage?: number
  }>
  const weeklyDistributionDash = (dash['weeklyDistributionData'] ?? []) as Array<{
    date?: string
    deliveries?: number
    quantity?: number
  }>

  const weeklyProduction: JabaAiCharts['weeklyProduction'] = batchWeekly.length
    ? batchWeekly.map((w) => ({
        label: String(w.date ?? ''),
        litres: num(w.litres),
        batches: num(w.batches),
      }))
    : weeklyProdApi.map((w) => ({
        label: String(w.day ?? ''),
        litres: num(w.litres),
        batches: num(w.batches),
      }))

  const charts: JabaAiCharts = {
    dailyProduction: dailyProduction.map((d) => ({
      date: String(d.date ?? ''),
      litres: num(d.litres),
      batches: num(d.batches),
    })),
    weeklyProduction,
    materialUsage: materialUsageTrends.map((m) => ({
      label: String(m.date ?? ''),
      usage: num(m.usage),
    })),
    weeklyDistribution: weeklyDistributionDash.map((w) => ({
      label: String(w.date ?? ''),
      deliveries: num(w.deliveries),
      quantity: num(w.quantity),
    })),
    topBottleSizes,
    topFlavours: flavorDistribution.slice(0, 8).map((f) => ({
      flavor: f.flavor,
      batches: f.batches,
      litres: num(f.litres),
    })),
    topDistributors: (() => {
      const sumItems = topDistributorsRaw.reduce((s, d) => s + num(d.totalItems), 0) || 1
      return topDistributorsRaw.slice(0, 10).map((d) => ({
        name: d.name,
        totalItems: num(d.totalItems),
        delivered: num(d.delivered),
        share: num(d.totalItems) / sumItems,
      }))
    })(),
  }

  if (!charts.weeklyDistribution.length && weeklyDistApi.length) {
    charts.weeklyDistribution = weeklyDistApi.map((w) => ({
      label: String(w.date ?? ''),
      deliveries: num(w.deliveries),
      quantity: 0,
    }))
  }

  const lowNames = ((dash['lowStockMaterials'] ?? []) as Array<{ name?: string }>)
    .map((m) => String(m.name || ''))
    .filter(Boolean)
    .slice(0, 8)

  const topD = charts.topDistributors[0]
  const distributorConcentrationTop1Pct = topD ? topD.share * 100 : 0

  const { executive, alerts } = buildExecutiveAndAlerts(
    kpis,
    charts,
    { flowEntryCount: flowEntries.length, usageLogCount: logs.length }
  )
  const generatedAt = new Date().toISOString()
  let recommendations = buildRecommendations(kpis, charts, topMaterials, flavorDistribution)
  recommendations = enrichRecommendations(recommendations, generatedAt, sources)

  const profitIntelligence = buildProfitIntelligence(
    kpis,
    charts,
    flavorDistribution,
    fgBatches,
    topMaterials,
    monthlyUsageMat
  )

  const forecasts = buildForecasts(kpis, charts, topMaterials, monthlyUsageMat)

  const comparisons = buildComparisons(charts, monthlyProductionBr, monthlyDistributionDist)

  const digests = buildDigests(kpis, executive, alerts, profitIntelligence)

  const supplierIntel = buildSupplierIntel(flowEntries as Record<string, unknown>[], lowNames)

  const distributorIntel = buildDistributorIntel(charts, monthlyDistributionDist)

  const apiWastage = buildApiWastageSignals(stockMovementsList, charts)
  const dbSignals = await fetchWastageAndDataQualityFromDb()
  const wastageSignals = mergeWastageSignals(apiWastage, dbSignals.wastage)

  const deliveryDq: DataQualityIssue[] = []
  for (const note of deliveryNotesList.slice(0, 120) as Array<Record<string, unknown>>) {
    const items = note.items as unknown[] | undefined
    if (!Array.isArray(items) || items.length === 0) {
      deliveryDq.push({
        id: `dq-dn-${String(note._id || note.id || '')}`,
        severity: 'warning',
        title: 'Delivery note with no line items',
        detail: `Note ${String(note.noteId || '')} may be incomplete or need items.`,
      })
      break
    }
  }

  const dataQualityIssues: DataQualityIssue[] = [...dbSignals.dataQuality, ...deliveryDq]
  for (const rm of rawMaterialsList.slice(0, 400) as Array<Record<string, unknown>>) {
    const name = String(rm.name || '')
    const unitCost = num(rm.costPerUnit ?? rm.unitCost ?? rm.buyingPrice ?? rm.price)
    if (name && unitCost === 0) {
      dataQualityIssues.push({
        id: 'dq-buying-price',
        severity: 'info',
        title: 'Materials missing buying price',
        detail: 'At least one material has no unit cost recorded — refine costs in raw materials for better margin estimates.',
      })
      break
    }
  }

  const needsAttentionToday = buildNeedsAttentionToday(
    kpis,
    lowNames,
    wastageSignals,
    { issues: dataQualityIssues },
    alerts
  )

  const productionVsDispatchNote =
    kpis.batchesToday > 0 && charts.weeklyDistribution.slice(-3).every((w) => w.deliveries === 0)
      ? 'Recent production activity is not yet reflected in outbound deliveries for the last few days.'
      : 'Production and distribution volumes appear aligned at a high level; validate with dispatch schedule.'

  const ctx: JabaAiContext = {
    generatedAt,
    sources,
    sourceErrors,
    kpis,
    charts,
    executive,
    alerts,
    recommendations,
    profitIntelligence,
    wastageSignals,
    forecasts,
    needsAttentionToday,
    dataQuality: { issues: dataQualityIssues },
    digests,
    comparisons,
    supplierIntel,
    distributorIntel,
    chatHints: {
      topLowStockMaterials: lowNames,
      topFlavours: charts.topFlavours.slice(0, 5).map((f) => f.flavor),
      distributorConcentrationTop1Pct,
      productionVsDispatchNote,
    },
  }

  return ctx
}
