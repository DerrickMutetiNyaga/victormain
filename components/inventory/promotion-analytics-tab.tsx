"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

interface AnalyticsRow {
  campaignId: string
  campaignName: string
  status: string
  orders: number
  revenue: number
  discountGiven: number
  averageTicket: number
  topProducts: Array<{ name: string; quantity: number; revenue: number }>
}

function formatKsh(n: number) {
  return `KSh ${n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function PromotionAnalyticsTab() {
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState<AnalyticsRow[]>([])
  const [totals, setTotals] = useState({ orders: 0, revenue: 0, discountGiven: 0 })

  useEffect(() => {
    setLoading(true)
    fetch(`/api/catha/pos-discounts/analytics?days=${days}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          setRows(data.campaigns || [])
          setTotals(data.totals || { orders: 0, revenue: 0, discountGiven: 0 })
        }
      })
      .finally(() => setLoading(false))
  }, [days])

  return (
    <div className="px-4 py-4 sm:p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Promotion Analytics</h3>
          <p className="text-xs text-muted-foreground">Performance by campaign (POS orders only)</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-9 rounded-md border px-3 text-sm bg-background"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Orders</p>
          <p className="text-xl font-bold tabular-nums">{totals.orders}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Revenue</p>
          <p className="text-xl font-bold tabular-nums">{formatKsh(totals.revenue)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Discount given</p>
          <p className="text-xl font-bold tabular-nums text-amber-700">{formatKsh(totals.discountGiven)}</p>
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center border rounded-lg">No campaign activity in this period.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.campaignId} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{row.campaignName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{row.status}</p>
                </div>
                <p className="text-sm font-semibold text-amber-700 tabular-nums">{formatKsh(row.discountGiven)}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-md bg-muted/40 p-2">
                  <p className="text-muted-foreground">Orders</p>
                  <p className="font-semibold tabular-nums">{row.orders}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <p className="text-muted-foreground">Revenue</p>
                  <p className="font-semibold tabular-nums">{formatKsh(row.revenue)}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <p className="text-muted-foreground">Avg ticket</p>
                  <p className="font-semibold tabular-nums">{formatKsh(row.averageTicket)}</p>
                </div>
              </div>
              {row.topProducts.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Top products</p>
                  <ul className="text-sm space-y-1">
                    {row.topProducts.map((p) => (
                      <li key={p.name} className="flex justify-between gap-2">
                        <span className="truncate">{p.name}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">{p.quantity} sold</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
