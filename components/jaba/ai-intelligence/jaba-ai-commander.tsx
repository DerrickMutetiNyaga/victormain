'use client'

import type { JabaAiContext } from '@/lib/jaba-ai-intelligence-types'
import type { ActionItemState } from '@/lib/jaba-ai-intelligence-types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Briefcase, Boxes, LineChart, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  data: JabaAiContext
  items: Record<string, ActionItemState>
  onUpdate: (id: string, patch: Partial<ActionItemState>) => void
  endOfTodayIso: () => string
}

function isHidden(item?: ActionItemState) {
  if (!item) return false
  if (item.status === 'handled' || item.status === 'reviewed') return true
  if (item.status === 'snoozed' && item.snoozeUntil) {
    return new Date(item.snoozeUntil) > new Date()
  }
  return false
}

export function JabaAiBusinessCommander({ data, items, onUpdate, endOfTodayIso }: Props) {
  const actionKey = (prefix: string, id: string) => `${prefix}:${id}`

  return (
    <Card className="border-slate-200/80 bg-white/95 shadow-lg dark:border-slate-800 dark:bg-slate-900/50">
      <CardHeader>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl">AI Business Commander</CardTitle>
            <CardDescription>Risks, opportunities, stock, and tracked actions in one place.</CardDescription>
          </div>
          <Badge variant="outline" className="w-fit text-xs">
            Data refresh: {new Date(data.generatedAt).toLocaleString()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="risks" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-xl bg-slate-100/90 p-1 dark:bg-slate-800/80 lg:grid-cols-4">
            <TabsTrigger value="risks" className="gap-2 rounded-lg py-2.5 text-xs sm:text-sm">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              Risks
            </TabsTrigger>
            <TabsTrigger value="opportunities" className="gap-2 rounded-lg py-2.5 text-xs sm:text-sm">
              <LineChart className="h-4 w-4 shrink-0" />
              Opportunities
            </TabsTrigger>
            <TabsTrigger value="stock" className="gap-2 rounded-lg py-2.5 text-xs sm:text-sm">
              <Boxes className="h-4 w-4 shrink-0" />
              Stock
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-2 rounded-lg py-2.5 text-xs sm:text-sm">
              <Briefcase className="h-4 w-4 shrink-0" />
              Actions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="risks" className="mt-6 space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Wastage & mismatch signals</h4>
              {data.wastageSignals.length === 0 ? (
                <p className="text-sm text-slate-500">No cross-check warnings in this window.</p>
              ) : (
                data.wastageSignals.map((w) => (
                  <div
                    key={w.id}
                    className={cn(
                      'rounded-xl border p-4 text-sm',
                      w.severity === 'critical'
                        ? 'border-rose-200 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-950/20'
                        : 'border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20'
                    )}
                  >
                    <p className="font-semibold text-slate-900 dark:text-white">{w.title}</p>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{w.detail}</p>
                    <p className="mt-2 text-[11px] text-slate-500">Sources: {w.sources.join(', ')}</p>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Data quality</h4>
              {data.dataQuality.issues.slice(0, 8).map((d) => (
                <div key={d.id} className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/40">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{d.title}</p>
                    <p className="text-slate-600 dark:text-slate-400">{d.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="opportunities" className="mt-6 space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-semibold">Estimated margin leaders (directional)</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.profitIntelligence.bestEstimatedMarginFlavours.slice(0, 6).map((f) => (
                  <div key={f.flavor} className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <p className="font-semibold text-emerald-900 dark:text-emerald-200">{f.flavor}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{f.note}</p>
                    <Badge variant="secondary" className="mt-2 text-[10px]">
                      score {f.score}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold">Weekly opportunity (digest)</h4>
              <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                {data.digests.weeklyOpportunity}
              </p>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold">Forecasts</h4>
              <ul className="space-y-2">
                {data.forecasts.slice(0, 6).map((f) => (
                  <li key={f.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                    <span className="font-medium text-slate-900 dark:text-white">{f.label}: </span>
                    {f.prediction}{' '}
                    <span className="text-xs text-slate-500">(~{f.horizonDays}d horizon, {f.confidence} confidence)</span>
                  </li>
                ))}
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="stock" className="mt-6 space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-semibold">High volume, weaker pull-through</h4>
              {data.profitIntelligence.highVolumeLowValueStock.length === 0 ? (
                <p className="text-sm text-slate-500">No standout SKUs in this rule.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.profitIntelligence.highVolumeLowValueStock.map((r) => (
                    <li key={r.label} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <strong>{r.label}</strong> — {r.bottles} bottles · {r.note}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold">Expensive idle stock (relative score)</h4>
              <ul className="space-y-2 text-sm">
                {data.profitIntelligence.expensiveIdleStock.map((r) => (
                  <li key={r.label} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    {r.label} — score {r.estRelativeValue}. {r.note}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold">Not worth over-pushing (finished goods vs dispatch)</h4>
              {data.profitIntelligence.notWorthPushing.map((r) => (
                <p key={r.flavor} className="mb-2 rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                  <strong>{r.flavor}</strong> — {r.reason}
                </p>
              ))}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold">Rising input cost signals</h4>
              {data.profitIntelligence.risingCostMaterials.map((r) => (
                <p key={r.name} className="mb-2 text-sm text-slate-700 dark:text-slate-200">
                  {r.name}
                  {r.pctChangeVsPrior != null ? ` · ~${r.pctChangeVsPrior}% vs prior` : ''} — {r.note}
                </p>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="actions" className="mt-6 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Track recommendations so the board does not repeat noise. States sync to your account (server-side).
            </p>
            {data.recommendations.every((r) => isHidden(items[actionKey('rec', r.id)])) && (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No open actions — everything is reviewed, handled, or snoozed for today.
              </p>
            )}
            {data.recommendations.map((r) => {
              const id = actionKey('rec', r.id)
              const st = items[id]
              if (isHidden(st)) return null
              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{r.title}</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{r.detail}</p>
                      {r.why && (
                        <p className="mt-2 text-xs text-slate-500">
                          <span className="font-medium text-slate-600 dark:text-slate-400">Why: </span>
                          {r.why}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(r.sources ?? []).map((s) => (
                          <Badge key={s} variant="outline" className="text-[10px] font-normal">
                            {s}
                          </Badge>
                        ))}
                        {r.confidence && (
                          <Badge variant="secondary" className="text-[10px]">
                            confidence: {r.confidence}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => onUpdate(id, { status: 'reviewed' })}>
                        Reviewed
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onUpdate(id, { status: 'handled' })}>
                        Handled
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onUpdate(id, { status: 'snoozed', snoozeUntil: endOfTodayIso() })}
                      >
                        Snooze today
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    className="mt-3 min-h-[56px] text-sm"
                    placeholder="Add follow-up note…"
                    defaultValue={st?.note ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v !== (st?.note ?? '')) onUpdate(id, { note: v })
                    }}
                  />
                </div>
              )
            })}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
