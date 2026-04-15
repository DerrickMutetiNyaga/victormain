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

  if (ctx.kpis.lowStockMaterialsCount > 0) {
    issues.push(`${ctx.kpis.lowStockMaterialsCount} materials at or below minimum stock`)
    actions.push('Prioritise restock approvals and confirm supplier lead times')
  }
  if (ctx.kpis.batchesAwaitingPackaging >= 4) {
    issues.push(`${ctx.kpis.batchesAwaitingPackaging} batches awaiting packaging — potential bottleneck`)
    actions.push('Review packaging capacity and batch priority')
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
  }

  if (q.includes('raw') && q.includes('risk')) {
    issues.push(...ctx.chatHints.topLowStockMaterials.map((n) => `Low stock: ${n}`))
    actions.push('Cross-check minimum stock levels and upcoming batches that consume these inputs')
  }

  if (q.includes('increase') || q.includes('more')) {
    const f = ctx.chatHints.topFlavours[0]
    if (f) {
      actions.push(`Top flavour by mix: ${f} — align capacity and ingredients`)
    }
  }

  if (q.includes('slow') && q.includes('stock')) {
    actions.push(
      'Review finished goods with high remaining bottles vs dispatch — see bottle size breakdown on this page'
    )
  }

  if (q.includes('distributor') && (q.includes('best') || q.includes('perform'))) {
    const top = ctx.charts.topDistributors[0]
    if (top) {
      issues.push(`Largest volume partner: ${top.name} (${Math.round(top.share * 100)}% of tracked items)`)
    }
  }

  if (q.includes('profit')) {
    issues.push('Profit is not modelled in-system — use costs from material reports and pricing outside Jaba')
    actions.push('Export production and material reports for margin analysis')
  }

  if (issues.length === 0) {
    issues.push('No critical rule-based issues matched this question — data snapshot is stable at a glance')
  }
  if (actions.length === 0) {
    actions.push(ctx.executive.actionToday)
  }

  const summary = `Health ${ctx.executive.healthStatus} (score ${ctx.executive.healthScore}). ${ctx.executive.healthLabel}`

  return {
    summary,
    issuesFound: issues.slice(0, 8),
    recommendedActions: actions.slice(0, 8),
    dataSources: sources,
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
