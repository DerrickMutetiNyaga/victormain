/**
 * Structured answers for Ask AI — rule-based now; plug in LLM later.
 */
import type { AiAnswerPayload, JabaAiContext } from '@/lib/jaba-ai-intelligence-types'

const LLM_PROVIDER = process.env.JABA_AI_PROVIDER?.trim() // e.g. 'openai' when wired

export function buildRuleBasedAnswer(question: string, ctx: JabaAiContext): AiAnswerPayload {
  const q = question.toLowerCase()
  const sources = [...ctx.sources, 'rule-engine']

  const issues: string[] = []
  const actions: string[] = []
  const followUps: string[] = []
  const quickActions: AiAnswerPayload['quickActions'] = []

  const pushQuickAction = (id: string, label: string, path: string, reason: string) => {
    if (!quickActions?.some((a) => a.id === id)) {
      quickActions?.push({ id, label, path, reason })
    }
  }

  if (ctx.kpis.lowStockMaterialsCount > 0) {
    issues.push(`${ctx.kpis.lowStockMaterialsCount} materials at or below minimum stock`)
    actions.push('Prioritise restock approvals and confirm supplier lead times')
    pushQuickAction(
      'restock-materials',
      'Open Raw Materials',
      '/jaba/raw-materials',
      'Review low stock levels and schedule replenishment'
    )
  }
  if (ctx.kpis.batchesAwaitingPackaging >= 4) {
    issues.push(`${ctx.kpis.batchesAwaitingPackaging} batches awaiting packaging — potential bottleneck`)
    actions.push('Review packaging capacity and batch priority')
    pushQuickAction(
      'packaging-output',
      'Open Packaging Output',
      '/jaba/packaging-output',
      'Clear packaging bottlenecks and validate line throughput'
    )
  }
  if (ctx.chatHints.distributorConcentrationTop1Pct >= 45) {
    issues.push(
      `Distributor concentration ~${Math.round(ctx.chatHints.distributorConcentrationTop1Pct)}% on top partner`
    )
    actions.push('Diversify channel mix and territory coverage where possible')
  }

  if (q.includes('throughput') || q.includes('drop') || q.includes('production')) {
    const last = ctx.charts.dailyProduction.slice(-7)
    const litres = last.map((d) => d.litres)
    const mx = Math.max(...litres, 1)
    const mn = Math.min(...litres)
    issues.push(
      `Last 7d daily litres range ~${Math.round(mn)}–${Math.round(mx)} (from dashboard production series)`
    )
    actions.push('Compare with planned runs, raw material availability, and downtime logs')
    followUps.push('Which shift or day had the largest throughput drop?')
    pushQuickAction(
      'production-report',
      'Open Production Reports',
      '/jaba/reports?tab=production',
      'Validate throughput trend and locate drop windows'
    )
  }

  if (q.includes('raw') && q.includes('risk')) {
    issues.push(...ctx.chatHints.topLowStockMaterials.map((n) => `Low stock: ${n}`))
    actions.push('Cross-check minimum stock levels and upcoming batches that consume these inputs')
    followUps.push('Which materials could halt production in the next 7 days?')
  }

  if (q.includes('increase') || q.includes('more')) {
    const f = ctx.chatHints.topFlavours[0]
    if (f) {
      actions.push(`Top flavour by mix: ${f} — align capacity and ingredients`)
    }
    followUps.push('Should we increase this flavour across all bottle sizes or only selected SKUs?')
  }

  if (q.includes('slow') && q.includes('stock')) {
    actions.push(
      'Review finished goods with high remaining bottles vs dispatch — see bottle size breakdown on this page'
    )
    pushQuickAction(
      'finished-goods',
      'Open Jaba Reports',
      '/jaba/reports',
      'Inspect slow-moving finished stock by size and flavour'
    )
  }

  if (q.includes('distributor') && (q.includes('best') || q.includes('perform'))) {
    const top = ctx.charts.topDistributors[0]
    if (top) {
      issues.push(`Largest volume partner: ${top.name} (${Math.round(top.share * 100)}% of tracked items)`)
    }
    followUps.push('Which distributors are declining and need follow-up this week?')
    pushQuickAction(
      'distribution-reports',
      'Open Distribution Reports',
      '/jaba/reports/distribution',
      'Review distributor volume, collection and outstanding balances'
    )
  }

  if (
    q.includes('payment') ||
    q.includes('collection') ||
    q.includes('outstanding') ||
    q.includes('paid')
  ) {
    issues.push(ctx.chatHints.paymentSummaryNote)
    if (ctx.chatHints.paymentStatusMix) {
      issues.push(`Payment mix: ${ctx.chatHints.paymentStatusMix}`)
    }
    if (ctx.chatHints.paymentAgingNotes) {
      issues.push(`Aging buckets: ${ctx.chatHints.paymentAgingNotes}`)
    }
    actions.push('Prioritize high-aging outstanding notes and convert partials to full settlement')
    actions.push('Use payment notes/reasons to segment delays by operational cause')
    followUps.push('Which outstanding bucket has the highest risk this period?')
    followUps.push('Show me distributors with weakest collection rate')
    pushQuickAction(
      'payment-report',
      'Open Distribution Reports',
      '/jaba/reports/distribution',
      'Deep-dive into collection rate, outstanding aging and payment status mix'
    )
    pushQuickAction(
      'distribution-main',
      'Open Distribution Management',
      '/jaba/distribution',
      'Record or follow up pending and partial payments'
    )
  }

  if (q.includes('wastage') || q.includes('variance') || q.includes('loss')) {
    actions.push('Review stock movement exceptions and raw material usage logs for abnormal variance')
    followUps.push('Which batches or materials are repeatedly linked to variance?')
    pushQuickAction(
      'stock-movements',
      'Open Stock Movements',
      '/jaba/storage/movement',
      'Inspect variance events and document root causes'
    )
  }

  if (q.includes('profit')) {
    issues.push('Profit is not modelled in-system — use costs from material reports and pricing outside Jaba')
    actions.push('Export production and material reports for margin analysis')
    pushQuickAction(
      'material-reports',
      'Open Material Reports',
      '/jaba/reports?tab=materials',
      'Review cost trends and usage for margin analysis'
    )
  }

  if (issues.length === 0) {
    issues.push('No critical rule-based issues matched this question — data snapshot is stable at a glance')
  }
  if (actions.length === 0) {
    actions.push(ctx.executive.actionToday)
  }
  if (followUps.length === 0) {
    followUps.push('What is the single highest-impact action to execute today?')
  }

  const summary = `Health ${ctx.executive.healthStatus} (score ${ctx.executive.healthScore}). ${ctx.executive.healthLabel}`
  const confidence: AiAnswerPayload['confidence'] =
    issues.length >= 3 && actions.length >= 3 ? 'high' : issues.length >= 2 ? 'medium' : 'low'

  return {
    summary,
    issuesFound: issues.slice(0, 8),
    recommendedActions: actions.slice(0, 8),
    dataSources: sources,
    confidence,
    followUpQuestions: followUps.slice(0, 5),
    quickActions: quickActions?.slice(0, 5),
  }
}

/** When JABA_AI_PROVIDER is set and API key present, call your provider here (server-only). */
export async function maybeGenerateLlmAnswer(
  question: string,
  ctx: JabaAiContext,
  ruleFallback: AiAnswerPayload
): Promise<AiAnswerPayload> {
  if (!LLM_PROVIDER) return ruleFallback
  // Scaffold: return rules until OPENAI_API_KEY / provider is wired
  return ruleFallback
}
