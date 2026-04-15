'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Brain, ShieldAlert } from 'lucide-react'
import { AIHero } from './_components/ai-hero'
import { AIPriorityActions, AIAlerts, AIRecommendations } from './_components/ai-alerts-recs'
import {
  ProfitIntelligence, InventoryIntelligence, ClientIntelligence,
  OperationsIntelligence, PeakHoursIntelligence, SupplierIntelligence,
  OrderSourceIntelligence,
} from './_components/ai-intelligence-sections'
import { AskAIPanel, AIQuickActions } from './_components/ai-ask-panel'

interface IntelligenceData {
  success: boolean
  lastUpdated: string
  healthScore: { overall: number; sales: number; inventory: number; dataQuality: number; operations: number; clientRetention: number }
  overview: any
  priorityActions: any[]
  alerts: any[]
  recommendations: any[]
  profitIntelligence: any
  inventoryIntelligence: any
  clientIntelligence: any
  operationsIntelligence: any
  peakHoursIntelligence: any
  supplierIntelligence: any
  orderSourceIntelligence: any
}

export default function AIIntelligenceContent() {
  const [data, setData] = useState<IntelligenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/catha/ai-intelligence')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load intelligence data')
      setData(json)
    } catch (err: any) {
      setError(err.message || 'Failed to load intelligence data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
            <Brain className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Analyzing business data...</p>
          <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Failed to load intelligence data</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
        <button onClick={fetchData} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-x-hidden max-w-[1600px] mx-auto pb-12">
      {error && (
        <div className="rounded-lg bg-destructive/10 text-destructive px-4 py-2 text-sm">{error}</div>
      )}

      {/* 1. Hero + Health Score + Overview */}
      <AIHero
        healthScore={data.healthScore}
        overview={data.overview}
        lastUpdated={data.lastUpdated}
        onRefresh={fetchData}
        loading={loading}
      />

      {/* 2. Priority Actions */}
      <AIPriorityActions actions={data.priorityActions} />

      {/* 3. AI Alerts */}
      <AIAlerts alerts={data.alerts} />

      {/* 4. AI Recommendations */}
      <AIRecommendations recommendations={data.recommendations} />

      {/* 5-6. Profit + Inventory (side by side on large screens) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ProfitIntelligence data={data.profitIntelligence} />
        <InventoryIntelligence data={data.inventoryIntelligence} />
      </div>

      {/* 7-8. Client + Operations */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ClientIntelligence data={data.clientIntelligence} />
        <OperationsIntelligence data={data.operationsIntelligence} />
      </div>

      {/* 9. Peak Hours (full width for charts) */}
      <PeakHoursIntelligence data={data.peakHoursIntelligence} />

      {/* 10-11. Supplier + Order Source */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SupplierIntelligence data={data.supplierIntelligence} />
        <OrderSourceIntelligence data={data.orderSourceIntelligence} />
      </div>

      {/* 12. Ask AI */}
      <AskAIPanel intelligenceData={data} />

      {/* 13. Quick Actions */}
      <AIQuickActions />

      {/* Footer Advisory */}
      <div className="text-center py-4 border-t border-border/30">
        <p className="text-[11px] text-muted-foreground">
          AI Intelligence is advisory only. Insights are based on current operational data and do not make automatic changes to your system.
        </p>
      </div>
    </div>
  )
}
