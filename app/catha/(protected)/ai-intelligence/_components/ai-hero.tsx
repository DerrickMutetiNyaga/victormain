'use client'

import { Brain, RefreshCw, Shield, TrendingUp, Database, Activity, Users, AlertTriangle, Lightbulb, CircleAlert, BarChart3 } from 'lucide-react'
import { ScoreGauge, StatCard } from './ai-shared'
import { cn } from '@/lib/utils'

interface AIHeroProps {
  healthScore: { overall: number; sales: number; inventory: number; dataQuality: number; operations: number; clientRetention: number }
  overview: { totalProducts: number; risksCount: number; profitOpportunities: number; dataIssues: number; stockPressure: string; repeatCustomerCount: number; totalClients: number; todaySales: number; weekSales: number; todayOrders: number }
  lastUpdated: string
  onRefresh: () => void
  loading: boolean
}

export function AIHero({ healthScore, overview, lastUpdated, onRefresh, loading }: AIHeroProps) {
  const updatedAt = new Date(lastUpdated)
  const timeStr = updatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent" />
        <div className="absolute top-4 right-4 opacity-[0.03]">
          <Brain className="h-48 w-48 text-white" />
        </div>
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 ring-1 ring-indigo-400/30">
                  <Brain className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">AI INTELLIGENCE</h1>
                  <p className="text-sm text-slate-400">Intelligent business monitoring, risk detection, and growth recommendations.</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-4 flex items-center gap-2">
                <Shield className="h-3 w-3" />
                AI insights are advisory and based on current operational data. Super admin access only.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3 shrink-0">
              <button
                onClick={onRefresh}
                disabled={loading}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl bg-indigo-500/20 px-4 py-2.5 text-sm font-medium text-indigo-300 ring-1 ring-indigo-400/30 hover:bg-indigo-500/30 transition-all',
                  loading && 'opacity-60 cursor-not-allowed'
                )}
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                Refresh Analysis
              </button>
              <span className="text-[11px] text-slate-500">Last updated: {timeStr}</span>
            </div>
          </div>

          {/* Health Score Row */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 md:gap-6">
            <ScoreGauge score={healthScore.overall} label="Overall Health" size="lg" />
            <ScoreGauge score={healthScore.sales} label="Sales" size="sm" />
            <ScoreGauge score={healthScore.inventory} label="Inventory" size="sm" />
            <ScoreGauge score={healthScore.dataQuality} label="Data Quality" size="sm" />
            <ScoreGauge score={healthScore.operations} label="Operations" size="sm" />
            <ScoreGauge score={healthScore.clientRetention} label="Retention" size="sm" />
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <OverviewCard
          icon={CircleAlert}
          iconColor="text-red-500"
          iconBg="bg-red-100 dark:bg-red-950"
          title="Risks Detected"
          value={overview.risksCount}
          subtitle="Critical & high severity"
        />
        <OverviewCard
          icon={Lightbulb}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-100 dark:bg-emerald-950"
          title="Profit Opportunities"
          value={overview.profitOpportunities}
          subtitle="Revenue & margin"
        />
        <OverviewCard
          icon={Database}
          iconColor="text-violet-500"
          iconBg="bg-violet-100 dark:bg-violet-950"
          title="Data Issues"
          value={overview.dataIssues}
          subtitle="Missing or incomplete"
        />
        <OverviewCard
          icon={AlertTriangle}
          iconColor={overview.stockPressure === 'high' ? 'text-red-500' : overview.stockPressure === 'medium' ? 'text-amber-500' : 'text-emerald-500'}
          iconBg={overview.stockPressure === 'high' ? 'bg-red-100 dark:bg-red-950' : overview.stockPressure === 'medium' ? 'bg-amber-100 dark:bg-amber-950' : 'bg-emerald-100 dark:bg-emerald-950'}
          title="Stock Pressure"
          value={overview.stockPressure.charAt(0).toUpperCase() + overview.stockPressure.slice(1)}
          subtitle="Restock urgency"
        />
        <OverviewCard
          icon={Users}
          iconColor="text-sky-500"
          iconBg="bg-sky-100 dark:bg-sky-950"
          title="Repeat Customers"
          value={overview.repeatCustomerCount}
          subtitle={`of ${overview.totalClients} total`}
        />
        <OverviewCard
          icon={BarChart3}
          iconColor="text-indigo-500"
          iconBg="bg-indigo-100 dark:bg-indigo-950"
          title="Today's Revenue"
          value={`KES ${overview.todaySales.toLocaleString()}`}
          subtitle={`${overview.todayOrders} orders`}
        />
      </div>
    </div>
  )
}

function OverviewCard({ icon: Icon, iconColor, iconBg, title, value, subtitle }: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string; iconBg: string
  title: string; value: string | number; subtitle: string
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg mb-3', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      <p className="mt-0.5 text-xl font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  )
}
