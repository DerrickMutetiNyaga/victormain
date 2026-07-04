"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Flame, Loader2 } from "lucide-react"
import Link from "next/link"

interface PosDiscountStats {
  activeCount: number
  todayDiscountGiven: number
}

export function PosDiscountsWidget() {
  const [stats, setStats] = useState<PosDiscountStats | null>(null)
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
    <Card className="border-border bg-gradient-to-br from-white via-white to-amber-50/40">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-amber-600" />
              POS Discounts
            </p>
            <p className="mt-1 text-2xl font-bold text-card-foreground">
              {stats.activeCount} Active
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Products & categories</p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-border/60">
          <p className="text-xs text-muted-foreground">Today&apos;s Discount Given</p>
          <p className="text-lg font-bold text-amber-700 tabular-nums">
            KSh {stats.todayDiscountGiven.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <Link
          href="/catha/inventory"
          className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
        >
          Manage discounts →
        </Link>
      </CardContent>
    </Card>
  )
}
