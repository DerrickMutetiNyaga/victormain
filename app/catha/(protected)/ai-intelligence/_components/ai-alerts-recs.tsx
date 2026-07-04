'use client'

import { AlertTriangle, Zap, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { AISection, SeverityBadge, ImpactBadge, TypeBadge, ActionLink, EmptyState } from './ai-shared'
import { cn } from '@/lib/utils'

// ── Priority Actions ──
export function AIPriorityActions({ actions }: { actions: any[] }) {
  return (
    <AISection id="priority-actions" title="TODAY'S PRIORITY ACTIONS" icon={Zap}>
      {actions.length === 0 ? (
        <EmptyState message="No urgent actions today. Everything looks good." />
      ) : (
        <div className="space-y-3">
          {actions.map((action: any, i: number) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border/40 bg-muted/10 p-4 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge severity={action.severity} />
                  <h3 className="text-sm font-semibold text-foreground truncate">{action.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground">{action.reason}</p>
              </div>
              <ActionLink href={action.actionLink} label={action.actionLabel} />
            </div>
          ))}
        </div>
      )}
    </AISection>
  )
}

// ── Alerts Section ──
export function AIAlerts({ alerts }: { alerts: any[] }) {
  const [showAll, setShowAll] = useState(false)
  const categories = ['data', 'stock', 'operations', 'supplier'] as const
  const categoryLabels: Record<string, string> = {
    data: 'Missing Data', stock: 'Stock Risks', operations: 'Operations', supplier: 'Supplier & Delivery',
  }
  const categoryIcons: Record<string, string> = {
    data: 'text-violet-500', stock: 'text-orange-500', operations: 'text-slate-500', supplier: 'text-sky-500',
  }

  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = alerts.filter(a => a.category === cat)
    return acc
  }, {} as Record<string, any[]>)

  const displayAlerts = showAll ? alerts : alerts.slice(0, 6)

  return (
    <AISection id="ai-alerts" title="AI ALERTS" icon={AlertTriangle}>
      {alerts.length === 0 ? (
        <EmptyState message="No alerts detected. Systems are running smoothly." />
      ) : (
        <>
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map(cat => (
              grouped[cat].length > 0 && (
                <span key={cat} className={cn('inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-xs font-medium')}>
                  <span className={cn('h-2 w-2 rounded-full', categoryIcons[cat].replace('text-', 'bg-'))} />
                  {categoryLabels[cat]} ({grouped[cat].length})
                </span>
              )
            ))}
          </div>

          <div className="space-y-2.5">
            {displayAlerts.map((alert: any, i: number) => (
              <AlertCard key={alert.id || i} alert={alert} />
            ))}
          </div>

          {alerts.length > 6 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-4 flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {showAll ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showAll ? 'Show fewer' : `Show all ${alerts.length} alerts`}
            </button>
          )}
        </>
      )}
    </AISection>
  )
}

function AlertCard({ alert }: { alert: any }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4 hover:shadow-sm transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <SeverityBadge severity={alert.severity} />
            <h3 className="text-sm font-semibold text-foreground">{alert.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground">{alert.explanation}</p>
          {expanded && (
            <div className="mt-2 rounded-lg bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground"><strong className="text-foreground">Why it matters:</strong> {alert.explanation}</p>
              <p className="text-xs text-muted-foreground mt-1"><strong className="text-foreground">Recommended:</strong> {alert.action}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? 'Less' : 'More'}
          </button>
          <ActionLink href={alert.actionLink} label="Review" />
        </div>
      </div>
    </div>
  )
}

// ── Recommendations Section ──
export function AIRecommendations({ recommendations }: { recommendations: any[] }) {
  const types = ['increase', 'reduce', 'promote', 'fix', 'monitor'] as const
  const typeLabels: Record<string, string> = {
    increase: 'Increase', reduce: 'Reduce', promote: 'Promote', fix: 'Fix', monitor: 'Monitor',
  }

  const grouped = types.reduce((acc, type) => {
    acc[type] = recommendations.filter(r => r.type === type)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <AISection id="ai-recommendations" title="AI RECOMMENDATIONS" icon={Lightbulb}>
      {recommendations.length === 0 ? (
        <EmptyState message="No new recommendations at this time." />
      ) : (
        <div className="space-y-6">
          {types.map(type => (
            grouped[type].length > 0 && (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <TypeBadge type={type} />
                  <h3 className="text-sm font-semibold text-foreground">{typeLabels[type]}</h3>
                  <span className="text-xs text-muted-foreground">({grouped[type].length})</span>
                </div>
                <div className="space-y-2">
                  {grouped[type].map((rec: any, i: number) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border/40 bg-muted/10 p-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-foreground">{rec.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{rec.explanation}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <ImpactBadge impact={rec.impact} />
                        {rec.actionLink && <ActionLink href={rec.actionLink} label="Go" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </AISection>
  )
}
