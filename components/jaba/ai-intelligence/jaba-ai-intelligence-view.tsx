'use client'

import { useCallback, useState, type ComponentType, type ReactNode } from 'react'
import type { JabaAiContext } from '@/lib/jaba-ai-intelligence-types'
import { useJabaAiActionState } from '@/hooks/use-jaba-ai-action-state'
import { JabaAiBusinessCommander } from '@/components/jaba/ai-intelligence/jaba-ai-commander'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
  CalendarClock,
  GitCompare,
  Users,
} from 'lucide-react'

const CHART_COLORS = {
  primary: '#0d9488',
  amber: '#d97706',
  rose: '#e11d48',
  slate: '#64748b',
  violet: '#7c3aed',
}

function HealthPill({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone: 'emerald' | 'amber' | 'slate'
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 backdrop-blur-sm transition-all hover:shadow-md',
        tone === 'emerald' && 'border-emerald-200/80 bg-emerald-50/90 dark:border-emerald-800/50 dark:bg-emerald-950/30',
        tone === 'amber' && 'border-amber-200/80 bg-amber-50/90 dark:border-amber-800/50 dark:bg-amber-950/30',
        tone === 'slate' && 'border-slate-200/80 bg-white/80 dark:border-slate-700 dark:bg-slate-900/40'
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string
  value: string | number
  sub?: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <Card className="group border-slate-200/80 bg-white/90 shadow-sm transition-all hover:border-emerald-300/60 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</CardTitle>
        <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 transition-transform group-hover:scale-105 dark:bg-emerald-950/50 dark:text-emerald-400">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</div>
        {sub && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function AlertCard({
  title,
  detail,
  severity,
}: {
  title: string
  detail: string
  severity: 'info' | 'warning' | 'critical'
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-all hover:shadow-md',
        severity === 'critical' && 'border-rose-200 bg-rose-50/80 dark:border-rose-900/50 dark:bg-rose-950/20',
        severity === 'warning' && 'border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20',
        severity === 'info' && 'border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/40'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            severity === 'critical' && 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
            severity === 'warning' && 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
            severity === 'info' && 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
          )}
        >
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{detail}</p>
        </div>
      </div>
    </div>
  )
}

function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/50', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

const SUGGESTED_QUESTIONS = [
  'Why did throughput drop this week?',
  'What raw materials are at risk?',
  'Which products should I increase?',
  'Which stock is slow-moving?',
  'Which distributor performs best?',
  'What is hurting profit most right now?',
]

export function JabaAiIntelligenceView({
  data,
  loading,
  error,
  onRefresh,
}: {
  data: JabaAiContext | null
  loading: boolean
  error: string | null
  onRefresh: () => void
}) {
  const [question, setQuestion] = useState('')
  const [askLoading, setAskLoading] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)
  const [askResult, setAskResult] = useState<{
    summary: string
    issuesFound: string[]
    recommendedActions: string[]
    dataSources: string[]
  } | null>(null)

  const actionState = useJabaAiActionState()

  const ask = useCallback(async () => {
    const q = question.trim()
    if (!q) return
    setAskLoading(true)
    setAskError(null)
    try {
      const res = await fetch('/api/jaba/ai-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Request failed')
      setAskResult(json.answer)
    } catch (e: unknown) {
      setAskError(e instanceof Error ? e.message : 'Failed to get answer')
    } finally {
      setAskLoading(false)
    }
  }, [question])

  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`

  if (loading && !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-600/10">
          <Brain className="h-8 w-8 text-emerald-700 dark:text-emerald-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Analyzing plant operations...</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">This may take a moment.</p>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-600" />
        <p className="text-sm text-slate-700 dark:text-slate-200">{error}</p>
        <Button onClick={onRefresh} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    )
  }

  if (!data) return null

  const ex = data.executive
  const healthTone =
    ex.healthStatus === 'strong' || ex.healthStatus === 'stable'
      ? 'emerald'
      : ex.healthStatus === 'attention'
        ? 'amber'
        : 'slate'

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 px-4 py-6 pb-16 md:px-6">
      {/* Header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Shield className="mr-1 h-3 w-3" />
              Super admin
            </Badge>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Updated {new Date(data.generatedAt).toLocaleString()}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">AI Intelligence</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Unified view of plant operations, inventory, production, packaging, and distribution — with early warning signals
            and practical next steps from your live Jaba data.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="shrink-0 gap-2 self-start rounded-xl border-slate-200 dark:border-slate-700"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh data
        </Button>
      </div>

      {data.sourceErrors.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <span className="font-semibold">Partial data: </span>
          Some sources failed to load. Charts may be incomplete. ({data.sourceErrors.slice(0, 3).join(' · ')}
          {data.sourceErrors.length > 3 ? '…' : ''})
        </div>
      )}

      {/* Needs attention today */}
      <Card className="border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-white dark:border-rose-900/40 dark:from-rose-950/30 dark:to-slate-900/80">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-rose-900 dark:text-rose-100">
            <AlertTriangle className="h-5 w-5" />
            Needs attention today
          </CardTitle>
          <CardDescription>Only the most urgent operational exceptions — start here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.needsAttentionToday.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">Nothing critical flagged for immediate action.</p>
          ) : (
            data.needsAttentionToday.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'flex flex-col gap-1 rounded-xl border p-3 sm:flex-row sm:items-start sm:justify-between',
                  n.urgency === 'critical'
                    ? 'border-rose-300 bg-white/80 dark:border-rose-900/50 dark:bg-rose-950/20'
                    : 'border-amber-200 bg-white/80 dark:border-amber-900/40 dark:bg-amber-950/20'
                )}
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{n.title}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{n.detail}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Sources: {n.sources.join(', ')}</p>
                </div>
                <Badge variant={n.urgency === 'critical' ? 'destructive' : 'secondary'} className="w-fit shrink-0">
                  {n.urgency}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Daily / weekly digest */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <CalendarClock className="h-5 w-5 text-emerald-600" />
          Operational digests
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-900/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Today</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 dark:text-slate-300">{data.digests.todaySummary}</CardContent>
          </Card>
          <Card className="border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-900/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">This week (ops)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 dark:text-slate-300">{data.digests.weeklyOperational}</CardContent>
          </Card>
          <Card className="border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-900/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Weekly risk</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 dark:text-slate-300">{data.digests.weeklyRisk}</CardContent>
          </Card>
          <Card className="border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-900/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Weekly opportunity</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 dark:text-slate-300">{data.digests.weeklyOpportunity}</CardContent>
          </Card>
        </div>
      </div>

      {/* Comparison mode */}
      <Card className="border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitCompare className="h-5 w-5 text-slate-700 dark:text-slate-200" />
            Comparisons
          </CardTitle>
          <CardDescription>Today vs yesterday, week vs week, month vs month (from live Jaba aggregates).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {data.comparisons.todayVsYesterday && (
            <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
              <p className="font-semibold text-slate-900 dark:text-white">Today vs yesterday</p>
              <p className="mt-2 text-slate-600 dark:text-slate-300">
                Litres: {data.comparisons.todayVsYesterday.litres.yesterday} → {data.comparisons.todayVsYesterday.litres.today}
                {data.comparisons.todayVsYesterday.litres.deltaPct != null && (
                  <span className="text-emerald-700 dark:text-emerald-400"> ({data.comparisons.todayVsYesterday.litres.deltaPct}%)</span>
                )}
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Batches: {data.comparisons.todayVsYesterday.batches.yesterday} → {data.comparisons.todayVsYesterday.batches.today}
                {data.comparisons.todayVsYesterday.batches.deltaPct != null && (
                  <span className="text-emerald-700 dark:text-emerald-400"> ({data.comparisons.todayVsYesterday.batches.deltaPct}%)</span>
                )}
              </p>
            </div>
          )}
          {data.comparisons.thisWeekVsLastWeek && (
            <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
              <p className="font-semibold text-slate-900 dark:text-white">Rolling windows (production)</p>
              <p className="mt-2 text-slate-600 dark:text-slate-300">
                Litres: {data.comparisons.thisWeekVsLastWeek.litres.lastWeek} → {data.comparisons.thisWeekVsLastWeek.litres.thisWeek}
                {data.comparisons.thisWeekVsLastWeek.litres.deltaPct != null && (
                  <span> ({data.comparisons.thisWeekVsLastWeek.litres.deltaPct}%)</span>
                )}
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Dispatch qty: {data.comparisons.thisWeekVsLastWeek.deliveries.lastWeek} →{' '}
                {data.comparisons.thisWeekVsLastWeek.deliveries.thisWeek}
                {data.comparisons.thisWeekVsLastWeek.deliveries.deltaPct != null && (
                  <span> ({data.comparisons.thisWeekVsLastWeek.deliveries.deltaPct}%)</span>
                )}
              </p>
            </div>
          )}
          {data.comparisons.thisMonthVsLastMonth && (
            <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
              <p className="font-semibold text-slate-900 dark:text-white">This month vs last</p>
              <p className="mt-2 text-slate-600 dark:text-slate-300">
                Production L: {data.comparisons.thisMonthVsLastMonth.productionLitres.lastMonth} →{' '}
                {data.comparisons.thisMonthVsLastMonth.productionLitres.thisMonth}
                {data.comparisons.thisMonthVsLastMonth.productionLitres.deltaPct != null && (
                  <span> ({data.comparisons.thisMonthVsLastMonth.productionLitres.deltaPct}%)</span>
                )}
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Dist. items: {data.comparisons.thisMonthVsLastMonth.distributionItems.lastMonth} →{' '}
                {data.comparisons.thisMonthVsLastMonth.distributionItems.thisMonth}
                {data.comparisons.thisMonthVsLastMonth.distributionItems.deltaPct != null && (
                  <span> ({data.comparisons.thisMonthVsLastMonth.distributionItems.deltaPct}%)</span>
                )}
              </p>
            </div>
          )}
          {data.charts.topFlavours.length >= 2 && (
            <div className="rounded-xl border border-slate-200 p-3 text-sm md:col-span-3 dark:border-slate-700">
              <p className="font-semibold text-slate-900 dark:text-white">Flavour vs flavour (top two by mix)</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {data.charts.topFlavours.slice(0, 2).map((f) => (
                  <div key={f.flavor} className="rounded-lg bg-slate-50/80 p-3 dark:bg-slate-800/50">
                    <p className="font-medium text-slate-900 dark:text-white">{f.flavor}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {f.batches} batches · {Math.round(f.litres)} L
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.charts.topBottleSizes.length >= 2 && (
            <div className="rounded-xl border border-slate-200 p-3 text-sm md:col-span-3 dark:border-slate-700">
              <p className="font-semibold text-slate-900 dark:text-white">Bottle size comparison (stock vs dispatch)</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {data.charts.topBottleSizes.map((b) => (
                  <div key={b.size} className="rounded-lg bg-slate-50/80 p-2 text-xs dark:bg-slate-800/50">
                    <p className="font-medium">{b.size}</p>
                    <p>Stock {Math.round(b.stockBottles)}</p>
                    <p>Dispatch {Math.round(b.dispatchedBottles)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Partner intelligence */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              Distributor intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {data.distributorIntel.overdependenceWarning && (
              <p className="rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                {data.distributorIntel.overdependenceWarning}
              </p>
            )}
            {data.distributorIntel.decliningOrders.map((d) => (
              <p key={d.name} className="text-slate-700 dark:text-slate-200">
                <strong>{d.name}</strong> — {d.note}
              </p>
            ))}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-slate-500">Top by volume</p>
              {data.distributorIntel.topByVolume.slice(0, 6).map((d) => (
                <div key={d.name} className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>{d.name}</span>
                  <span className="tabular-nums">
                    {d.totalItems} · {Math.round(d.share * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-base">Supplier intelligence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            {data.supplierIntel.supplierRestockConcentration.slice(0, 5).map((s) => (
              <p key={s.supplierName}>
                <strong>{s.supplierName}</strong> · ~{s.sharePct}% of inbound flow lines — {s.note}
              </p>
            ))}
            {data.supplierIntel.supplierDelaySignals.map((s, i) => (
              <p key={i} className="text-xs text-slate-500">
                {s.note}
              </p>
            ))}
            {data.supplierIntel.suppliersLinkedToStockRisk.slice(0, 4).map((s, i) => (
              <p key={i}>
                {s.material}: {s.note}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      <JabaAiBusinessCommander
        data={data}
        items={actionState.items}
        onUpdate={actionState.updateItem}
        endOfTodayIso={actionState.endOfTodayIso}
      />

      {/* Health strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HealthPill label="Health score" value={ex.healthScore} tone={healthTone === 'emerald' ? 'emerald' : 'amber'} />
        <HealthPill label="Batches today" value={data.kpis.batchesToday} tone="slate" />
        <HealthPill label="Litres today" value={fmt(data.kpis.litresProducedToday)} tone="slate" />
        <HealthPill label="QC queue" value={data.kpis.batchesInQC} tone={data.kpis.batchesInQC > 6 ? 'amber' : 'emerald'} />
      </div>

      {/* Executive summary */}
      <Card className="overflow-hidden border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white shadow-xl dark:border-slate-800">
        <CardHeader className="space-y-1 pb-2">
          <div className="flex items-center gap-2 text-emerald-300/90">
            <Zap className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">Executive summary</span>
          </div>
          <CardTitle className="text-xl font-semibold leading-snug text-white md:text-2xl">
            Status: <span className="text-emerald-300">{ex.healthStatus.replace('-', ' ')}</span>
          </CardTitle>
          <CardDescription className="text-slate-300">{ex.healthLabel}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/80">Biggest risk</p>
            <p className="text-sm leading-relaxed text-slate-100">{ex.biggestRisk}</p>
          </div>
          <div className="space-y-3 rounded-xl bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/80">Biggest opportunity</p>
            <p className="text-sm leading-relaxed text-slate-100">{ex.biggestOpportunity}</p>
          </div>
          <div className="space-y-3 rounded-xl bg-emerald-500/10 p-4 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90">Recommended actions</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-[11px] font-medium text-emerald-300/80">Today</p>
                <p className="mt-1 text-sm text-white">{ex.actionToday}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-emerald-300/80">This week</p>
                <p className="mt-1 text-sm text-white">{ex.actionThisWeek}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Activity className="h-5 w-5 text-emerald-600" />
          Key performance indicators
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard title="Total batches" value={fmt(data.kpis.totalBatches)} icon={TrendingUp} />
          <KpiCard title="Batches this month" value={fmt(data.kpis.batchesThisMonth)} icon={TrendingUp} />
          <KpiCard title="Batches today" value={fmt(data.kpis.batchesToday)} icon={TrendingUp} />
          <KpiCard title="Litres produced today" value={fmt(data.kpis.litresProducedToday)} icon={Zap} />
          <KpiCard title="Total litres manufactured" value={fmt(data.kpis.totalLitresManufactured)} icon={Zap} />
          <KpiCard title="Batches in QC" value={fmt(data.kpis.batchesInQC)} icon={Shield} />
          <KpiCard title="Finished goods (bottles)" value={fmt(data.kpis.finishedGoodsStockTotalBottles)} icon={CheckCircle2} />
          <KpiCard title="Low stock materials" value={fmt(data.kpis.lowStockMaterialsCount)} sub="Raw & tracked inputs" icon={AlertTriangle} />
          <KpiCard title="Pending distributions" value={fmt(data.kpis.pendingDistributions)} icon={ArrowRight} />
          <KpiCard title="Completed distributions" value={fmt(data.kpis.completedDistributions)} icon={CheckCircle2} />
        </div>
      </div>

      {/* Smart alerts */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Smart alerts</h2>
        {data.alerts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            No rule-based alerts right now — operational signals look calm.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.alerts.map((a) => (
              <AlertCard key={a.id} title={a.title} detail={a.detail} severity={a.severity} />
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        Actionable recommendations with explainability and tracking live in <strong>AI Business Commander → Actions</strong>.
      </p>

      {/* Charts */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Analytics</h2>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard title="Daily production trend" description="Litres and batch count (last 7 days)">
            <div className="h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.charts.dailyProduction}>
                  <defs>
                    <linearGradient id="litresGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-slate-500" />
                  <YAxis tick={{ fontSize: 11 }} className="text-slate-500" />
                  <Tooltip
                    contentStyle={{ borderRadius: 12 }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="litres" name="Litres" stroke={CHART_COLORS.primary} fill="url(#litresGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Weekly production" description="Rolling windows from batch reports">
            <div className="h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.weeklyProduction}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Bar dataKey="litres" name="Litres" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Material usage trend" description="Ingredient quantities from batches (7-day window)">
            <div className="h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.charts.materialUsage}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Line type="monotone" dataKey="usage" name="Usage" stroke={CHART_COLORS.violet} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="QC activity (recent batches)" description="Pass / fail / pending by day for batches in view">
            <div className="h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.charts.qcTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Legend />
                  <Line type="monotone" dataKey="pass" name="Pass" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="fail" name="Fail" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pending" name="Pending" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Weekly distribution trend" description="Deliveries and quantities">
            <div className="h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.weeklyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Bar yAxisId="left" dataKey="deliveries" name="Deliveries" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="quantity" name="Qty" fill={CHART_COLORS.slate} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Top moving bottle sizes" description="On-hand vs recent dispatch mix">
            <div className="h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.topBottleSizes} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="size" width={56} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Legend />
                  <Bar dataKey="stockBottles" name="Stock" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="dispatchedBottles" name="Dispatched (sample)" fill={CHART_COLORS.violet} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Top flavours" description="By batch activity">
            <div className="h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.topFlavours}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis dataKey="flavor" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Bar dataKey="litres" name="Litres" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Top distributors by volume" description="Share of recorded delivery items" className="xl:col-span-2">
            <div className="h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.topDistributors.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Bar dataKey="totalItems" name="Items" radius={[6, 6, 0, 0]}>
                    {data.charts.topDistributors.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#ccfbf1', '#64748b', '#94a3b8'][i % 8]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Ask AI */}
      <Card className="border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 shadow-lg dark:border-slate-800 dark:from-slate-900 dark:to-slate-950/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Brain className="h-6 w-6 text-emerald-600" />
            Ask AI
          </CardTitle>
          <CardDescription>
            Questions are answered with structured insights from the same Jaba datasets powering this page. Plug in an LLM
            later via server env without changing the UI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setQuestion(q)
                  setAskResult(null)
                }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition-all hover:border-emerald-300 hover:bg-emerald-50/80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40"
              >
                {q}
              </button>
            ))}
          </div>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about throughput, materials, QC, distributors…"
            className="min-h-[100px] resize-y rounded-xl border-slate-200 dark:border-slate-700"
          />
          <Button onClick={ask} disabled={askLoading || !question.trim()} className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700">
            {askLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Analyze
          </Button>

          {askError && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{askError}</p>
          )}

          {askResult && (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-800 dark:text-slate-100">{askResult.summary}</p>
              </div>
              {askResult.issuesFound.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issues found</p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700 dark:text-slate-200">
                    {askResult.issuesFound.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {askResult.recommendedActions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended actions</p>
                  <ul className="mt-2 list-inside list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-200">
                    {askResult.recommendedActions.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 pt-2">
                <span className="text-[11px] font-medium text-slate-400">Sources:</span>
                {askResult.dataSources.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[10px] font-normal">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
