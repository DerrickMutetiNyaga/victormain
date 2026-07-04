"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Flame, Loader2, Trophy } from "lucide-react"
import Link from "next/link"

interface PromotionStats {
  activeCount: number
  todayDiscountGiven: number
  activeCampaignCount?: number
  bestPerformingCampaign?: { id: string; name: string; discountGiven: number } | null
  activeCampaigns?: Array<{ id: string; name: string; icon: string | null; color: string | null }>
}

export function PosDiscountsWidget() {
  const [stats, setStats] = useState<PromotionStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/catha/pos-discounts?stats=true", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.stats) setStats(data.stats)
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-5 flex items-center justify-center min-h-[120px]">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!stats) return null

  return (
    <Card className="border-border bg-gradient-to-br from-white via-white to-amber-50/40 md:col-span-2">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-amber-600" />
              Promotion Performance
            </p>
            <p className="mt-1 text-2xl font-bold text-card-foreground">
              {stats.activeCampaignCount ?? 0} Active Campaign{stats.activeCampaignCount === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats.activeCount} live discount rules
            </p>
          </div>
          {stats.bestPerformingCampaign && (
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-end gap-1">
                <Trophy className="h-3 w-3 text-amber-600" />
                Best today
              </p>
              <p className="text-sm font-semibold">{stats.bestPerformingCampaign.name}</p>
            </div>
          )}
        </div>
        <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Discount given today</p>
            <p className="text-lg font-bold text-amber-700 tabular-nums">
              KSh {stats.todayDiscountGiven.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
            </p>
          </div>
          {stats.activeCampaigns && stats.activeCampaigns.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Today&apos;s campaigns</p>
              <div className="flex flex-wrap gap-1">
                {stats.activeCampaigns.slice(0, 3).map((c) => (
                  <span key={c.id} className="text-xs rounded-full bg-amber-100 text-amber-900 px-2 py-0.5">
                    {c.icon || "🔥"} {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <Link
          href="/catha/inventory"
          className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
        >
          Manage promotions →
        </Link>
      </CardContent>
    </Card>
  )
}
