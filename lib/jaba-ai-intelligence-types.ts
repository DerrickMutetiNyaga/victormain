/**
 * Shared types for Jaba AI Intelligence (context API + UI).
 * Payloads are normalized subsets of existing Jaba API responses plus derived intelligence.
 */

export type HealthStatus = 'strong' | 'stable' | 'attention' | 'critical'

export type JabaAiKpis = {
  totalBatches: number
  batchesThisMonth: number
  batchesToday: number
  litresProducedToday: number
  totalLitresManufactured: number
  batchesAwaitingPackaging: number
  finishedGoodsStockTotalBottles: number
  finishedGoodsBySize: Record<'250ml' | '500ml' | '1L' | '2L', number>
  lowStockMaterialsCount: number
  lowPackagingMaterialsCount: number
  pendingDistributions: number
  completedDistributions: number
}

export type JabaAiCharts = {
  dailyProduction: { date: string; litres: number; batches: number }[]
  weeklyProduction: { label: string; litres: number; batches: number }[]
  materialUsage: { label: string; usage: number }[]
  weeklyDistribution: { label: string; deliveries: number; quantity: number }[]
  topBottleSizes: { size: string; stockBottles: number; dispatchedBottles: number }[]
  topFlavours: { flavor: string; batches: number; litres: number }[]
  topDistributors: { name: string; totalItems: number; delivered: number; share: number }[]
}

export type SmartAlert = {
  id: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
  metric?: string
}

export type AiRecommendation = {
  id: string
  category:
    | 'restock'
    | 'produce_more'
    | 'reduce_production'
    | 'watch'
    | 'supplier'
    | 'distribution'
    | 'packaging'
  title: string
  detail: string
  priority: 'high' | 'medium' | 'low'
  /** Explainability */
  why?: string
  sources?: string[]
  confidence?: 'high' | 'medium' | 'low'
  dataFreshness?: string
}

export type ExecutiveSummary = {
  healthStatus: HealthStatus
  healthLabel: string
  healthScore: number
  biggestRisk: string
  biggestOpportunity: string
  actionToday: string
  actionThisWeek: string
}

/** Money intelligence — estimates from material costs, volume, dispatch (not full accounting). */
export type ProfitIntelligence = {
  bestEstimatedMarginFlavours: Array<{
    flavor: string
    score: number
    note: string
  }>
  notWorthPushing: Array<{ flavor: string; reason: string }>
  highVolumeLowValueStock: Array<{ label: string; bottles: number; note: string }>
  expensiveIdleStock: Array<{ label: string; estRelativeValue: number; note: string }>
  risingCostMaterials: Array<{ name: string; pctChangeVsPrior: number | null; note: string }>
}

export type WastageSignal = {
  id: string
  severity: 'warning' | 'critical'
  title: string
  detail: string
  sources: string[]
}

export type ForecastItem = {
  id: string
  label: string
  prediction: string
  horizonDays: number
  confidence: 'low' | 'medium'
}

export type NeedsAttentionItem = {
  id: string
  urgency: 'critical' | 'high'
  title: string
  detail: string
  category: 'material' | 'packaging' | 'distribution' | 'stock' | 'data' | 'wastage' | 'supplier'

  sources: string[]
}

export type DataQualityIssue = {
  id: string
  severity: 'warning' | 'info'
  title: string
  detail: string
}

export type DigestBundle = {
  todaySummary: string
  weeklyOperational: string
  weeklyRisk: string
  weeklyOpportunity: string
}

export type ComparisonBlock = {
  todayVsYesterday: {
    litres: { yesterday: number; today: number; deltaPct: number | null }
    batches: { yesterday: number; today: number; deltaPct: number | null }
  } | null
  thisWeekVsLastWeek: {
    litres: { lastWeek: number; thisWeek: number; deltaPct: number | null }
    deliveries: { lastWeek: number; thisWeek: number; deltaPct: number | null }
  } | null
  thisMonthVsLastMonth: {
    productionLitres: { lastMonth: number; thisMonth: number; deltaPct: number | null }
    distributionItems: { lastMonth: number; thisMonth: number; deltaPct: number | null }
  } | null
}

export type SupplierIntel = {
  suppliersLinkedToStockRisk: Array<{ supplierName: string; material: string; note: string }>
  supplierRestockConcentration: Array<{ supplierName: string; sharePct: number; note: string }>
  supplierDelaySignals: Array<{ note: string }>
}

export type DistributorIntel = {
  topByVolume: Array<{ name: string; totalItems: number; share: number }>
  decliningOrders: Array<{ name: string; note: string }>
  overdependenceWarning: string | null
}

export type JabaAiContext = {
  generatedAt: string
  sources: string[]
  sourceErrors: string[]
  kpis: JabaAiKpis
  charts: JabaAiCharts
  executive: ExecutiveSummary
  alerts: SmartAlert[]
  recommendations: AiRecommendation[]
  profitIntelligence: ProfitIntelligence
  wastageSignals: WastageSignal[]
  forecasts: ForecastItem[]
  needsAttentionToday: NeedsAttentionItem[]
  dataQuality: { issues: DataQualityIssue[] }
  digests: DigestBundle
  comparisons: ComparisonBlock
  supplierIntel: SupplierIntel
  distributorIntel: DistributorIntel
  /** Compact strings for optional LLM / chat (no PII) */
  chatHints: {
    topLowStockMaterials: string[]
    topFlavours: string[]
    distributorConcentrationTop1Pct: number
    productionVsDispatchNote: string
  }
}

export type AiAnswerPayload = {
  summary: string
  issuesFound: string[]
  recommendedActions: string[]
  dataSources: string[]
}

/** Client-side comparison drill-down (labels only; metrics from context). */
export type ComparisonSelection =
  | 'today_yesterday'
  | 'week_week'
  | 'month_month'
  | 'flavour_ab'
  | 'size_ab'
  | 'distributor_ab'

export type ActionItemState = {
  status: 'open' | 'reviewed' | 'handled' | 'snoozed'
  snoozeUntil?: string | null
  note?: string
  updatedAt: string
}

export type AiActionStatePayload = {
  items: Record<string, ActionItemState>
}
