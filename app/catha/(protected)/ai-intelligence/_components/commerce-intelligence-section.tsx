'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight, Download, Globe2, Search, ShoppingCart, Sparkles, Timer, Users } from 'lucide-react'
import { AISection } from './ai-shared'

type RangeType = 'today' | '7d' | '30d' | 'custom'

interface AnalyticsPayload {
  success: boolean
  range: string
  dashboard: {
    visitorsToday: number
    visitorsWeek: number
    visitorsMonth: number
    liveVisitorsNow: number
    returningVisitors: number
    bounceRate: number
  }
  pageVisits: Array<{ name: string; visits: number; avgTimeSpentSec: number; exitRate: number }>
  products: {
    mostViewedProducts: Array<{ name: string; count: number }>
    mostAddedToCart: Array<{ name: string; count: number }>
    mostWishlisted: Array<{ name: string; count: number }>
    mostPurchased: Array<{ name: string; count: number }>
    highViewsLowPurchases: Array<{ name: string; count: number; purchaseCount: number }>
  }
  funnel: {
    visitors: number
    productViews: number
    addToCart: number
    checkout: number
    completed: number
    dropOff: {
      visitorsToViews: number
      viewsToCart: number
      cartToCheckout: number
      checkoutToCompleted: number
    }
  }
  search: {
    topSearches: Array<{ query: string; count: number }>
    noResultSearches: Array<{ query: string; count: number }>
  }
  liveActivity: Array<{ id: string; label: string; when: string; city: string; deviceType: string; path: string }>
  geoDevice: {
    countries: Array<{ name: string; count: number }>
    cities: Array<{ name: string; count: number }>
    devices: Array<{ name: string; count: number }>
    browsers: Array<{ name: string; count: number }>
    os: Array<{ name: string; count: number }>
  }
  aiInsights: string[]
}

export function CommerceIntelligenceSection() {
  const [range, setRange] = useState<RangeType>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AnalyticsPayload | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const qs = new URLSearchParams({ range })
        if (range === 'custom') {
          if (customFrom) qs.set('from', customFrom)
          if (customTo) qs.set('to', customTo)
        }
        const res = await fetch(`/api/catha/ai-intelligence/commerce?${qs.toString()}`)
        const json = await res.json()
        if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load commerce analytics')
        if (mounted) setData(json)
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load commerce analytics')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [range, customFrom, customTo])

  const funnelSteps = useMemo(() => {
    if (!data) return []
    return [
      { label: 'Visitors', value: data.funnel.visitors, drop: data.funnel.dropOff.visitorsToViews },
      { label: 'Product Views', value: data.funnel.productViews, drop: data.funnel.dropOff.viewsToCart },
      { label: 'Add To Cart', value: data.funnel.addToCart, drop: data.funnel.dropOff.cartToCheckout },
      { label: 'Checkout', value: data.funnel.checkout, drop: data.funnel.dropOff.checkoutToCompleted },
      { label: 'Completed', value: data.funnel.completed, drop: 0 },
    ]
  }, [data])

  return (
    <AISection id="catha-commerce-intelligence" title="CATHA AI COMMERCE INTELLIGENCE" icon={Sparkles}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(['today', '7d', '30d', 'custom'] as RangeType[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${range === r ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border/50 text-muted-foreground'}`}
              >
                {r === 'today' ? 'Today' : r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'Custom Range'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/catha/ai-intelligence/commerce?range=${range}&format=csv`} className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/30">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </a>
            <a href={`/api/catha/ai-intelligence/commerce?range=${range}&format=xlsx`} className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/30">
              <Download className="h-3.5 w-3.5" /> Export Excel
            </a>
          </div>
        </div>

        {range === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-lg border border-border/40 bg-background px-3 py-2 text-xs" />
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-lg border border-border/40 bg-background px-3 py-2 text-xs" />
          </div>
        )}

        {loading && <AnalyticsSkeleton />}
        {error && !loading && <div className="rounded-lg border border-red-300/40 bg-red-50/60 dark:bg-red-950/20 px-3 py-2 text-xs text-red-600">{error}</div>}

        {data && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <MetricCard label="Visitors Today" value={data.dashboard.visitorsToday} icon={Users} />
              <MetricCard label="Visitors This Week" value={data.dashboard.visitorsWeek} icon={Users} />
              <MetricCard label="Visitors This Month" value={data.dashboard.visitorsMonth} icon={Users} />
              <MetricCard label="Live Visitors Now" value={data.dashboard.liveVisitorsNow} icon={Activity} />
              <MetricCard label="Returning Visitors" value={data.dashboard.returningVisitors} icon={ArrowUpRight} />
              <MetricCard label="Bounce Rate %" value={`${data.dashboard.bounceRate}%`} icon={ArrowDownRight} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Panel title="Page Visit Intelligence" icon={Timer}>
                {data.pageVisits.slice(0, 8).map((item) => (
                  <div key={item.name} className="grid grid-cols-4 gap-2 py-1.5 text-xs border-b border-border/20 last:border-0">
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-muted-foreground">{item.visits} visits</p>
                    <p className="text-muted-foreground">{item.avgTimeSpentSec}s avg</p>
                    <p className="text-muted-foreground">{item.exitRate}% exit</p>
                  </div>
                ))}
              </Panel>
              <Panel title="Product Interest Tracking" icon={ShoppingCart}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <SimpleList title="Most viewed" items={data.products.mostViewedProducts.map((x) => `${x.name} (${x.count})`)} />
                  <SimpleList title="Most added to cart" items={data.products.mostAddedToCart.map((x) => `${x.name} (${x.count})`)} />
                  <SimpleList title="Most wishlisted" items={data.products.mostWishlisted.map((x) => `${x.name} (${x.count})`)} />
                  <SimpleList title="Most purchased" items={data.products.mostPurchased.map((x) => `${x.name} (${x.count})`)} />
                </div>
                {data.products.highViewsLowPurchases.length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 text-xs">
                    <p className="font-semibold text-foreground mb-1">High views, low purchases</p>
                    {data.products.highViewsLowPurchases.slice(0, 3).map((x) => (
                      <p key={x.name} className="text-muted-foreground">{x.name}: {x.count} views / {x.purchaseCount} purchases</p>
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Panel title="Sales Conversion Funnel" icon={ArrowUpRight}>
                <div className="space-y-2">
                  {funnelSteps.map((step, idx) => {
                    const max = Math.max(...funnelSteps.map((x) => x.value), 1)
                    const width = Math.max(8, Math.round((step.value / max) * 100))
                    return (
                      <div key={step.label}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-foreground">{step.label}</span>
                          <span className="text-muted-foreground">{step.value.toLocaleString()} {idx < funnelSteps.length - 1 ? `· ${step.drop}% drop-off` : ''}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                          <div className="h-full bg-primary/80" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Panel>
              <Panel title="Search Intelligence" icon={Search}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <SimpleList title="Top keywords" items={data.search.topSearches.map((x) => `${x.query} (${x.count})`)} />
                  <SimpleList title="No-result searches" items={data.search.noResultSearches.map((x) => `${x.query} (${x.count})`)} />
                </div>
              </Panel>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Panel title="Live Activity Feed" icon={Activity}>
                <div className="max-h-52 overflow-auto space-y-2 pr-1">
                  {data.liveActivity.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border/30 bg-background/60 px-3 py-2 text-xs">
                      <p className="text-foreground font-medium">{item.label}</p>
                      <p className="text-muted-foreground">{new Date(item.when).toLocaleTimeString()} · {item.city} · {item.deviceType}</p>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Geo + Device Analytics" icon={Globe2}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <SimpleList title="Top countries" items={data.geoDevice.countries.map((x) => `${x.name} (${x.count})`)} />
                  <SimpleList title="Top cities" items={data.geoDevice.cities.map((x) => `${x.name} (${x.count})`)} />
                  <SimpleList title="Devices" items={data.geoDevice.devices.map((x) => `${x.name} (${x.count})`)} />
                  <SimpleList title="Browsers / OS" items={[...data.geoDevice.browsers.slice(0, 3).map((x) => `${x.name} (${x.count})`), ...data.geoDevice.os.slice(0, 3).map((x) => `${x.name} (${x.count})`)]} />
                </div>
              </Panel>
            </div>

            <Panel title="AI Insights Engine" icon={Sparkles}>
              <ul className="space-y-1.5">
                {data.aiInsights.map((insight) => (
                  <li key={insight} className="text-xs text-foreground flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        )}
      </div>
    </AISection>
  )
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/80 p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}

function Panel({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function SimpleList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border/30 bg-muted/10 p-2.5">
      <p className="text-[11px] font-semibold text-foreground mb-1.5">{title}</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">No data yet.</p>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 5).map((item) => <p key={item} className="text-muted-foreground">{item}</p>)}
        </div>
      )}
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted/30" />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="h-56 rounded-xl bg-muted/30" />
        <div className="h-56 rounded-xl bg-muted/30" />
      </div>
    </div>
  )
}
