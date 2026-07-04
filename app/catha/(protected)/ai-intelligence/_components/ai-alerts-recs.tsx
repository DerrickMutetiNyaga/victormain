'use client'

import { AlertTriangle, Zap, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { AISection, SeverityBadge, ImpactBadge, TypeBadge, ActionLink, EmptyState } from './ai-shared'
import { cn } from '@/lib/utils'

const severityAccent: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-400',
  medium: 'border-l-amber-400',
  low: 'border-l-sky-400',
}

// ── Priority Actions ──
export function AIPriorityActions({ actions }: { actions: any[] }) {
  return (
    <AISection
      id="priority-actions"
      title="Today's Priority Actions"
      description="Do these first — ranked by business impact."
      icon={Zap}
    >
      {actions.length === 0 ? (
        <EmptyState message="No urgent actions today. Everything looks good." />
      ) : (
        <div className="space-y-2.5">
          {actions.map((action: any, i: number) => (
            <div
              key={i}
              className={cn(
                'flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border/50 border-l-4 bg-card p-4 hover:shadow-sm transition-shadow',
                severityAccent[action.severity] || 'border-l-border'
              )}
            >
              <span className="hidden sm:flex h-7 w-7 items-center justify-center rounded-full bg-muted/40 text-[13px] font-bold text-foreground/70 shrink-0 tabular-nums">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <SeverityBadge severity={action.severity} />
                  <h3 className="text-[14px] font-semibold text-foreground">{action.title}</h3>
                </div>
                <p className="text-[13px] text-muted-foreground leading-snug">{action.reason}</p>
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
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const categories = ['stock', 'operations', 'supplier', 'data'] as const
  const categoryLabels: Record<string, string> = {
    data: 'Missing Data', stock: 'Stock Risks', operations: 'Operations', supplier: 'Supplier & Delivery',
  }
  const categoryDots: Record<string, string> = {
    data: 'bg-violet-500', stock: 'bg-orange-500', operations: 'bg-slate-500', supplier: 'bg-sky-500',
  }

  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = alerts.filter(a => a.category === cat)
    return acc
  }, {} as Record<string, any[]>)

  const filtered = activeCategory ? alerts.filter(a => a.category === activeCategory) : alerts
  const displayAlerts = showAll ? filtered : filtered.slice(0, 6)

  return (
    <AISection
      id="ai-alerts"
      title="AI Alerts"
      description="Detected risks, sorted by severity. Click a category to filter."
      icon={AlertTriangle}
    >
      {alerts.length === 0 ? (
        <EmptyState message="No alerts detected. Systems are running smoothly." />
      ) : (
        <>
          {/* Category filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                activeCategory === null
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/60 bg-muted/20 text-foreground hover:bg-muted/40'
              )}
            >
              All ({alerts.length})
            </button>
            {categories.map(cat => (
              grouped[cat].length > 0 && (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                    activeCategory === cat
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border/60 bg-muted/20 text-foreground hover:bg-muted/40'
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', activeCategory === cat ? 'bg-primary-foreground' : categoryDots[cat])} />
                  {categoryLabels[cat]} ({grouped[cat].length})
                </button>
              )
            ))}
          </div>

          <div className="space-y-2.5">
            {displayAlerts.map((alert: any, i: number) => (
              <AlertCard key={alert.id || i} alert={alert} />
            ))}
          </div>

          {filtered.length > 6 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[13px] font-medium text-foreground hover:bg-muted/40 transition-colors"
            >
              {showAll ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showAll ? 'Show fewer' : `Show all ${filtered.length} alerts`}
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
    <div className={cn(
      'rounded-xl border border-border/50 border-l-4 bg-card p-4 hover:shadow-sm transition-shadow',
      severityAccent[alert.severity] || 'border-l-border'
    )}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <SeverityBadge severity={alert.severity} />
            <h3 className="text-[14px] font-semibold text-foreground">{alert.title}</h3>
          </div>
          <p className="text-[13px] text-muted-foreground leading-snug">{alert.explanation}</p>
          {expanded && (
            <div className="mt-2.5 rounded-lg bg-muted/20 border border-border/40 p-3 space-y-1">
              <p className="text-[13px] text-muted-foreground"><strong className="text-foreground font-semibold">Why it matters:</strong> {alert.explanation}</p>
              <p className="text-[13px] text-muted-foreground"><strong className="text-foreground font-semibold">Recommended:</strong> {alert.action}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg border border-border/50 px-3 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            {expanded ? 'Less' : 'Details'}
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
    <AISection
      id="ai-recommendations"
      title="AI Recommendations"
      description="Suggested moves to grow revenue, protect margin, and cut waste."
      icon={Lightbulb}
    >
      {recommendations.length === 0 ? (
        <EmptyState message="No new recommendations at this time." />
      ) : (
        <div className="space-y-5">
          {types.map(type => (
            grouped[type].length > 0 && (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2.5">
                  <TypeBadge type={type} />
                  <h3 className="text-[14px] font-semibold text-foreground">{typeLabels[type]}</h3>
                  <span className="text-[12.5px] text-muted-foreground">({grouped[type].length})</span>
                </div>
                <div className="space-y-2">
                  {grouped[type].map((rec: any, i: number) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border/50 bg-card p-4 hover:shadow-sm transition-shadow">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[14px] font-semibold text-foreground">{rec.title}</h4>
                        <p className="text-[13px] text-muted-foreground leading-snug mt-0.5">{rec.explanation}</p>
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
