'use client'

import { useState } from 'react'
import {
  Brain, Send, Sparkles, ExternalLink, Package, ShoppingCart, BarChart3,
  Users, Truck, Wallet2, Settings, ArrowLeftRight, Receipt, Clock,
} from 'lucide-react'
import { AISection } from './ai-shared'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const SUGGESTED_PROMPTS = [
  { text: 'What should I restock today?', key: 'restock' },
  { text: 'Which products make the most money?', key: 'top-revenue' },
  { text: 'Which items are missing buying price?', key: 'missing-cost' },
  { text: 'What are my busiest hours?', key: 'peak-hours' },
  { text: 'Which products should I reduce ordering for?', key: 'reduce-order' },
  { text: 'Which customers are slowing down?', key: 'inactive-clients' },
  { text: 'What should I promote this weekend?', key: 'promote' },
  { text: 'Are there unusual order patterns?', key: 'anomalies' },
  { text: 'What is hurting profit visibility?', key: 'profit-gaps' },
  { text: 'Which products sell but are not profitable enough?', key: 'low-margin' },
]

interface AskAIPanelProps {
  intelligenceData: any
}

export function AskAIPanel({ intelligenceData }: AskAIPanelProps) {
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState<{ title: string; points: string[]; source?: string } | null>(null)

  function handleAsk(q: string) {
    setQuery(q)
    const result = generateAnswer(q, intelligenceData)
    setAnswer(result)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) handleAsk(query.trim())
  }

  return (
    <AISection id="ask-ai" title="ASK AI" icon={Brain}>
      <div className="space-y-4">
        {/* Suggested Prompts */}
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map(p => (
            <button
              key={p.key}
              onClick={() => handleAsk(p.text)}
              className="rounded-full border border-border/50 bg-muted/20 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all"
            >
              <Sparkles className="inline h-3 w-3 mr-1 text-primary/60" />
              {p.text}
            </button>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ask a business question..."
            className="flex-1 rounded-xl border border-border/50 bg-muted/10 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
          />
          <button
            type="submit"
            disabled={!query.trim()}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <Send className="h-4 w-4" /> Ask
          </button>
        </form>

        {/* Answer */}
        {answer && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{answer.title}</h3>
            </div>
            <ul className="space-y-1.5">
              {answer.points.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            {answer.source && (
              <p className="text-[11px] text-muted-foreground border-t border-border/30 pt-2">
                Source: {answer.source}
              </p>
            )}
          </div>
        )}
      </div>
    </AISection>
  )
}

function generateAnswer(query: string, data: any): { title: string; points: string[]; source?: string } {
  const q = query.toLowerCase()

  if (q.includes('restock') || q.includes('stock today') || q.includes('low stock')) {
    const items = data?.inventoryIntelligence?.restockNow || []
    if (items.length === 0) return { title: 'Restocking', points: ['No urgent restocking needed right now based on current demand and stock levels.'], source: 'Inventory + Order data (30 days)' }
    return {
      title: `${items.length} Products Need Restocking`,
      points: items.slice(0, 5).map((p: any) => `${p.name}: ${p.stock} in stock, ${p.recentDemand} sold in last 7 days (min stock: ${p.minStock})`),
      source: 'Inventory + Order data (7 days)',
    }
  }

  if (q.includes('most money') || q.includes('top revenue') || q.includes('best selling')) {
    const items = data?.profitIntelligence?.topRevenue || []
    if (items.length === 0) return { title: 'Top Revenue', points: ['No sales data available yet.'], source: 'Orders (30 days)' }
    return {
      title: 'Top Revenue Products (30 Days)',
      points: items.slice(0, 5).map((p: any) => `${p.name}: KES ${p.revenue.toLocaleString()} from ${p.qty} units${p.margin !== null ? ` (${p.margin}% margin)` : ' (margin unknown — add buying price)'}`),
      source: 'Orders + Inventory data',
    }
  }

  if (q.includes('missing') && (q.includes('buying') || q.includes('cost'))) {
    const count = data?.profitIntelligence?.missingCostCount || 0
    return {
      title: 'Missing Buying Price',
      points: count > 0
        ? [`${count} products do not have a buying price set.`, 'This means profit margins cannot be calculated for these items.', 'Go to Inventory to add buying prices for accurate profit analysis.']
        : ['All products have buying prices set. Profit tracking is complete.'],
      source: 'Inventory data',
    }
  }

  if (q.includes('busiest') || q.includes('peak hour') || q.includes('busy')) {
    const peaks = data?.peakHoursIntelligence?.peakHours || []
    const days = data?.peakHoursIntelligence?.peakDays || []
    const points: string[] = []
    if (peaks.length > 0) points.push(`Busiest hour: ${peaks[0].hour} with ${peaks[0].orders} orders (KES ${peaks[0].revenue.toLocaleString()})`)
    if (peaks.length > 1) points.push(`Other busy times: ${peaks.slice(1, 3).map((p: any) => p.hour).join(', ')}`)
    if (days.length > 0) points.push(`Busiest day: ${days[0].day} (${days[0].orders} orders, KES ${days[0].revenue.toLocaleString()})`)
    points.push('Prepare stock and staff ahead of peak times to maximize sales.')
    return { title: 'Peak Hours Analysis', points: points.length > 1 ? points : ['Not enough order data to determine peak hours yet.'], source: 'Orders (30 days)' }
  }

  if (q.includes('reduce') && q.includes('order')) {
    const dead = data?.inventoryIntelligence?.deadStock || []
    const over = data?.inventoryIntelligence?.overstock || []
    const points: string[] = []
    if (dead.length > 0) points.push(`${dead.length} products had zero sales in 30 days: ${dead.slice(0, 3).map((p: any) => p.name).join(', ')}${dead.length > 3 ? '...' : ''}`)
    if (over.length > 0) points.push(`${over.length} products appear overstocked relative to demand.`)
    if (points.length === 0) points.push('No clear candidates for reduced ordering at this time.')
    else points.push('Consider reducing reorder quantities for these items to free up capital.')
    return { title: 'Products to Reduce Ordering', points, source: 'Inventory + Sales (30 days)' }
  }

  if (q.includes('customer') && (q.includes('slow') || q.includes('inactive') || q.includes('churn'))) {
    const inactive = data?.clientIntelligence?.inactiveClients || []
    if (inactive.length === 0) return { title: 'Customer Retention', points: ['No significant customer churn detected. Repeat customers remain active.'], source: 'Client data' }
    return {
      title: `${inactive.length} Repeat Customers Becoming Inactive`,
      points: inactive.slice(0, 4).map((c: any) => `${c.name}: ${c.visits} visits, KES ${c.spend.toLocaleString()} spent — last order was over 30 days ago`),
      source: 'Order history (60 days)',
    }
  }

  if (q.includes('promot')) {
    const highMargin = data?.profitIntelligence?.highMargin || []
    const fast = data?.inventoryIntelligence?.fastMovers || []
    const points: string[] = []
    if (highMargin.length > 0) points.push(`High-margin products to push: ${highMargin.slice(0, 3).map((p: any) => `${p.name} (${p.margin}%)`).join(', ')}`)
    if (fast.length > 0) points.push(`Already popular (promote more): ${fast.slice(0, 3).map((p: any) => p.name).join(', ')}`)
    if (points.length === 0) points.push('Add buying prices to products to identify the best candidates for promotion.')
    else points.push('Focus promotions on high-margin items that also have strong demand.')
    return { title: 'Promotion Recommendations', points, source: 'Inventory + Sales data' }
  }

  if (q.includes('unusual') || q.includes('anomal') || q.includes('suspicious')) {
    const cancel = data?.operationsIntelligence?.cancelRate || 0
    const edits = data?.operationsIntelligence?.editRate || 0
    const adj = data?.operationsIntelligence?.manualAdjustments || 0
    const points: string[] = []
    if (cancel > 5) points.push(`Order cancellation rate is ${cancel}% (above 5% threshold).`)
    if (edits > 15) points.push(`Order edit rate is ${edits}% which may need review.`)
    if (adj > 10) points.push(`${adj} manual stock adjustments in 30 days — check for inconsistencies.`)
    if (points.length === 0) points.push('No unusual patterns detected. Operations appear normal.')
    return { title: 'Operational Anomaly Check', points, source: 'Orders + Stock movements (30 days)' }
  }

  if (q.includes('profit') && (q.includes('hurt') || q.includes('visibility') || q.includes('gap'))) {
    const missing = data?.profitIntelligence?.missingCostCount || 0
    const total = missing + (data?.profitIntelligence?.totalWithCostData || 0)
    return {
      title: 'Profit Visibility Gaps',
      points: [
        `${missing} of ${total} products have no buying price, making profit calculations incomplete.`,
        missing > 0 ? 'Adding cost data for these products would immediately improve margin analysis accuracy.' : 'All products have cost data. Profit visibility is complete.',
        `${data?.profitIntelligence?.lowMarginHighSales?.length || 0} products sell well but have margins under 30% — review pricing.`,
      ],
      source: 'Inventory data',
    }
  }

  if (q.includes('low margin') || (q.includes('not profitable') && q.includes('enough'))) {
    const items = data?.profitIntelligence?.lowMarginHighSales || []
    if (items.length === 0) return { title: 'Low Margin Products', points: ['No products with both low margins and high sales detected, or cost data is missing.'], source: 'Inventory + Sales' }
    return {
      title: `${items.length} Products Selling Well but Low Margin`,
      points: items.slice(0, 5).map((p: any) => `${p.name}: ${p.margin}% margin (cost KES ${p.cost}, sell KES ${p.price}, ${p.monthlySales} sold/month)`),
      source: 'Inventory + Sales (30 days)',
    }
  }

  return {
    title: 'AI Analysis',
    points: [
      'I can help with: restocking, top revenue, missing prices, peak hours, slow customers, promotions, anomalies, profit gaps, and more.',
      'Try asking a specific question like "What should I restock today?" or "Which products make the most money?"',
    ],
    source: 'Operational data',
  }
}

// ── Quick Actions Panel ──
export function AIQuickActions() {
  const actions = [
    { label: 'Open Inventory', href: '/catha/inventory', icon: Package },
    { label: 'Open Orders', href: '/catha/orders', icon: Receipt },
    { label: 'Open Reports', href: '/catha/reports', icon: BarChart3 },
    { label: 'Open Clients', href: '/catha/clients', icon: Users },
    { label: 'Open Suppliers', href: '/catha/suppliers', icon: Truck },
    { label: 'Open Expenses', href: '/catha/expenses', icon: Wallet2 },
    { label: 'Stock Movements', href: '/catha/stock-movement', icon: ArrowLeftRight },
    { label: 'POS Sales', href: '/catha/pos', icon: ShoppingCart },
    { label: 'Settings', href: '/catha/settings', icon: Settings },
  ]

  return (
    <AISection id="quick-actions" title="QUICK ACTIONS" icon={ExternalLink}>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {actions.map(action => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/10 px-3 py-3 text-sm font-medium text-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all"
          >
            <action.icon className="h-4 w-4 text-muted-foreground" />
            {action.label}
          </Link>
        ))}
      </div>
    </AISection>
  )
}
